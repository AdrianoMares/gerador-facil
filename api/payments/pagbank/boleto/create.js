import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { bearerToken, requestContentLength, sendJson } from '../../../_documentAiAuth.js';
import { boletoGeneratedEmail, deliverTransactionalEmail } from '../../../_transactionalEmail.js';

const PAGBANK_SANDBOX_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 20 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGBANK_ORDER_PATTERN = /^ORDE_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGBANK_CHARGE_PATTERN = /^CHAR_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ALLOWED_BODY_FIELDS = new Set(['orderId', 'customer', 'address']);
const ALLOWED_CUSTOMER_FIELDS = new Set(['name', 'email', 'taxId']);
const ALLOWED_ADDRESS_FIELDS = new Set(['street', 'number', 'complement', 'locality', 'city', 'regionCode', 'postalCode']);
const REGION_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
};

function digits(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function objectWithOnly(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((field) => allowed.has(field));
}

function normalizedText(value, maxLength) {
  const result = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return result && result.length <= maxLength ? result : null;
}

function validTaxId(value) {
  return (value.length === 11 || value.length === 14) && !/^(\d)\1+$/.test(value);
}

export function validatePagBankBoletoInput(body) {
  if (!objectWithOnly(body, ALLOWED_BODY_FIELDS) || !UUID_PATTERN.test(body.orderId || '')) {
    throw new Error('INVALID_BODY');
  }
  if (!objectWithOnly(body.customer, ALLOWED_CUSTOMER_FIELDS)
    || !objectWithOnly(body.address, ALLOWED_ADDRESS_FIELDS)) throw new Error('INVALID_BODY');

  const name = normalizedText(body.customer.name, 30);
  const email = typeof body.customer.email === 'string' ? body.customer.email.trim().toLowerCase() : '';
  const taxId = digits(body.customer.taxId);
  const regionCode = typeof body.address.regionCode === 'string' ? body.address.regionCode.trim().toUpperCase() : '';
  const postalCode = digits(body.address.postalCode);
  const address = {
    street: normalizedText(body.address.street, 160),
    number: normalizedText(body.address.number, 20),
    complement: body.address.complement ? normalizedText(body.address.complement, 40) : null,
    locality: normalizedText(body.address.locality, 60),
    city: normalizedText(body.address.city, 90),
    regionCode,
    region: REGION_NAMES[regionCode],
    postalCode
  };

  if (!name || name.length < 3 || !name.includes(' ')) throw new Error('INVALID_CUSTOMER_NAME');
  if (email.length < 10 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('INVALID_CUSTOMER_EMAIL');
  }
  if (!validTaxId(taxId)) throw new Error('INVALID_CUSTOMER_TAX_ID');
  if (!address.street || !address.number || !address.locality || !address.city
    || !address.region || postalCode.length !== 8) throw new Error('INVALID_CUSTOMER_ADDRESS');

  return { orderId: body.orderId, customer: { name, email, taxId }, address };
}

export function boletoDueDate(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  const due = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 3));
  return due.toISOString().slice(0, 10);
}

export function buildPagBankBoletoPayload({ order, payment, customer, address, dueDate, notificationUrl }) {
  return {
    reference_id: order.id,
    customer: { name: customer.name, email: customer.email, tax_id: customer.taxId },
    items: order.order_items.map((item) => ({
      reference_id: item.id,
      name: item.product_name,
      quantity: item.quantity,
      unit_amount: item.unit_price_cents
    })),
    charges: [{
      reference_id: payment.id,
      description: 'Serviço digital Resodi',
      amount: { value: order.total_cents, currency: 'BRL' },
      payment_method: {
        type: 'BOLETO',
        boleto: {
          due_date: dueDate,
          days_until_expiration: '3',
          template: 'COBRANCA',
          instruction_lines: {
            line_1: 'Pague até a data de vencimento.',
            line_2: 'Após o vencimento, gere um novo boleto.'
          },
          holder: {
            name: customer.name,
            tax_id: customer.taxId,
            email: customer.email,
            address: {
              street: address.street,
              number: address.number,
              ...(address.complement ? { complement: address.complement } : {}),
              locality: address.locality,
              city: address.city,
              region: address.region,
              region_code: address.regionCode,
              country: 'BRA',
              postal_code: address.postalCode
            }
          }
        }
      }
    }],
    notification_urls: [notificationUrl]
  };
}

function officialBoletoUrl(links) {
  const href = Array.isArray(links)
    ? links.find((link) => ['SELF', 'CHARGE.BOLETO'].includes(link?.rel)
      && link?.media === 'application/pdf' && link?.type === 'GET')?.href
    : null;
  if (typeof href !== 'string') return null;
  try {
    const url = new URL(href);
    const officialHosts = new Set([
      'boleto.pagseguro.com.br',
      'boleto.digital-payments.pagseguro.com'
    ]);
    return url.protocol === 'https:' && officialHosts.has(url.hostname) && url.pathname.endsWith('.pdf')
      ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validatePagBankBoletoResponse(payload, {
  order,
  payment,
  dueDate,
  expectedExternalOrderId = null,
  expectedExternalPaymentId = null
}) {
  if (!payload || typeof payload !== 'object' || !PAGBANK_ORDER_PATTERN.test(payload.id || '')
    || (payload.reference_id !== undefined && payload.reference_id !== order.id)
    || (expectedExternalOrderId && payload.id !== expectedExternalOrderId)) {
    throw new Error('INVALID_PAGBANK_RESPONSE');
  }
  const charge = Array.isArray(payload.charges)
    ? payload.charges.find((entry) => entry?.reference_id === payment.id)
    : null;
  const boleto = charge?.payment_method?.boleto;
  const barcode = typeof boleto?.barcode === 'string' ? boleto.barcode.trim() : '';
  const formattedBarcode = typeof boleto?.formatted_barcode === 'string' ? boleto.formatted_barcode.trim() : '';
  const boletoUrl = officialBoletoUrl(charge?.links);
  if (!charge || !PAGBANK_CHARGE_PATTERN.test(charge.id || '')
    || (expectedExternalPaymentId && charge.id !== expectedExternalPaymentId)
    || charge.amount?.value !== order.total_cents || charge.amount?.currency !== 'BRL'
    || charge.payment_method?.type !== 'BOLETO' || charge.status !== 'WAITING'
    || boleto?.due_date !== dueDate || String(boleto?.days_until_expiration) !== '3'
    || !/^\d{44,60}$/.test(barcode) || !/^[\d. ]{44,80}$/.test(formattedBarcode)
    || !boletoUrl) throw new Error('INVALID_PAGBANK_RESPONSE');
  return {
    externalOrderId: payload.id,
    externalPaymentId: charge.id,
    providerStatus: 'WAITING',
    dueDate,
    barcode,
    formattedBarcode,
    boletoUrl
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

function publicOrderUrl(env, token) {
  let base = env.RESODI_PUBLIC_URL;
  if (!base && env.VERCEL_PROJECT_PRODUCTION_URL) base = `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (!base) base = 'https://www.resodi.com.br';
  const url = new URL(base);
  if (url.protocol !== 'https:') throw new Error('PAYMENT_NOT_CONFIGURED');
  return new URL(`/pedido/${encodeURIComponent(token)}`, url).toString();
}

async function loadContext(backend, orderId, paymentId, userId) {
  const [{ data: order, error: orderError }, { data: payment, error: paymentError }] = await Promise.all([
    backend.from('orders')
      .select('id, user_id, status, currency, total_cents, order_items(id, product_name, quantity, unit_price_cents, product:products(product_type, fulfillment_mode))')
      .eq('id', orderId).maybeSingle(),
    backend.from('payments')
      .select('id, order_id, provider, provider_environment, payment_method, provider_request_state, status, amount_cents, buyer_fee_cents, installments, currency, external_order_id, external_payment_id, boleto_due_date')
      .eq('id', paymentId).maybeSingle()
  ]);
  if (orderError || paymentError) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  const serviceItems = Array.isArray(order?.order_items) && order.order_items.length > 0
    && order.order_items.every((item) => item.product?.product_type === 'service'
      && item.product?.fulfillment_mode === 'service_request');
  if (!order || order.user_id !== userId) throw new Error('ORDER_NOT_FOUND');
  if (!serviceItems) throw new Error('BOLETO_NOT_AVAILABLE');
  if (order.status !== 'pending_payment') throw new Error('ORDER_NOT_PENDING_PAYMENT');
  if (!payment || payment.order_id !== order.id || payment.provider !== 'pagbank'
    || payment.provider_environment !== 'sandbox' || payment.payment_method !== 'boleto'
    || payment.status !== 'pending' || payment.amount_cents !== order.total_cents
    || payment.buyer_fee_cents !== 0 || payment.installments !== null
    || payment.currency !== 'BRL' || order.currency !== 'BRL') throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
  return { order, payment };
}

async function callPagBank(fetchImpl, env, method, paymentId, body, externalOrderId = null) {
  const suffix = externalOrderId ? `/orders/${encodeURIComponent(externalOrderId)}` : '/orders';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
  try {
    return await fetchImpl(`${PAGBANK_SANDBOX_URL}${suffix}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.PAGBANK_TOKEN}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json', 'x-idempotency-key': `resodi-${paymentId}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function publicError(error) {
  const code = error?.message;
  if (code === 'BODY_TOO_LARGE') return { status: 413, code };
  if (['INVALID_BODY', 'INVALID_CUSTOMER_NAME', 'INVALID_CUSTOMER_EMAIL', 'INVALID_CUSTOMER_TAX_ID', 'INVALID_CUSTOMER_ADDRESS'].includes(code)) {
    return { status: 400, code };
  }
  if (code === 'ORDER_NOT_FOUND') return { status: 404, code };
  if (['ORDER_NOT_PENDING_PAYMENT', 'PAYMENT_METHOD_IN_PROGRESS', 'BOLETO_CREATION_UNCERTAIN'].includes(code)) {
    return { status: 409, code };
  }
  if (code === 'BOLETO_NOT_AVAILABLE' || code === 'ORDER_CURRENCY_NOT_SUPPORTED') return { status: 422, code };
  if (code === 'PAYMENT_NOT_CONFIGURED') return { status: 503, code: 'SERVICE_NOT_CONFIGURED' };
  return { status: 502, code: 'BOLETO_CREATE_UNAVAILABLE' };
}

async function registerAccessToken(backend, context, userId, tokenHash) {
  const { data, error } = await backend.rpc('register_pagbank_boleto_access_token', {
    p_payment_id: context.payment.id,
    p_order_id: context.order.id,
    p_user_id: userId,
    p_token_hash: tokenHash
  });
  if (error || data !== true) throw new Error('PAYMENT_PERSISTENCE_UNAVAILABLE');
}

async function sendGeneratedEmail({ backend, context, result, publicUrl, fetchImpl, env, logError }) {
  const content = boletoGeneratedEmail({
    serviceName: context.order.order_items[0].product_name,
    amountCents: context.order.total_cents,
    dueDate: result.dueDate,
    digitableLine: result.formattedBarcode,
    publicUrl
  });
  await deliverTransactionalEmail({
    backend,
    orderId: context.order.id,
    emailType: 'boleto_generated',
    to: context.customerEmail,
    ...content,
    fetchImpl,
    env,
    logError
  });
}

export function createPagBankBoletoHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env,
  now = () => new Date(),
  randomBytesImpl = randomBytes,
  logError = console.error
} = {}) {
  return async function pagBankBoletoCreate(request, response) {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    if (requestContentLength(request) > MAX_BODY_BYTES) return sendJson(response, 413, { error: 'BODY_TOO_LARGE' });
    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    try {
      const input = validatePagBankBoletoInput(request.body);
      const notificationUrl = webhookUrl(env);
      if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY || !notificationUrl) {
        throw new Error('PAYMENT_NOT_CONFIGURED');
      }
      const auth = client(createClientImpl, env, env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);
      const { data: userData, error: userError } = await auth.auth.getUser(accessToken);
      if (userError || !userData?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });
      const backend = client(createClientImpl, env, env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: paymentId, error: prepareError } = await backend.rpc('prepare_pagbank_boleto_payment', {
        p_order_id: input.orderId,
        p_user_id: userData.user.id,
        p_name: input.customer.name,
        p_email: input.customer.email
      });
      if (prepareError) throw new Error(prepareError.message);
      if (!UUID_PATTERN.test(paymentId || '')) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');

      const context = await loadContext(backend, input.orderId, paymentId, userData.user.id);
      context.customerEmail = input.customer.email;
      const dueDate = context.payment.boleto_due_date || boletoDueDate(now());
      const publicToken = randomBytesImpl(32).toString('base64url');
      if (!TOKEN_PATTERN.test(publicToken)) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');
      const tokenHash = createHash('sha256').update(publicToken).digest('hex');
      const secureUrl = publicOrderUrl(env, publicToken);
      let result;

      if (context.payment.external_order_id && context.payment.external_payment_id) {
        const providerResponse = await callPagBank(
          fetchImpl, env, 'GET', context.payment.id, null, context.payment.external_order_id
        );
        if (!providerResponse.ok || providerResponse.status !== 200) throw new Error('BOLETO_CREATION_UNCERTAIN');
        result = validatePagBankBoletoResponse(await providerResponse.json(), {
          ...context,
          dueDate,
          expectedExternalOrderId: context.payment.external_order_id,
          expectedExternalPaymentId: context.payment.external_payment_id
        });
        await registerAccessToken(backend, context, userData.user.id, tokenHash);
      } else {
        if (context.payment.provider_request_state !== 'prepared') throw new Error('BOLETO_CREATION_UNCERTAIN');
        const { data: claimed, error: claimError } = await backend.rpc('claim_pagbank_boleto_submission', {
          p_payment_id: context.payment.id,
          p_order_id: context.order.id,
          p_user_id: userData.user.id
        });
        if (claimError) throw new Error(claimError.message);
        if (claimed !== true) throw new Error('BOLETO_CREATION_UNCERTAIN');

        const payload = buildPagBankBoletoPayload({
          ...context,
          customer: input.customer,
          address: input.address,
          dueDate,
          notificationUrl
        });
        let providerResponse;
        try {
          providerResponse = await callPagBank(fetchImpl, env, 'POST', context.payment.id, payload);
        } catch {
          await backend.from('payments').update({ provider_request_state: 'uncertain' }).eq('id', context.payment.id);
          throw new Error('BOLETO_CREATION_UNCERTAIN');
        }
        if (!providerResponse.ok || providerResponse.status !== 201) {
          const definitive = [400, 404, 422].includes(providerResponse.status);
          await backend.from('payments').update({
            provider_request_state: definitive ? 'failed' : 'uncertain',
            ...(definitive ? { status: 'failed' } : {})
          }).eq('id', context.payment.id);
          if (definitive) return sendJson(response, 422, { error: 'PAGBANK_REJECTED' });
          throw new Error('BOLETO_CREATION_UNCERTAIN');
        }
        result = validatePagBankBoletoResponse(await providerResponse.json(), { ...context, dueDate });
        const { data: recorded, error: recordError } = await backend.rpc('record_pagbank_boleto_creation', {
          p_payment_id: context.payment.id,
          p_order_id: context.order.id,
          p_external_order_id: result.externalOrderId,
          p_external_payment_id: result.externalPaymentId,
          p_due_date: result.dueDate,
          p_barcode: result.barcode,
          p_formatted_barcode: result.formattedBarcode,
          p_boleto_url: result.boletoUrl,
          p_token_hash: tokenHash
        });
        if (recordError || recorded !== context.payment.id) throw new Error('BOLETO_CREATION_UNCERTAIN');
      }

      await sendGeneratedEmail({ backend, context, result, publicUrl: secureUrl, fetchImpl, env, logError });
      return sendJson(response, 201, {
        status: 'pending',
        providerStatus: 'WAITING',
        boleto: {
          dueDate: result.dueDate,
          digitableLine: result.formattedBarcode,
          barcode: result.barcode,
          url: result.boletoUrl
        },
        publicUrl: secureUrl,
        environment: 'sandbox'
      });
    } catch (error) {
      const result = publicError(error);
      return sendJson(response, result.status, { error: result.code });
    }
  };
}

export default createPagBankBoletoHandler();
