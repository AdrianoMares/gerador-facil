import { supabase } from './supabase.js';

function requireSessionClient() {
  if (!supabase) throw new Error('Supabase não está configurado.');
  return supabase;
}

export async function getCommerceSession() {
  const client = await requireSessionClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function createCheckoutOrder({ productCode, resourceId }, {
  fetchImpl = fetch,
  getSession = getCommerceSession
} = {}) {
  if (typeof productCode !== 'string' || !productCode.trim()) {
    throw new Error('Produto inválido.');
  }

  if (resourceId !== null && resourceId !== undefined && typeof resourceId !== 'string') {
    throw new Error('Recurso inválido.');
  }

  const session = await getSession();
  if (!session?.access_token) {
    const error = new Error('Faça uma nova verificação para continuar.');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const response = await fetchImpl('/api/checkout/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productCode: productCode.trim(),
      resourceId: resourceId || null
    })
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.orderId || !payload?.checkoutUrl) {
    const error = new Error('Não foi possível criar o pedido.');
    error.code = payload?.error || 'CHECKOUT_UNAVAILABLE';
    throw error;
  }

  return payload;
}
