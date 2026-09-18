import { createClient } from '@supabase/supabase-js';

const EXPECTED_WEBHOOK = 'https://www.resodi.com.br/api/payments/pagbank/webhook';
const EXPECTED_PUBLIC_URL = 'https://www.resodi.com.br';
const PAGBANK_PUBLIC_KEY_URL = 'https://api.pagseguro.com/public-keys/card';
const PAGBANK_TIMEOUT_MS = 10000;

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function checkSupabase(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!present(url) || !present(env.SUPABASE_SERVICE_ROLE_KEY)) return false;
  try {
    const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    const { error } = await client.from('products').select('id', { head: true, count: 'exact' }).eq('active', true);
    return !error;
  } catch {
    return false;
  }
}

async function checkPagBankToken(env) {
  if (env.PAGBANK_ENV !== 'production' || !present(env.PAGBANK_TOKEN)) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGBANK_TIMEOUT_MS);
  try {
    const response = await fetch(PAGBANK_PUBLIC_KEY_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.PAGBANK_TOKEN}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    if (!response.ok || response.status !== 200) return false;
    const body = await response.json();
    return present(body?.public_key);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const env = process.env;
  const [supabaseConnectivity, pagBankTokenValidated] = await Promise.all([
    checkSupabase(env),
    checkPagBankToken(env)
  ]);

  const checks = {
    productionEnvironment: env.PAGBANK_ENV === 'production',
    pagBankTokenPresent: present(env.PAGBANK_TOKEN),
    pagBankTokenValidated,
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

  return sendJson(response, 200, {
    ready: Object.values(checks).every(Boolean),
    checks
  });
}
