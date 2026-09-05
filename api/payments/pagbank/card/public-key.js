import { createClient } from '@supabase/supabase-js';
import { bearerToken, sendJson } from '../../../_documentAiAuth.js';

const PAGBANK_PUBLIC_KEY_URL = 'https://sandbox.api.pagseguro.com/public-keys/card';
const PAGBANK_TIMEOUT_MS = 12_000;

function authClient(createClientImpl, env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

export function createPagBankCardPublicKeyHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env
} = {}) {
  return async function pagBankCardPublicKey(request, response) {
    if (request.method !== 'GET') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' });
    }
    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    try {
      if (env.PAGBANK_ENV !== 'sandbox' || !env.PAGBANK_TOKEN) throw new Error('PAYMENT_NOT_CONFIGURED');
      const auth = authClient(createClientImpl, env);
      const { data, error } = await auth.auth.getUser(accessToken);
      if (error || !data?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
      let providerResponse;
      try {
        providerResponse = await fetchImpl(PAGBANK_PUBLIC_KEY_URL, {
          method: 'GET',
          headers: { Authorization: `Bearer ${env.PAGBANK_TOKEN}`, Accept: 'application/json' },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!providerResponse.ok || providerResponse.status !== 200) throw new Error('PUBLIC_KEY_NOT_CONFIGURED');
      let payload;
      try {
        payload = await providerResponse.json();
      } catch {
        throw new Error('PUBLIC_KEY_NOT_CONFIGURED');
      }
      const publicKey = payload?.public_key;
      if (typeof publicKey !== 'string' || publicKey.length < 100 || publicKey.length > 10_000) {
        throw new Error('PUBLIC_KEY_NOT_CONFIGURED');
      }
      return sendJson(response, 200, { publicKey, environment: 'sandbox' });
    } catch (error) {
      const code = error?.message;
      if (code === 'PAYMENT_NOT_CONFIGURED') return sendJson(response, 503, { error: 'SERVICE_NOT_CONFIGURED' });
      if (code === 'PUBLIC_KEY_NOT_CONFIGURED') return sendJson(response, 503, { error: code });
      return sendJson(response, 502, { error: 'PUBLIC_KEY_UNAVAILABLE' });
    }
  };
}

export default createPagBankCardPublicKeyHandler();
