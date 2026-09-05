import { getCommerceSession } from './commerce.js';

export async function createPagBankPix({ orderId, customer }, {
  fetchImpl = fetch,
  getSession = getCommerceSession
} = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    const error = new Error('Faça uma nova verificação para continuar.');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const response = await fetchImpl('/api/payments/pagbank/pix/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderId, customer })
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.environment !== 'sandbox' || !payload?.pix?.copyPaste) {
    const error = new Error('Não foi possível gerar o Pix de teste.');
    error.code = payload?.error || 'PIX_CREATE_UNAVAILABLE';
    throw error;
  }

  return payload;
}

export async function createPagBankBoleto({ orderId, customer, address }, options = {}) {
  const payload = await authenticatedRequest('/api/payments/pagbank/boleto/create', {
    method: 'POST',
    body: JSON.stringify({ orderId, customer, address })
  }, options);
  if (payload?.environment !== 'sandbox' || payload?.providerStatus !== 'WAITING'
    || !payload?.boleto?.digitableLine || !payload?.boleto?.url || !payload?.publicUrl) {
    const error = new Error('Não foi possível gerar o boleto.');
    error.code = 'BOLETO_CREATE_UNAVAILABLE';
    throw error;
  }
  return payload;
}

const PAGBANK_SDK_URL = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js';

async function authenticatedRequest(path, options = {}, { fetchImpl = fetch, getSession = getCommerceSession } = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    const error = new Error('Faça uma nova verificação para continuar.');
    error.code = 'UNAUTHORIZED';
    throw error;
  }
  const response = await fetchImpl(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error('Não foi possível processar o pagamento.');
    error.code = payload?.error || 'PAYMENT_UNAVAILABLE';
    throw error;
  }
  return payload;
}

export function cardBinFromNumber(number) {
  const digits = typeof number === 'string' ? number.replace(/\D/g, '') : '';
  return digits.length >= 6 ? digits.slice(0, 6) : '';
}

export async function getPagBankCardInstallments(orderId, cardBin, options = {}) {
  const payload = await authenticatedRequest('/api/payments/pagbank/card/installments', {
    method: 'POST',
    body: JSON.stringify({ orderId, cardBin })
  }, options);
  if (payload?.environment !== 'sandbox' || !Array.isArray(payload.installments)) {
    const error = new Error('Não foi possível calcular as parcelas.');
    error.code = 'CARD_INSTALLMENTS_UNAVAILABLE';
    throw error;
  }
  return payload.installments;
}

async function getPagBankCardPublicKey(options = {}) {
  const payload = await authenticatedRequest('/api/payments/pagbank/card/public-key', { method: 'GET' }, options);
  if (payload?.environment !== 'sandbox' || typeof payload.publicKey !== 'string') {
    const error = new Error('A chave de cartão do ambiente de teste não está configurada.');
    error.code = 'PUBLIC_KEY_NOT_CONFIGURED';
    throw error;
  }
  return payload.publicKey;
}

function loadPagBankSdk(documentImpl = document) {
  if (globalThis.PagSeguro?.encryptCard) return Promise.resolve(globalThis.PagSeguro);
  return new Promise((resolve, reject) => {
    const existing = documentImpl.querySelector(`script[src="${PAGBANK_SDK_URL}"]`);
    const script = existing || documentImpl.createElement('script');
    const loaded = () => globalThis.PagSeguro?.encryptCard
      ? resolve(globalThis.PagSeguro)
      : reject(new Error('PAGBANK_SDK_UNAVAILABLE'));
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', () => reject(new Error('PAGBANK_SDK_UNAVAILABLE')), { once: true });
    if (!existing) {
      script.src = PAGBANK_SDK_URL;
      script.async = true;
      documentImpl.head.appendChild(script);
    }
  });
}

export async function createPagBankCard({ orderId, customer, holder, card, installments }, options = {}) {
  const cardBin = cardBinFromNumber(card.number);
  if (!cardBin) {
    const error = new Error('Dados do cartão inválidos.');
    error.code = 'INVALID_CARD_DATA';
    throw error;
  }
  const [publicKey, sdk] = await Promise.all([
    getPagBankCardPublicKey(options),
    loadPagBankSdk(options.documentImpl)
  ]);
  const encrypted = sdk.encryptCard({
    publicKey,
    holder: holder.name,
    number: card.number.replace(/\D/g, ''),
    expMonth: card.expMonth,
    expYear: card.expYear,
    securityCode: card.securityCode
  });
  if (encrypted?.hasErrors || typeof encrypted?.encryptedCard !== 'string') {
    const error = new Error('Dados do cartão inválidos.');
    error.code = 'INVALID_CARD_DATA';
    throw error;
  }
  return authenticatedRequest('/api/payments/pagbank/card/create', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      customer,
      holder,
      encryptedCard: encrypted.encryptedCard,
      cardBin,
      installments
    })
  }, options);
}

export async function checkPagBankPixStatus(orderId, {
  fetchImpl = fetch,
  getSession = getCommerceSession,
  signal
} = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    const error = new Error('Faça uma nova verificação para continuar.');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const response = await fetchImpl('/api/payments/pagbank/pix/status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderId }),
    signal
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.orderStatus || !payload?.paymentStatus || !payload?.providerStatus) {
    const error = new Error('Não foi possível verificar o pagamento.');
    error.code = payload?.error || 'PAYMENT_STATUS_UNAVAILABLE';
    throw error;
  }
  return payload;
}

export async function checkPagBankCardStatus(orderId, options = {}) {
  const payload = await authenticatedRequest('/api/payments/pagbank/card/status', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
    signal: options.signal
  }, options);
  if (!payload?.orderStatus || !payload?.paymentStatus || !payload?.providerStatus) {
    const error = new Error('Não foi possível verificar o pagamento.');
    error.code = 'PAYMENT_STATUS_UNAVAILABLE';
    throw error;
  }
  return payload;
}

export async function getPublicOrderStatus(token, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl('/api/orders/public-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    signal
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.serviceName || !payload?.currency || !payload?.status) {
    const error = new Error('Não foi possível acessar este pedido.');
    error.code = payload?.error || 'ORDER_STATUS_UNAVAILABLE';
    throw error;
  }
  return payload;
}

const TERMINAL_ORDER_STATUSES = new Set(['paid', 'cancelled', 'expired', 'refunded']);
const TERMINAL_PAYMENT_STATUSES = new Set(['paid', 'failed', 'cancelled', 'expired', 'refunded']);

export async function pollPagBankPixStatus(orderId, {
  intervalMs = 4_000,
  maxDurationMs = 120_000,
  wait = (milliseconds, signal) => new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Polling aborted', 'AbortError'));
    }, { once: true });
  }),
  onUpdate = () => {},
  signal,
  ...requestOptions
} = {}) {
  const attempts = Math.max(1, Math.floor(maxDurationMs / intervalMs));
  let latest = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await wait(intervalMs, signal);
    if (signal?.aborted) throw new DOMException('Polling aborted', 'AbortError');
    latest = await checkPagBankPixStatus(orderId, { ...requestOptions, signal });
    onUpdate(latest);
    if (TERMINAL_ORDER_STATUSES.has(latest.orderStatus)
      || TERMINAL_PAYMENT_STATUSES.has(latest.paymentStatus)) {
      return { ...latest, timedOut: false };
    }
  }
  return { ...latest, timedOut: true };
}

export function pollPagBankCardStatus(orderId, options = {}) {
  return pollPaymentStatus(checkPagBankCardStatus, orderId, options);
}

async function pollPaymentStatus(checkStatus, orderId, {
  intervalMs = 4_000,
  maxDurationMs = 120_000,
  wait = (milliseconds, signal) => new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Polling aborted', 'AbortError'));
    }, { once: true });
  }),
  onUpdate = () => {},
  signal,
  ...requestOptions
} = {}) {
  const attempts = Math.max(1, Math.floor(maxDurationMs / intervalMs));
  let latest = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await wait(intervalMs, signal);
    if (signal?.aborted) throw new DOMException('Polling aborted', 'AbortError');
    latest = await checkStatus(orderId, { ...requestOptions, signal });
    onUpdate(latest);
    if (TERMINAL_ORDER_STATUSES.has(latest.orderStatus)
      || TERMINAL_PAYMENT_STATUSES.has(latest.paymentStatus)) return { ...latest, timedOut: false };
  }
  return { ...latest, timedOut: true };
}
