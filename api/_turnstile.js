const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5_000;
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;

function validationError(code) {
  return new Error(code);
}

function requestHeader(request, name) {
  const headers = request?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  return headers[name] || headers[name.toLowerCase()] || '';
}

function firstHeaderValue(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' ? candidate.split(',')[0].trim() : '';
}

function clientIp(request) {
  const candidate = firstHeaderValue(requestHeader(request, 'x-forwarded-for'));
  const value = typeof candidate === 'string' ? candidate.split(',')[0].trim() : '';
  return value && value.length <= 64 && !/[\r\n]/.test(value) ? value : null;
}

function normalizeRequestHostname(value) {
  const candidate = firstHeaderValue(value);
  if (!candidate || candidate.length > 253 || /[\s\r\n/@?#]/.test(candidate)) return null;
  const match = candidate.match(/^([^:]+)(?::(\d{1,5}))?$/);
  if (!match || (match[2] && Number(match[2]) > 65_535)) return null;
  const hostname = match[1].toLowerCase();
  if (!hostname || hostname.endsWith('.')
    || !hostname.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    return null;
  }
  return hostname;
}

function normalizeCloudflareHostname(value) {
  if (typeof value !== 'string' || value.length > 253 || /[\s\r\n/:@?#]/.test(value)) return null;
  const hostname = value.toLowerCase();
  if (!hostname || hostname.endsWith('.')
    || !hostname.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    return null;
  }
  return hostname;
}

function requestHostname(request) {
  const forwardedHost = requestHeader(request, 'x-forwarded-host');
  return normalizeRequestHostname(forwardedHost || requestHeader(request, 'host'));
}

export async function verifyTurnstileToken(token, {
  env = process.env,
  fetchImpl = fetch,
  request,
  timeoutMs = TURNSTILE_TIMEOUT_MS,
  expectedAction = 'checkout_payment'
} = {}) {
  const secret = typeof env.TURNSTILE_SECRET_KEY === 'string'
    ? env.TURNSTILE_SECRET_KEY.trim()
    : '';
  if (!secret) throw validationError('SECURITY_VALIDATION_NOT_CONFIGURED');

  if (typeof token !== 'string' || !token.trim() || token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    throw validationError('TURNSTILE_VALIDATION_FAILED');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const remoteIp = clientIp(request);
    const verificationResponse = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {})
      }),
      signal: controller.signal
    });

    if (!verificationResponse.ok) throw validationError('SECURITY_VALIDATION_UNAVAILABLE');

    let result;
    try {
      result = await verificationResponse.json();
    } catch {
      throw validationError('SECURITY_VALIDATION_UNAVAILABLE');
    }

    const expectedHostname = requestHostname(request);
    const actualHostname = normalizeCloudflareHostname(result?.hostname);
    if (result?.success === true
      && (!expectedAction || result.action === expectedAction)
      && expectedHostname
      && actualHostname === expectedHostname) return true;
    if (Array.isArray(result?.['error-codes']) && result['error-codes'].includes('internal-error')) {
      throw validationError('SECURITY_VALIDATION_UNAVAILABLE');
    }
    throw validationError('TURNSTILE_VALIDATION_FAILED');
  } catch (error) {
    if (['TURNSTILE_VALIDATION_FAILED', 'SECURITY_VALIDATION_UNAVAILABLE'].includes(error?.message)) {
      throw error;
    }
    throw validationError('SECURITY_VALIDATION_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}
