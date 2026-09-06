import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requestContentLength, sendJson } from '../_documentAiAuth.js';
import { reconcilePagBankPayment } from '../_pagbankReconciliation.js';

const MAX_BODY_BYTES = 4 * 1024;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function backendClient(createClientImpl, env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function tokenFromBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !TOKEN_PATTERN.test(body.token || '')) {
    throw new Error('INVALID_PUBLIC_TOKEN');
  }
  return body.token;
}

function safeBoletoUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'boleto.pagseguro.com.br'
      && url.pathname.endsWith('.pdf') ? url.toString() : null;
  } catch {
    return null;
  }
}

async function loadContext(backend, tokenHash) {
  const { data: access, error: accessError } = await backend.from('order_public_access_tokens')
    .select('order_id, payment_id').eq('token_hash', tokenHash).maybeSingle();
  if (accessError) throw new Error('PUBLIC_ORDER_UNAVAILABLE');
  if (!access) throw new Error('PUBLIC_ORDER_NOT_FOUND');

  const [{ data: order, error: orderError }, { data: payment, error: paymentError }] = await Promise.all([
    backend.from('orders')
      .select('id, status, total_cents, currency, order_items(product_name, product:products(product_type, fulfillment_mode))')
      .eq('id', access.order_id).maybeSingle(),
    backend.from('payments')
      .select('id, order_id, provider, provider_environment, payment_method, status, amount_cents, buyer_fee_cents, installments, currency, external_order_id, external_payment_id, provider_status, refunded_amount_cents, boleto_due_date, boleto_barcode, boleto_formatted_barcode, boleto_url')
      .eq('id', access.payment_id).maybeSingle()
  ]);
  const serviceOnly = Array.isArray(order?.order_items) && order.order_items.length > 0
    && order.order_items.every((item) => item.product?.product_type === 'service'
      && item.product?.fulfillment_mode === 'service_request');
  if (orderError || paymentError) throw new Error('PUBLIC_ORDER_UNAVAILABLE');
  if (!order || !payment || payment.order_id !== order.id || !serviceOnly
    || payment.provider !== 'pagbank' || payment.provider_environment !== 'sandbox'
    || payment.payment_method !== 'boleto' || payment.amount_cents !== order.total_cents
    || payment.buyer_fee_cents !== 0 || payment.installments !== null
    || payment.currency !== 'BRL' || order.currency !== 'BRL'
    || !payment.external_order_id || !payment.external_payment_id
    || !safeBoletoUrl(payment.boleto_url)) throw new Error('PUBLIC_ORDER_NOT_FOUND');
  return { order, payment: { ...payment, order } };
}

function todayInSaoPaulo(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

function publicStatus(context, now) {
  const { order, payment } = context;
  if (order.status === 'paid' && payment.status === 'paid') return 'paid';
  if (['cancelled', 'expired', 'refunded'].includes(order.status)
    || ['failed', 'cancelled', 'expired', 'refunded'].includes(payment.status)
    || ['DECLINED', 'CANCELED'].includes(payment.provider_status)
    || payment.boleto_due_date < todayInSaoPaulo(now)) return 'expired_or_cancelled';
  return 'waiting';
}

function publicPayload(context, now) {
  const { order, payment } = context;
  return {
    serviceName: order.order_items[0].product_name,
    amountCents: order.total_cents,
    currency: 'BRL',
    status: publicStatus(context, now),
    dueDate: payment.boleto_due_date,
    digitableLine: payment.boleto_formatted_barcode,
    boletoUrl: safeBoletoUrl(payment.boleto_url)
  };
}

export function createPublicOrderStatusHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env,
  now = () => new Date(),
  logError = console.error
} = {}) {
  return async function publicOrderStatus(request, response) {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, {
        Allow: 'POST', 'Cache-Control': 'no-store'
      });
    }
    if (requestContentLength(request) > MAX_BODY_BYTES) {
      return sendJson(response, 413, { error: 'BODY_TOO_LARGE' }, { 'Cache-Control': 'no-store' });
    }
    try {
      const token = tokenFromBody(request.body);
      if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN) throw new Error('PAYMENT_NOT_CONFIGURED');
      const backend = backendClient(createClientImpl, env);
      const tokenHash = createHash('sha256').update(token).digest('hex');
      let context = await loadContext(backend, tokenHash);
      await reconcilePagBankPayment({ backend, payment: context.payment, fetchImpl, env, logError });
      context = await loadContext(backend, tokenHash);
      return sendJson(response, 200, publicPayload(context, now()), { 'Cache-Control': 'no-store' });
    } catch (error) {
      if (['INVALID_PUBLIC_TOKEN', 'PUBLIC_ORDER_NOT_FOUND'].includes(error?.message)) {
        return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' }, { 'Cache-Control': 'no-store' });
      }
      if (error?.message === 'PAYMENT_NOT_CONFIGURED') {
        return sendJson(response, 503, { error: 'SERVICE_NOT_CONFIGURED' }, { 'Cache-Control': 'no-store' });
      }
      return sendJson(response, 502, { error: 'ORDER_STATUS_UNAVAILABLE' }, { 'Cache-Control': 'no-store' });
    }
  };
}

export default createPublicOrderStatusHandler();
