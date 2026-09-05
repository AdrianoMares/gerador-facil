import { createClient } from '@supabase/supabase-js';
import { bearerToken, requestContentLength, sendJson } from '../../../_documentAiAuth.js';
import { reconcilePagBankPayment } from '../../../_pagbankReconciliation.js';

const MAX_BODY_BYTES = 4 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function client(createClientImpl, env, key) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url || !key) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

async function loadPayment(backend, orderId, userId) {
  const { data: order, error: orderError } = await backend.from('orders')
    .select('id, user_id, status, total_cents, currency')
    .eq('id', orderId).eq('user_id', userId).maybeSingle();
  if (orderError) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  if (!order) throw new Error('ORDER_NOT_FOUND');
  const { data: payment, error: paymentError } = await backend.from('payments')
    .select('id, order_id, provider, provider_environment, payment_method, status, amount_cents, buyer_fee_cents, installments, currency, external_order_id, external_payment_id, provider_status, refunded_amount_cents')
    .eq('order_id', order.id).eq('provider', 'pagbank').eq('provider_environment', 'sandbox')
    .eq('payment_method', 'credit_card').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (paymentError) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  return { ...payment, order };
}

export function createPagBankCardStatusHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env,
  logError = console.error
} = {}) {
  return async function pagBankCardStatus(request, response) {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    if (requestContentLength(request) > MAX_BODY_BYTES) return sendJson(response, 413, { error: 'BODY_TOO_LARGE' });
    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });
    try {
      if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)
        || Object.keys(request.body).length !== 1 || !UUID_PATTERN.test(request.body.orderId || '')) {
        throw new Error('INVALID_BODY');
      }
      const auth = client(createClientImpl, env, env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await auth.auth.getUser(accessToken);
      if (error || !data?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });
      if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('PAYMENT_NOT_CONFIGURED');
      }
      const backend = client(createClientImpl, env, env.SUPABASE_SERVICE_ROLE_KEY);
      const payment = await loadPayment(backend, request.body.orderId, data.user.id);
      const result = await reconcilePagBankPayment({ backend, payment, fetchImpl, env, logError });
      return sendJson(response, 200, {
        orderStatus: result.orderStatus,
        paymentStatus: result.paymentStatus,
        providerStatus: result.providerStatus
      });
    } catch (error) {
      if (error?.message === 'INVALID_BODY') return sendJson(response, 400, { error: 'INVALID_BODY' });
      if (['ORDER_NOT_FOUND', 'PAYMENT_NOT_FOUND'].includes(error?.message)) return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' });
      if (error?.message === 'PAYMENT_NOT_CONFIGURED') return sendJson(response, 503, { error: 'SERVICE_NOT_CONFIGURED' });
      if (error?.message === 'PAGBANK_VERIFICATION_MISMATCH') return sendJson(response, 409, { error: 'PAYMENT_VERIFICATION_FAILED' });
      return sendJson(response, 502, { error: 'PAYMENT_STATUS_UNAVAILABLE' });
    }
  };
}

export default createPagBankCardStatusHandler();
