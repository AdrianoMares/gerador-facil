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
