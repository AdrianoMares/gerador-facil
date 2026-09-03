import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckoutHandler } from '../api/checkout/create.js';
import { createCheckoutOrder } from '../src/services/commerce.js';

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key'
};
const orderId = '7e9f8d13-7f09-4ed1-aecb-a35d447f0e7a';

function invoke(handler, { method = 'POST', authorization, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    const response = {
      setHeader(name, value) { headers[name] = value; },
      status(status) { this.statusCode = status; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload, headers }); }
    };
    Promise.resolve(handler({ method, headers: authorization ? { authorization } : {}, body }, response)).catch(reject);
  });
}

function createClientImpl(calls) {
  return (_url, _key, options) => ({
    auth: {
      async getUser(token) {
        return token === 'valid-token'
          ? { data: { user: { id: 'user-id' } }, error: null }
          : { data: { user: null }, error: new Error('invalid') };
      }
    },
    async rpc(name, params) {
      calls.push({ name, params, options });
      return { data: orderId, error: null };
    }
  });
}

test('checkout rejeita métodos diferentes de POST', async () => {
  const result = await invoke(createCheckoutHandler(), { method: 'GET' });
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'POST');
});

test('checkout exige Bearer token', async () => {
  const result = await invoke(createCheckoutHandler(), { body: {} });
  assert.deepEqual(result, {
    status: 401,
    body: { error: 'UNAUTHORIZED' },
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' }
  });
});

test('checkout valida corpo, produto e resourceId antes de chamar RPC', async () => {
  const calls = [];
  const handler = createCheckoutHandler({ createClientImpl: createClientImpl(calls), env });
  const cases = [
    {},
    { productCode: '' },
    { productCode: 'receipt_pdf', resourceId: 'not-a-uuid' },
    { productCode: 'receipt_pdf', amount: 1 },
    { productCode: 'receipt_pdf', price: 1 },
    { productCode: 'receipt_pdf', total: 1 },
    { productCode: 'receipt_pdf', currency: 'BRL' },
    { productCode: 'receipt_pdf', status: 'paid' },
    { productCode: 'receipt_pdf', paid: true },
    { productCode: 'receipt_pdf', provider: 'anything' }
  ];

  for (const body of cases) {
    const result = await invoke(handler, { authorization: 'Bearer valid-token', body });
    assert.equal(result.status, 400);
  }
  assert.equal(calls.length, 0);
});

test('checkout encaminha somente produto e recurso à função segura', async () => {
  const calls = [];
  const handler = createCheckoutHandler({ createClientImpl: createClientImpl(calls), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: { productCode: 'receipt_pdf', resourceId: orderId }
  });

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { orderId, checkoutUrl: `/checkout/${orderId}` });
  assert.deepEqual(calls[0].params, { p_product_code: 'receipt_pdf', p_resource_id: orderId });
  assert.equal(JSON.stringify(calls[0].params).includes('price'), false);
  assert.equal(calls[0].options.global.headers.Authorization, 'Bearer valid-token');
});

test('checkout retorna a pendência jurídica resolvida pelo banco para serviços', async () => {
  const handler = createCheckoutHandler({
    env,
    createClientImpl: () => ({
      auth: { async getUser() { return { data: { user: { id: 'user-id' } }, error: null }; } },
      async rpc() { return { data: null, error: { message: 'LEGAL_ACCEPTANCE_REQUIRED' } }; }
    })
  });

  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: { productCode: 'future_service', resourceId: null }
  });

  assert.deepEqual(result, {
    status: 409,
    body: { error: 'LEGAL_ACCEPTANCE_REQUIRED' },
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' }
  });
});

test('serviço do frontend não envia valores financeiros e trata falha', async () => {
  let request;
  const result = await createCheckoutOrder(
    { productCode: 'receipt_pdf', resourceId: orderId },
    {
      getSession: async () => ({ access_token: 'browser-token' }),
      fetchImpl: async (_url, options) => {
        request = options;
        return { ok: true, async json() { return { orderId, checkoutUrl: `/checkout/${orderId}` }; } };
      }
    }
  );

  assert.equal(result.orderId, orderId);
  assert.deepEqual(JSON.parse(request.body), { productCode: 'receipt_pdf', resourceId: orderId });
  assert.equal(request.headers.Authorization, 'Bearer browser-token');

  await assert.rejects(
    createCheckoutOrder({ productCode: 'receipt_pdf', resourceId: orderId }, {
      getSession: async () => ({ access_token: 'browser-token' }),
      fetchImpl: async () => ({ ok: false, async json() { return { error: 'PRODUCT_NOT_AVAILABLE' }; } })
    }),
    (error) => error.code === 'PRODUCT_NOT_AVAILABLE'
  );
});
