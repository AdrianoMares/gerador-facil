const PAGBANK_SANDBOX_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_TIMEOUT_MS = 12_000;

export const MAX_CARD_INSTALLMENTS = 5;
export const MIN_INSTALLMENT_CENTS = 500;

export function validCardBin(value) {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

function integerCents(value) {
  return Number.isInteger(value) && value > 0;
}

export function validatePagBankFeePlans(payload, baseAmount) {
  if (!integerCents(baseAmount) || !payload || typeof payload !== 'object') {
    throw new Error('INVALID_PAGBANK_FEES_RESPONSE');
  }
  const brands = payload.payment_methods?.credit_card;
  if (!brands || typeof brands !== 'object' || Array.isArray(brands)) {
    throw new Error('INVALID_PAGBANK_FEES_RESPONSE');
  }
  const brandEntries = Object.values(brands).filter((entry) => entry && typeof entry === 'object');
  if (brandEntries.length !== 1 || !Array.isArray(brandEntries[0].installment_plans)) {
    throw new Error('INVALID_PAGBANK_FEES_RESPONSE');
  }

  const seen = new Set();
  const plans = [];
  for (const plan of brandEntries[0].installment_plans) {
    const installments = plan?.installments;
    if (!Number.isInteger(installments) || installments < 1 || installments > MAX_CARD_INSTALLMENTS) continue;
    if (seen.has(installments)) throw new Error('INVALID_PAGBANK_FEES_RESPONSE');

    const installmentValue = plan.installment_value;
    const totalAmount = plan.amount?.value;
    const interestFree = plan.interest_free;
    const rawBuyerFee = plan.amount?.fees?.buyer?.interest?.total;
    const feeInstallments = plan.amount?.fees?.buyer?.interest?.installments;
    if (!integerCents(installmentValue) || installmentValue < MIN_INSTALLMENT_CENTS
      || !integerCents(totalAmount) || plan.amount?.currency !== 'BRL'
      || typeof interestFree !== 'boolean'
      || Math.abs((installmentValue * installments) - totalAmount) >= installments) {
      throw new Error('INVALID_PAGBANK_FEES_RESPONSE');
    }

    let buyerFee;
    if (installments === 1) {
      buyerFee = rawBuyerFee ?? 0;
      if (!interestFree || totalAmount !== baseAmount || buyerFee !== 0) {
        throw new Error('INVALID_PAGBANK_FEES_RESPONSE');
      }
    } else {
      buyerFee = rawBuyerFee;
      if (interestFree || !Number.isInteger(buyerFee) || buyerFee <= 0
        || totalAmount !== baseAmount + buyerFee
        || !Number.isInteger(feeInstallments) || feeInstallments < 1 || feeInstallments > installments) {
        throw new Error('INVALID_PAGBANK_FEES_RESPONSE');
      }
    }

    seen.add(installments);
    plans.push({
      installments,
      installmentValue,
      totalAmount,
      buyerFee,
      interestFree,
      buyerFeeInstallments: installments === 1 ? 0 : feeInstallments
    });
  }

  plans.sort((left, right) => left.installments - right.installments);
  if (plans.length === 0 || plans[0].installments !== 1) {
    throw new Error('INVALID_PAGBANK_FEES_RESPONSE');
  }
  return plans;
}

export async function fetchPagBankFeePlans(fetchImpl, env, baseAmount, cardBin) {
  if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN) throw new Error('PAYMENT_NOT_CONFIGURED');
  if (!validCardBin(cardBin)) throw new Error('INVALID_CARD_BIN');

  const query = new URLSearchParams({
    payment_methods: 'CREDIT_CARD',
    value: String(baseAmount),
    max_installments: String(MAX_CARD_INSTALLMENTS),
    max_installments_no_interest: '0',
    credit_card_bin: cardBin
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${PAGBANK_SANDBOX_URL}/charges/fees/calculate?${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.PAGBANK_TOKEN}`, Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok || response.status !== 200) throw new Error('PAGBANK_FEES_UNAVAILABLE');
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('PAGBANK_FEES_UNAVAILABLE');
    }
    return validatePagBankFeePlans(payload, baseAmount);
  } finally {
    clearTimeout(timeout);
  }
}
