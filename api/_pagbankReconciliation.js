const PAGBANK_SANDBOX_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_TIMEOUT_MS = 12_000;
const PAGBANK_ORDER_PATTERN = /^ORDE_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGBANK_CHARGE_PATTERN = /^CHAR_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_STATUSES = new Set(['WAITING', 'PAID', 'DECLINED', 'CANCELED', 'IN_ANALYSIS', 'AUTHORIZED']);

function validOptionalId(value, pattern) {
  return value === null || value === undefined || pattern.test(value);
}

function validLocalContext(payment) {
  const order = payment?.order;
  return payment?.provider === 'pagbank'
    && payment.provider_environment === 'sandbox'
    && payment.payment_method === 'pix'
    && validOptionalId(payment.external_order_id, PAGBANK_ORDER_PATTERN)
    && validOptionalId(payment.external_payment_id, PAGBANK_CHARGE_PATTERN)
    && order
    && payment.order_id === order.id
    && Number.isInteger(payment.amount_cents)
    && payment.amount_cents > 0
    && Number.isInteger(payment.refunded_amount_cents)
    && payment.refunded_amount_cents >= 0
    && payment.refunded_amount_cents <= payment.amount_cents
    && payment.amount_cents === order.total_cents
    && payment.currency === 'BRL'
    && order.currency === 'BRL';
}

function expectedIdentifiers(payment, providerIdentifiers) {
  const externalOrderId = payment.external_order_id || providerIdentifiers?.externalOrderId;
  const externalPaymentId = payment.external_payment_id || providerIdentifiers?.externalPaymentId;
  if (!PAGBANK_ORDER_PATTERN.test(externalOrderId || '')
    || !PAGBANK_CHARGE_PATTERN.test(externalPaymentId || '')
    || (payment.external_order_id && providerIdentifiers?.externalOrderId
      && payment.external_order_id !== providerIdentifiers.externalOrderId)
    || (payment.external_payment_id && providerIdentifiers?.externalPaymentId
      && payment.external_payment_id !== providerIdentifiers.externalPaymentId)) {
    throw new Error('PAGBANK_VERIFICATION_MISMATCH');
  }
  return { externalOrderId, externalPaymentId };
}

export function validatePagBankReconciliationResponse(payload, payment, providerIdentifiers = null) {
  if (!validLocalContext(payment)) throw new Error('PAGBANK_VERIFICATION_MISMATCH');
  const identifiers = expectedIdentifiers(payment, providerIdentifiers);
  if (!payload || typeof payload !== 'object'
    || payload.id !== identifiers.externalOrderId
    || payload.reference_id !== payment.order.id) {
    throw new Error('PAGBANK_VERIFICATION_MISMATCH');
  }

  const charge = Array.isArray(payload.charges)
    ? payload.charges.find((entry) => entry?.id === identifiers.externalPaymentId)
    : null;
  const originalAmount = charge?.amount?.value;
  const summary = charge?.amount?.summary;
  const refundedAmount = summary?.refunded;

  if (!charge
    || charge.reference_id !== payment.id
    || originalAmount !== payment.amount_cents
    || originalAmount !== payment.order.total_cents
    || charge.amount?.currency !== 'BRL'
    || charge.payment_method?.type !== 'PIX'
    || !PROVIDER_STATUSES.has(charge.status)
    || !summary || typeof summary !== 'object'
    || !Number.isInteger(summary.total) || summary.total !== originalAmount
    || !Number.isInteger(summary.paid) || summary.paid < 0 || summary.paid > originalAmount
    || !Number.isInteger(refundedAmount) || refundedAmount < 0 || refundedAmount > originalAmount
    || refundedAmount < payment.refunded_amount_cents) {
    throw new Error('PAGBANK_VERIFICATION_MISMATCH');
  }

  const isFullyRefunded = refundedAmount === originalAmount;
  const isPartiallyRefunded = refundedAmount > 0 && refundedAmount < originalAmount;
  // PagBank mantém refund parcial como PAID e representa o refund integral como CANCELED.
  const invalidFinancialSummary = (refundedAmount > 0 && summary.paid !== originalAmount)
    || (isPartiallyRefunded && charge.status !== 'PAID')
    || (isFullyRefunded && charge.status !== 'CANCELED')
    || (refundedAmount === 0 && charge.status === 'PAID' && summary.paid !== originalAmount)
    || (refundedAmount === 0 && charge.status !== 'PAID' && summary.paid !== 0);
  if (invalidFinancialSummary) throw new Error('PAGBANK_VERIFICATION_MISMATCH');

  return {
    providerStatus: charge.status,
    externalOrderId: identifiers.externalOrderId,
    externalPaymentId: identifiers.externalPaymentId,
    originalAmount,
    refundedAmount,
    isFullyRefunded,
    isPartiallyRefunded
  };
}

async function fetchOfficialOrder(fetchImpl, env, externalOrderId) {
  if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${PAGBANK_SANDBOX_URL}/orders/${encodeURIComponent(externalOrderId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.PAGBANK_TOKEN}`, Accept: 'application/json' },
      signal: controller.signal
    });
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

async function adoptVerifiedIds(backend, payment, verification) {
  if (payment.external_order_id && payment.external_payment_id) return payment;
  const { data: adoptedPaymentId, error } = await backend.rpc('adopt_verified_pagbank_payment_ids', {
    p_payment_id: payment.id,
    p_order_id: payment.order.id,
    p_external_order_id: verification.externalOrderId,
    p_external_payment_id: verification.externalPaymentId
  });
  if (error || adoptedPaymentId !== payment.id) throw new Error('PAYMENT_PERSISTENCE_UNAVAILABLE');
  return { ...payment, external_order_id: verification.externalOrderId, external_payment_id: verification.externalPaymentId };
}

async function fulfillPaidOrder({ backend, payment, orderId, logError }) {
  const { error } = await backend.rpc('fulfill_paid_order', { p_order_id: orderId });
  if (!error) return true;
  logError('PagBank fulfillment failed', { paymentId: payment.id, orderId, code: 'FULFILLMENT_FAILED' });
  return false;
}

export async function reconcilePagBankPayment({
  backend,
  payment,
  providerIdentifiers = null,
  fetchImpl = fetch,
  env = process.env,
  logError = console.error
}) {
  if (!validLocalContext(payment)) throw new Error('INVALID_PAYMENT_CONTEXT');
  const identifiers = expectedIdentifiers(payment, providerIdentifiers);

  let payload;
  try {
    payload = await fetchOfficialOrder(fetchImpl, env, identifiers.externalOrderId);
  } catch (error) {
    if (error?.message === 'PAYMENT_NOT_CONFIGURED') throw error;
    throw new Error('PAGBANK_RECONCILIATION_UNAVAILABLE', { cause: error });
  }

  const verification = validatePagBankReconciliationResponse(payload, payment, providerIdentifiers);
  payment = await adoptVerifiedIds(backend, payment, verification);

  if (verification.isFullyRefunded) {
    const { data: orderId, error } = await backend.rpc('refund_verified_pagbank_payment', {
      p_payment_id: payment.id,
      p_refunded_amount_cents: verification.refundedAmount,
      p_provider_status: verification.providerStatus
    });
    if (error || orderId !== payment.order.id) throw new Error('PAYMENT_REFUND_UNAVAILABLE');
    return { orderStatus: 'refunded', paymentStatus: 'refunded', providerStatus: verification.providerStatus, fulfillmentCompleted: false };
  }

  if (verification.isPartiallyRefunded) {
    const { data: orderId, error } = await backend.rpc('record_verified_pagbank_partial_refund', {
      p_payment_id: payment.id,
      p_refunded_amount_cents: verification.refundedAmount,
      p_provider_status: verification.providerStatus
    });
    if (error || orderId !== payment.order.id) throw new Error('PAYMENT_REFUND_UNAVAILABLE');
    const fulfillmentCompleted = await fulfillPaidOrder({ backend, payment, orderId, logError });
    return {
      orderStatus: 'paid',
      paymentStatus: 'paid',
      providerStatus: verification.providerStatus,
      fulfillmentCompleted
    };
  }

  if (payment.status === 'refunded' || payment.order.status === 'refunded') {
    throw new Error('PAGBANK_VERIFICATION_MISMATCH');
  }

  if (verification.providerStatus !== 'PAID') {
    const { error } = await backend.rpc('record_verified_pagbank_status', {
      p_payment_id: payment.id,
      p_provider_status: verification.providerStatus
    });
    if (error) throw new Error('PAYMENT_PERSISTENCE_UNAVAILABLE');
    const alreadyPaid = payment.status === 'paid' && payment.order.status === 'paid';
    return {
      orderStatus: alreadyPaid ? 'paid' : payment.order.status,
      paymentStatus: alreadyPaid ? 'paid' : resultingPaymentStatus(verification.providerStatus),
      providerStatus: verification.providerStatus,
      fulfillmentCompleted: false
    };
  }

  const { data: orderId, error: confirmationError } = await backend.rpc('confirm_verified_pagbank_payment', { p_payment_id: payment.id });
  if (confirmationError || orderId !== payment.order.id) throw new Error('PAYMENT_CONFIRMATION_UNAVAILABLE');

  const fulfillmentCompleted = await fulfillPaidOrder({ backend, payment, orderId, logError });

  return { orderStatus: 'paid', paymentStatus: 'paid', providerStatus: 'PAID', fulfillmentCompleted };
}
