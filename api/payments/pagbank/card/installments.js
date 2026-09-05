import { createClient } from '@supabase/supabase-js';
import { bearerToken, requestContentLength, sendJson } from '../../../_documentAiAuth.js';
import { fetchPagBankFeePlans, validCardBin } from '../../../_pagbankCard.js';

const MAX_BODY_BYTES = 4 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function client(createClientImpl, env, key) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url || !key) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

export function validateInstallmentsInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !['orderId', 'cardBin'].includes(key))
    || Object.keys(body).length !== 2
    || !UUID_PATTERN.test(body.orderId || '') || !validCardBin(body.cardBin)) {
    throw new Error('INVALID_BODY');
  }
  return { orderId: body.orderId, cardBin: body.cardBin };
}

export function createPagBankCardInstallmentsHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env
} = {}) {
  return async function pagBankCardInstallments(request, response) {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    }
    if (requestContentLength(request) > MAX_BODY_BYTES) {
      return sendJson(response, 413, { error: 'BODY_TOO_LARGE' });
    }
    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    try {
      const input = validateInstallmentsInput(request.body);
      const auth = client(createClientImpl, env, env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);
      const { data: userData, error: userError } = await auth.auth.getUser(accessToken);
      if (userError || !userData?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const backend = client(createClientImpl, env, env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: order, error } = await backend
        .from('orders')
        .select('id, user_id, status, currency, total_cents')
        .eq('id', input.orderId)
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (error) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'pending_payment') throw new Error('ORDER_NOT_PENDING_PAYMENT');
      if (order.currency !== 'BRL' || !Number.isInteger(order.total_cents) || order.total_cents <= 0) {
        throw new Error('ORDER_CURRENCY_NOT_SUPPORTED');
      }

      const plans = await fetchPagBankFeePlans(fetchImpl, env, order.total_cents, input.cardBin);
      const installments = plans.map((plan) => ({
        installments: plan.installments,
        installmentValue: plan.installmentValue,
        totalAmount: plan.totalAmount,
        buyerFee: plan.buyerFee,
        interestFree: plan.interestFree
      }));
      return sendJson(response, 200, { installments, environment: 'sandbox' });
    } catch (error) {
      const code = error?.message;
      if (code === 'INVALID_BODY' || code === 'INVALID_CARD_BIN') return sendJson(response, 400, { error: 'INVALID_BODY' });
      if (code === 'ORDER_NOT_FOUND') return sendJson(response, 404, { error: code });
      if (code === 'ORDER_NOT_PENDING_PAYMENT') return sendJson(response, 409, { error: code });
      if (code === 'ORDER_CURRENCY_NOT_SUPPORTED') return sendJson(response, 422, { error: code });
      if (code === 'PAYMENT_NOT_CONFIGURED') return sendJson(response, 503, { error: 'SERVICE_NOT_CONFIGURED' });
      return sendJson(response, 502, { error: 'CARD_INSTALLMENTS_UNAVAILABLE' });
    }
  };
}

export default createPagBankCardInstallmentsHandler();
