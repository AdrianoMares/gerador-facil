import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sendJson } from '../../_documentAiAuth.js';
import { reconcilePagBankPayment } from '../../_pagbankReconciliation.js';

const MAX_RAW_BODY_BYTES = 64 * 1024;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export const config = {
  api: { bodyParser: false }
};

function headerValue(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export async function readRawRequestBody(request) {
  const declaredLength = Number(headerValue(request.headers, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RAW_BODY_BYTES) {
    throw new Error('BODY_TOO_LARGE');
  }

  if (Buffer.isBuffer(request.rawBody)) {
    if (request.rawBody.length > MAX_RAW_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    return request.rawBody;
  }

  if (!request?.[Symbol.asyncIterator]) throw new Error('RAW_BODY_UNAVAILABLE');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_RAW_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function validPagBankWebhookSignature(rawBody, signature, token) {
  if (!Buffer.isBuffer(rawBody) || !SHA256_HEX_PATTERN.test(signature || '') || !token) return false;
  const expected = createHash('sha256').update(`${token}-`, 'utf8').update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function serviceClient(createClientImpl, env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function webhookIdentifiers(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string') return null;
  const charges = Array.isArray(payload.charges) ? payload.charges : [];
  const charge = charges.find((entry) => typeof entry?.id === 'string' && typeof entry?.reference_id === 'string');
  if (!charge) return null;
  return {
    externalOrderId: payload.id,
    orderReference: payload.reference_id,
    externalPaymentId: charge.id,
    paymentReference: charge.reference_id
  };
}

async function loadKnownPayment(backend, identifiers) {
  const { data: payment, error: paymentError } = await backend
    .from('payments')
    .select('id, order_id, provider, provider_environment, payment_method, status, amount_cents, currency, external_order_id, external_payment_id, provider_status')
    .eq('external_order_id', identifiers.externalOrderId)
    .eq('provider', 'pagbank')
    .eq('provider_environment', 'sandbox')
    .eq('payment_method', 'pix')
    .maybeSingle();
  if (paymentError) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  if (!payment) return null;

  const { data: order, error: orderError } = await backend
    .from('orders')
    .select('id, user_id, status, total_cents, currency')
    .eq('id', payment.order_id)
    .maybeSingle();
  if (orderError) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  if (!order
    || identifiers.externalPaymentId !== payment.external_payment_id
    || identifiers.paymentReference !== payment.id
    || identifiers.orderReference !== order.id) return null;
  return { ...payment, order };
}

export function createPagBankWebhookHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env,
  logError = console.error
} = {}) {
  return async function pagBankWebhook(request, response) {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    }
    if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN) {
      return sendJson(response, 503, { error: 'SERVICE_NOT_CONFIGURED' });
    }

    const signature = headerValue(request.headers, 'x-authenticity-token');
    if (!signature) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    let rawBody;
    try {
      rawBody = await readRawRequestBody(request);
    } catch (error) {
      return sendJson(response, error?.message === 'BODY_TOO_LARGE' ? 413 : 400, { error: 'INVALID_REQUEST' });
    }

    if (!validPagBankWebhookSignature(rawBody, signature, env.PAGBANK_TOKEN)) {
      return sendJson(response, 403, { error: 'INVALID_SIGNATURE' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return sendJson(response, 400, { error: 'INVALID_REQUEST' });
    }

    const identifiers = webhookIdentifiers(payload);
    if (!identifiers) return sendJson(response, 202, { received: true });

    try {
      const backend = serviceClient(createClientImpl, env);
      const payment = await loadKnownPayment(backend, identifiers);
      if (!payment) return sendJson(response, 202, { received: true });
      await reconcilePagBankPayment({ backend, payment, fetchImpl, env, logError });
      return sendJson(response, 200, { received: true });
    } catch {
      return sendJson(response, 502, { error: 'WEBHOOK_PROCESSING_UNAVAILABLE' });
    }
  };
}

export default createPagBankWebhookHandler();
