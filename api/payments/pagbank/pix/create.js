import { createClient } from '@supabase/supabase-js';
import { bearerToken, requestContentLength, sendJson } from '../../../_documentAiAuth.js';

const PAGBANK_SANDBOX_URL = 'https://sandbox.api.pagseguro.com';
const PIX_EXPIRATION_MINUTES = 30;
const PAGBANK_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 16 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGBANK_ORDER_PATTERN = /^ORDE_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGBANK_CHARGE_PATTERN = /^CHAR_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_BODY_FIELDS = new Set(['orderId', 'customer']);
const ALLOWED_CUSTOMER_FIELDS = new Set(['name', 'email', 'taxId', 'phone']);

function digits(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function hasOnlyFields(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((field) => allowed.has(field));
}

function validTaxId(taxId) {
  return (taxId.length === 11 || taxId.length === 14) && !/^(\d)\1+$/.test(taxId);
}

export function validatePagBankPixInput(body) {
  if (!hasOnlyFields(body, ALLOWED_BODY_FIELDS)) throw new Error('INVALID_BODY');
  if (!UUID_PATTERN.test(body.orderId || '')) throw new Error('INVALID_ORDER_ID');
  if (!hasOnlyFields(body.customer, ALLOWED_CUSTOMER_FIELDS)) throw new Error('INVALID_CUSTOMER');

  const name = typeof body.customer.name === 'string' ? body.customer.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof body.customer.email === 'string' ? body.customer.email.trim().toLowerCase() : '';
  const taxId = digits(body.customer.taxId);
  let phone = digits(body.customer.phone);

  if (phone.length === 13 && phone.startsWith('55')) phone = phone.slice(2);
  if (name.length < 3 || name.length > 100 || !name.includes(' ')) throw new Error('INVALID_CUSTOMER_NAME');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_CUSTOMER_EMAIL');
  if (!validTaxId(taxId)) throw new Error('INVALID_CUSTOMER_TAX_ID');
  if (phone.length !== 11) throw new Error('INVALID_CUSTOMER_PHONE');

  return {
    orderId: body.orderId,
    customer: {
      name,
      email,
      taxId,
      phone: { country: '55', area: phone.slice(0, 2), number: phone.slice(2) }
    }
  };
}

function expirationDate(now) {
  return new Date(now.getTime() + PIX_EXPIRATION_MINUTES * 60 * 1000).toISOString();
}

export function buildPagBankPixPayload({ order, payment, customer, now }) {
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
      amount: { value: order.total_cents, currency: order.currency },
      payment_method: {
        type: 'PIX',
        pix: { expiration_date: expirationDate(now) }
      }
    }]
  };
}

function validSandboxQrUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'sandbox.api.pagseguro.com'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function validatePagBankPixResponse(payload, { order, payment }) {
  if (!payload || typeof payload !== 'object' || !PAGBANK_ORDER_PATTERN.test(payload.id || '')) {
    throw new Error('INVALID_PAGBANK_RESPONSE');
  }
  if (payload.reference_id !== undefined && payload.reference_id !== order.id) {
    throw new Error('INVALID_PAGBANK_RESPONSE');
  }

  const charge = Array.isArray(payload.charges)
    ? payload.charges.find((entry) => entry?.reference_id === payment.id)
    : null;
  if (!charge || !PAGBANK_CHARGE_PATTERN.test(charge.id || '')) throw new Error('INVALID_PAGBANK_RESPONSE');
  if (charge.metadata?.ps_order_id !== payload.id) throw new Error('INVALID_PAGBANK_RESPONSE');
  if (charge.amount?.value !== order.total_cents || charge.amount?.currency !== 'BRL') {
    throw new Error('INVALID_PAGBANK_RESPONSE');
  }
  if (charge.payment_method?.type !== 'PIX') throw new Error('INVALID_PAGBANK_RESPONSE');
  if (!['WAITING', 'DECLINED', 'PAID'].includes(charge.status)) throw new Error('INVALID_PAGBANK_RESPONSE');

  const qrCode = typeof charge.qr_code?.text === 'string' && charge.qr_code.text.trim()
    ? charge.qr_code.text.trim()
    : null;
  const qrCodeUrl = validSandboxQrUrl(
    charge.links?.find((link) => link?.rel === 'QRCODE.PNG' && link?.media === 'image/png')?.href
  );
  const expiresAt = charge.payment_method?.pix?.expiration_date;

  if (charge.status === 'WAITING' && (!qrCode || !expiresAt || Number.isNaN(Date.parse(expiresAt)))) {
    throw new Error('INVALID_PAGBANK_RESPONSE');
  }

  return {
    externalOrderId: payload.id,
    externalPaymentId: charge.id,
    providerStatus: charge.status,
    status: charge.status === 'DECLINED' ? 'failed' : 'pending',
    qrCode,
    qrCodeUrl,
    expiresAt: expiresAt || null
  };
}

function supabaseUrl(env) {
  return env.SUPABASE_URL || env.VITE_SUPABASE_URL;
}

function userClient(createClientImpl, env) {
  const url = supabaseUrl(env);
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('AUTH_NOT_CONFIGURED');
  return createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function serviceClient(createClientImpl, env) {
  const url = supabaseUrl(env);
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function configurationReady(env) {
  return env.PAGBANK_ENV === 'sandbox' && Boolean(env.PAGBANK_TOKEN);
}

function publicError(error) {
  const code = error?.message;
  if (code === 'BODY_TOO_LARGE') return { status: 413, code };
  if (['INVALID_BODY', 'INVALID_ORDER_ID', 'INVALID_CUSTOMER', 'INVALID_CUSTOMER_NAME', 'INVALID_CUSTOMER_EMAIL', 'INVALID_CUSTOMER_TAX_ID', 'INVALID_CUSTOMER_PHONE'].includes(code)) {
    return { status: 400, code };
  }
  if (code === 'ORDER_NOT_FOUND') return { status: 404, code };
  if (code === 'ORDER_NOT_PENDING_PAYMENT' || code === 'PIX_ALREADY_CREATED') return { status: 409, code };
  if (code === 'ORDER_CURRENCY_NOT_SUPPORTED') return { status: 422, code };
  if (['AUTH_NOT_CONFIGURED', 'PAYMENT_NOT_CONFIGURED'].includes(code)) return { status: 503, code: 'SERVICE_NOT_CONFIGURED' };
  return { status: 500, code: 'PIX_CREATE_UNAVAILABLE' };
}

async function loadPaymentContext(client, orderId, paymentId, userId) {
  const [{ data: order, error: orderError }, { data: payment, error: paymentError }] = await Promise.all([
    client
      .from('orders')
      .select('id, user_id, status, currency, total_cents, order_items(id, product_name, quantity, unit_price_cents)')
      .eq('id', orderId)
      .maybeSingle(),
    client
      .from('payments')
      .select('id, order_id, provider, provider_environment, payment_method, status, amount_cents, currency, external_order_id, external_payment_id')
      .eq('id', paymentId)
      .maybeSingle()
  ]);

  if (orderError || paymentError) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  if (!order || order.user_id !== userId) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'pending_payment') throw new Error('ORDER_NOT_PENDING_PAYMENT');
  if (order.currency !== 'BRL') throw new Error('ORDER_CURRENCY_NOT_SUPPORTED');
  if (!Array.isArray(order.order_items) || order.order_items.length === 0) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  if (!payment || payment.order_id !== order.id || payment.provider !== 'pagbank'
    || payment.provider_environment !== 'sandbox' || payment.payment_method !== 'pix'
    || payment.amount_cents !== order.total_cents || payment.currency !== order.currency) {
    throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  }
  if (payment.external_order_id || payment.external_payment_id) throw new Error('PIX_ALREADY_CREATED');

  return { order, payment };
}

async function updatePayment(client, paymentId, values) {
  const { error } = await client.from('payments').update(values).eq('id', paymentId);
  if (error) throw new Error('PAYMENT_PERSISTENCE_UNAVAILABLE');
}

function definitiveClientFailure(status) {
  return status === 400 || status === 404 || status === 422;
}

export function createPagBankPixHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env,
  now = () => new Date()
} = {}) {
  return async function pagBankPixCreate(request, response) {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    }
    if (requestContentLength(request) > MAX_BODY_BYTES) {
      return sendJson(response, 413, { error: 'BODY_TOO_LARGE' });
    }

    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    try {
      const auth = userClient(createClientImpl, env);
      const { data: userData, error: userError } = await auth.auth.getUser(accessToken);
      if (userError || !userData?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const input = validatePagBankPixInput(request.body);
      if (!configurationReady(env)) throw new Error('PAYMENT_NOT_CONFIGURED');

      const backend = serviceClient(createClientImpl, env);
      const { data: paymentId, error: prepareError } = await backend.rpc('prepare_pagbank_pix_payment', {
        p_order_id: input.orderId,
        p_user_id: userData.user.id,
        p_name: input.customer.name,
        p_email: input.customer.email,
        p_phone_country: input.customer.phone.country,
        p_phone_area: input.customer.phone.area,
        p_phone_number: input.customer.phone.number
      });
      if (prepareError) throw new Error(prepareError.message);
      if (!UUID_PATTERN.test(paymentId || '')) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');

      const { order, payment } = await loadPaymentContext(backend, input.orderId, paymentId, userData.user.id);
      const pagBankPayload = buildPagBankPixPayload({ order, payment, customer: input.customer, now: now() });

      let pagBankResponse;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
      try {
        pagBankResponse = await fetchImpl(`${PAGBANK_SANDBOX_URL}/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.PAGBANK_TOKEN}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pagBankPayload),
          signal: controller.signal
        });
      } catch {
        return sendJson(response, 502, { error: 'PAGBANK_RESPONSE_UNCERTAIN' });
      } finally {
        clearTimeout(timeout);
      }

      if (!pagBankResponse.ok) {
        if (definitiveClientFailure(pagBankResponse.status)) {
          await updatePayment(backend, payment.id, { status: 'failed' });
          return sendJson(response, 422, { error: 'PAGBANK_REJECTED' });
        }
        return sendJson(response, 502, { error: 'PAGBANK_RESPONSE_UNCERTAIN' });
      }

      let pagBankBody;
      try {
        pagBankBody = await pagBankResponse.json();
      } catch {
        return sendJson(response, 502, { error: 'PAGBANK_RESPONSE_UNCERTAIN' });
      }

      const result = validatePagBankPixResponse(pagBankBody, { order, payment });
      await updatePayment(backend, payment.id, {
        external_order_id: result.externalOrderId,
        external_payment_id: result.externalPaymentId,
        status: result.status
      });

      if (result.providerStatus === 'DECLINED') {
        return sendJson(response, 422, { error: 'PAGBANK_DECLINED' });
      }
      if (result.providerStatus === 'PAID') {
        return sendJson(response, 409, { error: 'PAYMENT_STATUS_REVIEW_REQUIRED' });
      }

      return sendJson(response, 201, {
        paymentId: payment.id,
        status: 'pending',
        pix: {
          copyPaste: result.qrCode,
          qrCodeUrl: result.qrCodeUrl,
          expiresAt: result.expiresAt
        },
        environment: 'sandbox'
      });
    } catch (error) {
      const result = publicError(error);
      return sendJson(response, result.status, { error: result.code });
    }
  };
}

export default createPagBankPixHandler();
