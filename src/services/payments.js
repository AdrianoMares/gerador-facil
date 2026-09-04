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
