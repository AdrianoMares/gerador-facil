const PAGBANK_SANDBOX_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_TIMEOUT_MS = 12_000;
const PAGBANK_ORDER_PATTERN = /^ORDE_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGBANK_CHARGE_PATTERN = /^CHAR_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_STATUSES = new Set(['WAITING', 'PAID', 'DECLINED', 'CANCELED', 'IN_ANALYSIS', 'AUTHORIZED']);

function validLocalContext(payment) {
  const order = payment?.order;
  return payment?.provider === 'pagbank'
    && payment.provider_environment === 'sandbox'
    && payment.payment_method === 'pix'
    && PAGBANK_ORDER_PATTERN.test(payment.external_order_id || '')
    && PAGBANK_CHARGE_PATTERN.test(payment.external_payment_id || '')
    && order
    && payment.order_id === order.id
    && payment.amount_cents === order.total_cents
    && payment.currency === 'BRL'
    && order.currency === 'BRL';
}

export function validatePagBankReconciliationResponse(payload, payment) {
  if (!validLocalContext(payment)
    || !payload || typeof payload !== 'object'
    || payload.id !== payment.external_order_id
    || payload.reference_id !== payment.order.id) {
    throw new Error('PAGBANK_VERIFICATION_MISMATCH');
  }

  const charge = Array.isArray(payload.charges)
    ? payload.charges.find((entry) => entry?.id === payment.external_payment_id)
    : null;

  if (!charge
    || charge.reference_id !== payment.id
    || charge.amount?.value !== payment.amount_cents
    || charge.amount?.value !== payment.order.total_cents
    || charge.amount?.currency !== 'BRL'
    || charge.payment_method?.type !== 'PIX'
    || !PROVIDER_STATUSES.has(charge.status)) {
    throw new Error('PAGBANK_VERIFICATION_MISMATCH');
  }

  return { providerStatus: charge.status };
}

async function fetchOfficialOrder(fetchImpl, env, externalOrderId) {
  if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
  try {
    const response = await fetchImpl(
      `${PAGBANK_SANDBOX_URL}/orders/${encodeURIComponent(externalOrderId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.PAGBANK_TOKEN}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      }
    );
    if (!response.ok || response.status !== 200) throw new Error('PAGBANK_RECONCILIATION_UNAVAILABLE');
    try {
      return await response.json();
    } catch {
      throw new Error('PAGBANK_RECONCILIATION_UNAVAILABLE');
    }
  } finally {
    clearTimeout(timeout);
  }
}

function resultingPaymentStatus(providerStatus) {
  if (providerStatus === 'PAID') return 'paid';
  if (providerStatus === 'DECLINED') return 'failed';
  if (providerStatus === 'CANCELED') return 'cancelled';
  return 'pending';
}

export async function reconcilePagBankPayment({
  backend,
  payment,
  fetchImpl = fetch,
  env = process.env,
  logError = console.error
}) {
  if (!validLocalContext(payment)) throw new Error('INVALID_PAYMENT_CONTEXT');

  let payload;
  try {
    payload = await fetchOfficialOrder(fetchImpl, env, payment.external_order_id);
  } catch (error) {
    if (error?.message === 'PAYMENT_NOT_CONFIGURED') throw error;
    throw new Error('PAGBANK_RECONCILIATION_UNAVAILABLE', { cause: error });
  }

  const { providerStatus } = validatePagBankReconciliationResponse(payload, payment);

  if (providerStatus !== 'PAID') {
    const { error } = await backend.rpc('record_verified_pagbank_status', {
      p_payment_id: payment.id,
      p_provider_status: providerStatus
    });
    if (error) throw new Error('PAYMENT_PERSISTENCE_UNAVAILABLE');
    return {
      orderStatus: payment.order.status,
      paymentStatus: resultingPaymentStatus(providerStatus),
      providerStatus,
      fulfillmentCompleted: false
    };
  }

  const { data: orderId, error: confirmationError } = await backend.rpc(
    'confirm_verified_pagbank_payment',
    { p_payment_id: payment.id }
  );
  if (confirmationError || orderId !== payment.order.id) {
    throw new Error('PAYMENT_CONFIRMATION_UNAVAILABLE');
  }

  let fulfillmentCompleted = true;
  const { error: fulfillmentError } = await backend.rpc('fulfill_paid_order', { p_order_id: orderId });
  if (fulfillmentError) {
    fulfillmentCompleted = false;
    logError('PagBank fulfillment failed', { paymentId: payment.id, orderId, code: 'FULFILLMENT_FAILED' });
  }

  return {
    orderStatus: 'paid',
    paymentStatus: 'paid',
    providerStatus: 'PAID',
    fulfillmentCompleted
  };
}
