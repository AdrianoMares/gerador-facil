import { createAnonymousSession, getSupabaseSession } from './anonymousSession.js';
import { createCheckoutOrder, recordServiceLegalAcceptances } from './commerce.js';

const CAPTCHA_REQUIRED = 'captcha-required';

export function createServicePurchaseFlow({
  createSession = createAnonymousSession,
  createOrder = createCheckoutOrder,
  getSession = getSupabaseSession,
  recordAcceptances = recordServiceLegalAcceptances
} = {}) {
  let state = 'idle';

  async function createOrderWithCurrentSession(productCode) {
    state = 'recording-acceptances';

    try {
      await recordAcceptances();
      state = 'creating-order';
      const { checkoutUrl } = await createOrder({ productCode, resourceId: null });
      state = 'completed';
      return { status: 'completed', checkoutUrl };
    } catch (error) {
      state = error?.code === 'UNAUTHORIZED' ? CAPTCHA_REQUIRED : 'idle';
      throw error;
    }
  }

  async function start(productCode) {
    if (state !== 'idle') return { status: 'ignored' };

    state = 'checking-session';

    try {
      const session = await getSession();
      if (!session?.access_token) {
        state = CAPTCHA_REQUIRED;
        return { status: CAPTCHA_REQUIRED };
      }
    } catch (error) {
      state = error?.code === 'UNAUTHORIZED' ? CAPTCHA_REQUIRED : 'idle';
      throw error;
    }

    return createOrderWithCurrentSession(productCode);
  }

  async function completeCaptcha(productCode, captchaToken) {
    if (state !== CAPTCHA_REQUIRED) return { status: 'ignored' };

    state = 'creating-session';

    try {
      const session = await createSession(captchaToken);
      if (!session?.access_token) {
        const error = new Error('A sessão anônima não foi criada.');
        error.code = 'UNAUTHORIZED';
        throw error;
      }
    } catch (error) {
      state = CAPTCHA_REQUIRED;
      throw error;
    }

    return createOrderWithCurrentSession(productCode);
  }

  function reset() {
    if (state !== 'completed') state = 'idle';
  }

  return {
    completeCaptcha,
    getState: () => state,
    reset,
    start
  };
}
