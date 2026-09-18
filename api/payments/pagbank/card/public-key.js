import { createClient } from '@supabase/supabase-js';
import { bearerToken, sendJson } from '../../../_documentAiAuth.js';
import { pagBankApiBaseUrl, requirePagBankEnvironment } from '../../../_pagbankEnvironment.js';
const PAGBANK_TIMEOUT_MS = 12_000;
const EXPECTED_WEBHOOK = 'https://www.resodi.com.br/api/payments/pagbank/webhook';
const EXPECTED_PUBLIC_URL = 'https://www.resodi.com.br';

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function authClient(createClientImpl, env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function serviceClient(createClientImpl, env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('PAYMENT_NOT_CONFIGURED');
  return createClientImpl(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

async function fetchProviderPublicKey(fetchImpl, env) {
  const environment = requirePagBankEnvironment(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
  let providerResponse;
  try {
    providerResponse = await fetchImpl(`${pagBankApiBaseUrl(env)}/public-keys/card`, {
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
  return { publicKey, environment };
}

async function readiness(createClientImpl, fetchImpl, env) {
  let pagBankTokenAccepted = false;
  let cardPublicKeyReady = false;
  let pagBankPublicKeyHttpStatus = null;
  let supabaseConnectivity = false;

  if (env.PAGBANK_ENV === 'production' && present(env.PAGBANK_TOKEN)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${pagBankApiBaseUrl(env)}/public-keys/card`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${env.PAGBANK_TOKEN}`, Accept: 'application/json' },
        signal: controller.signal
      });
      pagBankPublicKeyHttpStatus = response.status;
      pagBankTokenAccepted = response.status !== 401 && response.status !== 403;
      if (response.ok && response.status === 200) {
        try {
          const body = await response.json();
          cardPublicKeyReady = present(body?.public_key);
        } catch {
          cardPublicKeyReady = false;
        }
      }
    } catch {
      pagBankTokenAccepted = false;
      cardPublicKeyReady = false;
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    const backend = serviceClient(createClientImpl, env);
    const { error } = await backend
      .from('products')
      .select('id', { head: true, count: 'exact' })
      .eq('active', true);
    supabaseConnectivity = !error;
  } catch {
    supabaseConnectivity = false;
  }

  const checks = {
    productionEnvironment: env.PAGBANK_ENV === 'production',
    pagBankTokenPresent: present(env.PAGBANK_TOKEN),
    pagBankTokenAccepted,
    cardPublicKeyReady,
    pagBankPublicKeyHttpStatus,
    webhookConfigured: env.PAGBANK_WEBHOOK_URL === EXPECTED_WEBHOOK,
    homologationLogsEnabled: env.PAGBANK_HOMOLOGATION_LOGS === 'true',
    serviceCheckoutEnabled: env.SERVICE_CHECKOUT_ENABLED === 'true',
    frontendCheckoutEnabled: env.VITE_SERVICE_CHECKOUT_ENABLED === 'true',
    frontendPagBankEnabled: env.VITE_PAGBANK_ENABLED === 'true',
    frontendPagBankProduction: env.VITE_PAGBANK_ENV === 'production',
    turnstileSiteKeyPresent: present(env.VITE_TURNSTILE_SITE_KEY),
    turnstileSecretPresent: present(env.TURNSTILE_SECRET_KEY),
    supabaseUrlPresent: present(env.SUPABASE_URL || env.VITE_SUPABASE_URL),
    supabasePublishableKeyPresent: present(env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY),
    supabaseServiceRolePresent: present(env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseConnectivity,
    publicUrlConfigured: env.RESODI_PUBLIC_URL === EXPECTED_PUBLIC_URL,
    resendApiKeyPresent: present(env.RESEND_API_KEY)
  };

  const critical = [
    'productionEnvironment',
    'pagBankTokenPresent',
    'pagBankTokenAccepted',
    'cardPublicKeyReady',
    'webhookConfigured',
    'homologationLogsEnabled',
    'serviceCheckoutEnabled',
    'frontendCheckoutEnabled',
    'frontendPagBankEnabled',
    'frontendPagBankProduction',
    'turnstileSiteKeyPresent',
    'turnstileSecretPresent',
    'supabaseUrlPresent',
    'supabasePublishableKeyPresent',
    'supabaseServiceRolePresent',
    'supabaseConnectivity',
    'publicUrlConfigured'
  ];

  return {
    ready: critical.every((key) => checks[key] === true),
    checks
  };
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

    if (request.query?.readiness === '1') {
      const result = await readiness(createClientImpl, fetchImpl, env);
      response.setHeader('Cache-Control', 'no-store');
      return sendJson(response, 200, result);
    }

    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    try {
      const auth = authClient(createClientImpl, env);
      const { data, error } = await auth.auth.getUser(accessToken);
      if (error || !data?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const { publicKey, environment } = await fetchProviderPublicKey(fetchImpl, env);
      return sendJson(response, 200, { publicKey, environment });
    } catch (error) {
      const code = error?.message;
      if (code === 'PAYMENT_NOT_CONFIGURED') return sendJson(response, 503, { error: 'SERVICE_NOT_CONFIGURED' });
      if (code === 'PUBLIC_KEY_NOT_CONFIGURED') return sendJson(response, 503, { error: code });
      return sendJson(response, 502, { error: 'PUBLIC_KEY_UNAVAILABLE' });
    }
  };
}

export default createPagBankCardPublicKeyHandler();
