import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createServicePurchaseFlow } from '../src/services/servicePurchaseFlow.js';

const productCode = 'declaracao_anual_mei';
const checkoutUrl = '/checkout/order-id';

function createFlow(overrides = {}) {
  return createServicePurchaseFlow({
    createSession: async () => ({ access_token: 'anonymous-token' }),
    createOrder: async () => ({ orderId: 'order-id', checkoutUrl }),
    getSession: async () => null,
    recordAcceptances: async () => {},
    ...overrides
  });
}

test('visitante sem sessão recebe o fluxo de Turnstile antes dos aceites e do pedido', async () => {
  let acceptanceCalls = 0;
  let orderCalls = 0;
  const flow = createFlow({
    recordAcceptances: async () => { acceptanceCalls += 1; },
    createOrder: async () => { orderCalls += 1; return { checkoutUrl }; }
  });

  assert.deepEqual(await flow.start(productCode), { status: 'captcha-required' });
  assert.equal(flow.getState(), 'captcha-required');
  assert.equal(acceptanceCalls, 0);
  assert.equal(orderCalls, 0);
});

test('sucesso no Turnstile cria sessão e continua automaticamente na ordem correta', async () => {
  const calls = [];
  const flow = createFlow({
    createSession: async (captchaToken) => {
      calls.push(['session', captchaToken]);
      return { access_token: 'anonymous-token' };
    },
    recordAcceptances: async () => { calls.push(['acceptances']); },
    createOrder: async (payload) => {
      calls.push(['order', payload]);
      return { checkoutUrl };
    }
  });

  await flow.start(productCode);
  const result = await flow.completeCaptcha(productCode, 'turnstile-token');

  assert.deepEqual(result, { status: 'completed', checkoutUrl });
  assert.deepEqual(calls, [
    ['session', 'turnstile-token'],
    ['acceptances'],
    ['order', { productCode, resourceId: null }]
  ]);
});

test('sessão existente ignora o Turnstile e cria o pedido normalmente', async () => {
  let sessionCreationCalls = 0;
  const flow = createFlow({
    getSession: async () => ({ access_token: 'existing-token' }),
    createSession: async () => {
      sessionCreationCalls += 1;
      return { access_token: 'anonymous-token' };
    }
  });

  assert.deepEqual(await flow.start(productCode), { status: 'completed', checkoutUrl });
  assert.equal(sessionCreationCalls, 0);
});

test('erro de sessão anônima permite nova verificação sem novo clique de contratação', async () => {
  let attempts = 0;
  const flow = createFlow({
    createSession: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('captcha expirado');
      return { access_token: 'anonymous-token' };
    }
  });

  await flow.start(productCode);
  await assert.rejects(flow.completeCaptcha(productCode, 'expired-token'), /captcha expirado/);
  assert.equal(flow.getState(), 'captcha-required');
  assert.deepEqual(
    await flow.completeCaptcha(productCode, 'new-token'),
    { status: 'completed', checkoutUrl }
  );
});

test('clique duplo e callback repetido não criam pedido duplicado', async () => {
  let releaseSession;
  let orderCalls = 0;
  const flow = createFlow({
    createSession: async () => new Promise((resolve) => { releaseSession = resolve; }),
    createOrder: async () => {
      orderCalls += 1;
      return { checkoutUrl };
    }
  });

  const firstStart = flow.start(productCode);
  const repeatedStart = flow.start(productCode);
  assert.deepEqual(await repeatedStart, { status: 'ignored' });
  assert.deepEqual(await firstStart, { status: 'captcha-required' });

  const firstCaptcha = flow.completeCaptcha(productCode, 'turnstile-token');
  const repeatedCaptcha = flow.completeCaptcha(productCode, 'turnstile-token');
  assert.deepEqual(await repeatedCaptcha, { status: 'ignored' });

  releaseSession({ access_token: 'anonymous-token' });
  await firstCaptcha;
  assert.equal(orderCalls, 1);
});

test('falha nos aceites jurídicos impede a criação do pedido', async () => {
  let orderCalls = 0;
  const legalError = new Error('aceites obrigatórios');
  legalError.code = 'LEGAL_ACCEPTANCE_REQUIRED';
  const flow = createFlow({
    getSession: async () => ({ access_token: 'existing-token' }),
    recordAcceptances: async () => { throw legalError; },
    createOrder: async () => {
      orderCalls += 1;
      return { checkoutUrl };
    }
  });

  await assert.rejects(flow.start(productCode), (error) => error.code === 'LEGAL_ACCEPTANCE_REQUIRED');
  assert.equal(orderCalls, 0);
  assert.equal(flow.getState(), 'idle');
});

test('UNAUTHORIZED de sessão inválida oferece nova verificação e recupera o fluxo', async () => {
  let acceptanceCalls = 0;
  let orderCalls = 0;
  const unauthorized = new Error('sessão inválida');
  unauthorized.code = 'UNAUTHORIZED';
  const flow = createFlow({
    getSession: async () => ({ access_token: 'invalid-token' }),
    recordAcceptances: async () => {
      acceptanceCalls += 1;
      if (acceptanceCalls === 1) throw unauthorized;
    },
    createOrder: async () => {
      orderCalls += 1;
      return { checkoutUrl };
    }
  });

  await assert.rejects(flow.start(productCode), (error) => error.code === 'UNAUTHORIZED');
  assert.equal(flow.getState(), 'captcha-required');
  assert.deepEqual(
    await flow.completeCaptcha(productCode, 'renewal-token'),
    { status: 'completed', checkoutUrl }
  );
  assert.equal(orderCalls, 1);
});

test('card usa a chave pública existente e renova o widget em erro ou expiração', () => {
  const purchase = readFileSync(new URL('../src/components/ServicePurchase.jsx', import.meta.url), 'utf8');
  const flow = readFileSync(new URL('../src/services/servicePurchaseFlow.js', import.meta.url), 'utf8');
  const anonymousSession = readFileSync(new URL('../src/services/anonymousSession.js', import.meta.url), 'utf8');
  const documentDrafts = readFileSync(new URL('../src/services/documentDrafts.js', import.meta.url), 'utf8');

  assert.match(purchase, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(purchase, /<Turnstile/);
  assert.match(purchase, /onError=\{handleCaptchaFailure\}/);
  assert.match(purchase, /onExpire=\{handleCaptchaFailure\}/);
  assert.match(purchase, /setCaptchaKey\(\(key\) => key \+ 1\)/);
  assert.match(purchase, /purchasePending[\s\S]*!canStartServicePurchase/);
  assert.match(anonymousSession, /signInAnonymously/);
  assert.match(anonymousSession, /options: \{ captchaToken \}/);
  assert.match(documentDrafts, /createAnonymousSession/);
  assert.doesNotMatch(flow, /documentDraft/i);
  assert.doesNotMatch(purchase, /TURNSTILE_SECRET_KEY/);
  assert.doesNotMatch(anonymousSession, /TURNSTILE_SECRET_KEY/);
});
