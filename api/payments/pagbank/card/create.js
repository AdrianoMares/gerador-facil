import { createClient } from '@supabase/supabase-js';
import { bearerToken, requestContentLength, sendJson } from '../../../_documentAiAuth.js';
import { fetchPagBankFeePlans, validCardBin } from '../../../_pagbankCard.js';

const PAGBANK_SANDBOX_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 24 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGBANK_ORDER_PATTERN = /^ORDE_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGBANK_CHARGE_PATTERN = /^CHAR_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(['WAITING', 'PAID', 'DECLINED', 'IN_ANALYSIS', 'AUTHORIZED']);

function digits(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function objectWithFields(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((field) => fields.includes(field));
}

function validTaxId(value) {
  return (value.length === 11 || value.length === 14) && !/^(\d)\1+$/.test(value);
}

function normalizedName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function validatePagBankCardInput(body) {
  if (!objectWithFields(body, ['orderId', 'customer', 'holder', 'encryptedCard', 'cardBin', 'installments'])
    || Object.keys(body).length !== 6 || !UUID_PATTERN.test(body.orderId || '') || !validCardBin(body.cardBin)
    || !Number.isInteger(body.installments) || body.installments < 1 || body.installments > 5) {
    throw new Error('INVALID_BODY');
  }
  if (!objectWithFields(body.customer, ['name', 'email', 'taxId', 'phone'])
    || !objectWithFields(body.holder, ['name', 'taxId'])) throw new Error('INVALID_BODY');

  const customerName = normalizedName(body.customer.name);
  const email = typeof body.customer.email === 'string' ? body.customer.email.trim().toLowerCase() : '';
  const customerTaxId = digits(body.customer.taxId);
  const holderName = normalizedName(body.holder.name);
  const holderTaxId = digits(body.holder.taxId);
  let phone = digits(body.customer.phone);
  if (phone.length === 13 && phone.startsWith('55')) phone = phone.slice(2);
  if (customerName.length < 3 || customerName.length > 100 || !customerName.includes(' ')
    || holderName.length < 3 || holderName.length > 100 || !holderName.includes(' ')
    || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !validTaxId(customerTaxId) || holderTaxId.length !== 11 || !validTaxId(holderTaxId) || phone.length !== 11
    || typeof body.encryptedCard !== 'string' || body.encryptedCard.length < 20 || body.encryptedCard.length > 10_000) {
    throw new Error('INVALID_CARD_DATA');
  }
  return {
    orderId: body.orderId,
    cardBin: body.cardBin,
    installments: body.installments,
    encryptedCard: body.encryptedCard,
    customer: {
      name: customerName,
      email,
      taxId: customerTaxId,
      phone: { country: '55', area: phone.slice(0, 2), number: phone.slice(2) }
    },
    holder: { name: holderName, taxId: holderTaxId }
  };
}

export function buildPagBankCardPayload({ order, payment, customer, holder, encryptedCard, plan, notificationUrl }) {
  const amount = { value: plan.totalAmount, currency: 'BRL' };
  if (plan.installments > 1) {
    amount.fees = { buyer: { interest: { total: plan.buyerFee, installments: plan.buyerFeeInstallments } } };
  }
  return {
    reference_id: order.id,
    customer: {
      name: customer.name,
      email: customer.email,
      tax_id: customer.taxId,
      phones: [{ ...customer.phone, type: 'MOBILE' }]
    },
    items: order.order_items.map((item) => ({
      reference_id: item.id,
      name: item.product_name,
      quantity: item.quantity,
      unit_amount: item.unit_price_cents
    })),
    charges: [{
      reference_id: payment.id,
      description: `Pedido Resodi ${order.id}`,
      amount,
      payment_method: {
        type: 'CREDIT_CARD',
        installments: plan.installments,
        capture: true,
        card: {
          encrypted: encryptedCard,
          holder: { name: holder.name, tax_id: holder.taxId },
          store: false
        }
      }
    }],
    notification_urls: [notificationUrl]
  };
}

export function validatePagBankCardResponse(payload, { order, payment, plan }) {
  if (!payload || typeof payload !== 'object' || !PAGBANK_ORDER_PATTERN.test(payload.id || '')
    || (payload.reference_id !== undefined && payload.reference_id !== order.id)) {
    throw new Error('INVALID_PAGBANK_RESPONSE');
  }
  const charge = Array.isArray(payload.charges)
    ? payload.charges.find((entry) => entry?.reference_id === payment.id)
    : null;
  const buyerInterest = charge?.amount?.fees?.buyer?.interest;
  if (!charge || !PAGBANK_CHARGE_PATTERN.test(charge.id || '')
    || charge.amount?.value !== plan.totalAmount || charge.amount?.currency !== 'BRL'
    || charge.payment_method?.type !== 'CREDIT_CARD'
    || charge.payment_method?.installments !== plan.installments
    || charge.payment_method?.capture !== true
    || charge.payment_method?.card?.store === true
    || !ALLOWED_STATUSES.has(charge.status)
    || (plan.installments === 1 && buyerInterest?.total !== undefined && buyerInterest.total !== 0)
    || (plan.installments > 1 && (buyerInterest?.total !== plan.buyerFee
      || buyerInterest?.installments !== plan.buyerFeeInstallments))) {
    throw new Error('INVALID_PAGBANK_RESPONSE');
  }
  return {
    externalOrderId: payload.id,
    externalPaymentId: charge.id,
    providerStatus: charge.status
  };
}

function client(createClientImpl, env, key) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url || !key) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function webhookUrl(env) {
  try {
    const url = new URL(env.PAGBANK_WEBHOOK_URL);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function loadOrder(backend, orderId, userId) {
  const { data, error } = await backend
    .from('orders')
    .select('id, user_id, status, currency, total_cents, order_items(id, product_name, quantity, unit_price_cents)')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  if (!data) throw new Error('ORDER_NOT_FOUND');
  if (data.status !== 'pending_payment') throw new Error('ORDER_NOT_PENDING_PAYMENT');
  if (data.currency !== 'BRL' || !Number.isInteger(data.total_cents) || data.total_cents <= 0) {
    throw new Error('ORDER_CURRENCY_NOT_SUPPORTED');
  }
  if (!Array.isArray(data.order_items) || data.order_items.length === 0) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  return data;
}

async function loadPayment(backend, paymentId, order, plan) {
  const { data, error } = await backend
    .from('payments')
    .select('id, order_id, provider, provider_environment, payment_method, provider_request_state, status, amount_cents, buyer_fee_cents, installments, currency, external_order_id, external_payment_id')
    .eq('id', paymentId)
    .maybeSingle();
  if (error || !data || data.order_id !== order.id || data.provider !== 'pagbank'
    || data.provider_environment !== 'sandbox' || data.payment_method !== 'credit_card'
    || data.status !== 'pending' || data.amount_cents !== plan.totalAmount
    || data.buyer_fee_cents !== plan.buyerFee || data.installments !== plan.installments
    || data.currency !== 'BRL') throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  return data;
}

async function markUncertain(backend, paymentId) {
  try {
    const { error } = await backend.from('payments').update({ provider_request_state: 'uncertain' }).eq('id', paymentId);
    if (error) throw error;
  } catch {
    // Remaining in submitting also blocks another attempt.
  }
}

async function postOrder(fetchImpl, env, paymentId, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
  try {
    return await fetchImpl(`${PAGBANK_SANDBOX_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAGBANK_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-idempotency-key': `resodi-${paymentId}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function publicError(error) {
  const code = error?.message;
  if (code === 'BODY_TOO_LARGE') return { status: 413, code };
  if (code === 'INVALID_BODY' || code === 'INVALID_CARD_DATA') return { status: 400, code };
  if (code === 'ORDER_NOT_FOUND') return { status: 404, code };
  if (['ORDER_NOT_PENDING_PAYMENT', 'PAYMENT_METHOD_IN_PROGRESS', 'CARD_PAYMENT_IN_PROGRESS', 'CARD_CREATION_UNCERTAIN'].includes(code)) {
    return { status: 409, code };
  }
  if (code === 'ORDER_CURRENCY_NOT_SUPPORTED' || code === 'INSTALLMENT_PLAN_NOT_AVAILABLE') return { status: 422, code };
  if (code === 'PAYMENT_NOT_CONFIGURED') return { status: 503, code: 'SERVICE_NOT_CONFIGURED' };
  return { status: 502, code: 'CARD_CREATE_UNAVAILABLE' };
}

export function createPagBankCardHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env
} = {}) {
  return async function pagBankCardCreate(request, response) {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    if (requestContentLength(request) > MAX_BODY_BYTES) return sendJson(response, 413, { error: 'BODY_TOO_LARGE' });
    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    try {
      const input = validatePagBankCardInput(request.body);
      if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN) throw new Error('PAYMENT_NOT_CONFIGURED');
      const notificationUrl = webhookUrl(env);
      if (!notificationUrl) throw new Error('PAYMENT_NOT_CONFIGURED');
      const auth = client(createClientImpl, env, env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);
      const { data: userData, error: userError } = await auth.auth.getUser(accessToken);
      if (userError || !userData?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });
      const backend = client(createClientImpl, env, env.SUPABASE_SERVICE_ROLE_KEY);
      const order = await loadOrder(backend, input.orderId, userData.user.id);

      const plans = await fetchPagBankFeePlans(fetchImpl, env, order.total_cents, input.cardBin);
      const plan = plans.find((entry) => entry.installments === input.installments);
      if (!plan) throw new Error('INSTALLMENT_PLAN_NOT_AVAILABLE');

      const { data: paymentId, error: prepareError } = await backend.rpc('prepare_pagbank_card_payment', {
        p_order_id: order.id,
        p_user_id: userData.user.id,
        p_name: input.customer.name,
        p_email: input.customer.email,
        p_phone_country: input.customer.phone.country,
        p_phone_area: input.customer.phone.area,
        p_phone_number: input.customer.phone.number,
        p_amount_cents: plan.totalAmount,
        p_buyer_fee_cents: plan.buyerFee,
        p_installments: plan.installments
      });
      if (prepareError) throw new Error(prepareError.message);
      if (!UUID_PATTERN.test(paymentId || '')) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
      const payment = await loadPayment(backend, paymentId, order, plan);

      if (payment.external_order_id && payment.external_payment_id) {
        return sendJson(response, 200, { paymentId, status: 'processing', environment: 'sandbox' });
      }
      if (payment.provider_request_state !== 'prepared') throw new Error('CARD_CREATION_UNCERTAIN');

      const { data: claimed, error: claimError } = await backend.rpc('claim_pagbank_card_submission', {
        p_payment_id: payment.id,
        p_order_id: order.id,
        p_user_id: userData.user.id
      });
      if (claimError) throw new Error(claimError.message);
      if (claimed !== true) throw new Error('CARD_CREATION_UNCERTAIN');

      const payload = buildPagBankCardPayload({
        order,
        payment,
        customer: input.customer,
        holder: input.holder,
        encryptedCard: input.encryptedCard,
        plan,
        notificationUrl
      });
      let providerResponse;
      try {
        providerResponse = await postOrder(fetchImpl, env, payment.id, payload);
      } catch {
        await markUncertain(backend, payment.id);
        return sendJson(response, 502, { error: 'CARD_CREATION_UNCERTAIN' });
      }
      if (!providerResponse.ok || providerResponse.status !== 201) {
        if ([400, 404, 422].includes(providerResponse.status)) {
          const { error: updateError } = await backend.from('payments')
            .update({ status: 'failed', provider_request_state: 'failed' })
            .eq('id', payment.id);
          if (updateError) {
            await markUncertain(backend, payment.id);
            return sendJson(response, 502, { error: 'CARD_CREATION_UNCERTAIN' });
          }
          return sendJson(response, 422, { error: 'PAGBANK_REJECTED' });
        }
        await markUncertain(backend, payment.id);
        return sendJson(response, 502, { error: 'CARD_CREATION_UNCERTAIN' });
      }

      let result;
      try {
        result = validatePagBankCardResponse(await providerResponse.json(), { order, payment, plan });
      } catch {
        await markUncertain(backend, payment.id);
        return sendJson(response, 502, { error: 'CARD_CREATION_UNCERTAIN' });
      }
      const { data: recorded, error: recordError } = await backend.rpc('record_pagbank_card_creation', {
        p_payment_id: payment.id,
        p_order_id: order.id,
        p_external_order_id: result.externalOrderId,
        p_external_payment_id: result.externalPaymentId,
        p_provider_status: result.providerStatus
      });
      if (recordError || recorded !== payment.id) {
        await markUncertain(backend, payment.id);
        return sendJson(response, 502, { error: 'CARD_CREATION_UNCERTAIN' });
      }
      if (result.providerStatus === 'DECLINED') return sendJson(response, 422, { error: 'PAGBANK_DECLINED' });
      return sendJson(response, 202, {
        paymentId: payment.id,
        status: 'processing',
        providerStatus: result.providerStatus,
        environment: 'sandbox'
      });
    } catch (error) {
      const result = publicError(error);
      return sendJson(response, result.status, { error: result.code });
    }
  };
}

export default createPagBankCardHandler();
