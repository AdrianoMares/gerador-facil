const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5_000;
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;

function validationError(code) {
  return new Error(code);
}

function clientIp(request) {
  const forwarded = request?.headers?.['x-forwarded-for'];
  const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const value = typeof candidate === 'string' ? candidate.split(',')[0].trim() : '';
  return value && value.length <= 64 && !/[\r\n]/.test(value) ? value : null;
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

    if (result?.success === true && (!expectedAction || result.action === expectedAction)) return true;
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
