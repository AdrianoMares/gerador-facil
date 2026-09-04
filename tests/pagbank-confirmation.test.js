import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  reconcilePagBankPayment,
  validatePagBankReconciliationResponse
} from '../api/_pagbankReconciliation.js';
import { createPagBankPixStatusHandler } from '../api/payments/pagbank/pix/status.js';
import {
  createPagBankWebhookHandler,
  validPagBankWebhookSignature
} from '../api/payments/pagbank/webhook.js';
import {
  checkPagBankPixStatus,
  pollPagBankPixStatus
} from '../src/services/payments.js';

const orderId = '7e9f8d13-7f09-4ed1-aecb-a35d447f0e7a';
const paymentId = '14b585f1-5a49-4ee7-920b-d6bb499ab1a7';
const externalOrderId = 'ORDE_3D560F48-E086-4F3C-A5A1-B7AB7BEACC2C';
const externalPaymentId = 'CHAR_114DB991-F5EA-496A-8D2C-4497F53CED22';
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  PAGBANK_ENV: 'sandbox',
  PAGBANK_TOKEN: 'pagbank-secret'
};
const order = { id: orderId, user_id: 'user-id', status: 'pending_payment', total_cents: 4900, currency: 'BRL' };
const payment = {
  id: paymentId,
  order_id: orderId,
  provider: 'pagbank',
  provider_environment: 'sandbox',
  payment_method: 'pix',
  status: 'pending',
  amount_cents: 4900,
  currency: 'BRL',
  external_order_id: externalOrderId,
  external_payment_id: externalPaymentId,
  provider_status: null,
  order
};

function officialOrder(status = 'WAITING') {
  return {
    id: externalOrderId,
    reference_id: orderId,
    charges: [{
      id: externalPaymentId,
      reference_id: paymentId,
      status,
      amount: { value: 4900, currency: 'BRL' },
      payment_method: { type: 'PIX' }
    }]
  };
}

function providerFetch(calls, status = 'WAITING', mutate = () => {}) {
  return async (url, options) => {
    calls.push({ url, options });
    const body = officialOrder(status);
    mutate(body);
    return { ok: true, status: 200, async json() { return body; } };
  };
}

function backendFixture({ ownerId = 'user-id', fulfillmentError = null } = {}) {
  const calls = { clientKeys: [], filters: [], rpc: [], fetch: [] };
  const storedOrder = { ...order, user_id: ownerId };
  const storedPayment = { ...payment };

  function query(table) {
    const filters = [];
    const builder = {
      select() { return this; },
      eq(field, value) { filters.push([field, value]); calls.filters.push({ table, field, value }); return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() {
        if (table === 'orders') {
          const requestedUser = filters.find(([field]) => field === 'user_id')?.[1];
          const requestedId = filters.find(([field]) => field === 'id')?.[1];
          return {
            data: requestedId === storedOrder.id && (!requestedUser || requestedUser === storedOrder.user_id)
              ? storedOrder : null,
            error: null
          };
        }
        const requestedOrder = filters.find(([field]) => field === 'order_id')?.[1];
        const requestedExternal = filters.find(([field]) => field === 'external_order_id')?.[1];
        const matches = (!requestedOrder || requestedOrder === storedPayment.order_id)
          && (!requestedExternal || requestedExternal === storedPayment.external_order_id);
        return { data: matches ? storedPayment : null, error: null };
      }
    };
    return builder;
  }

  const backend = {
    from: query,
    async rpc(name, params) {
      calls.rpc.push({ name, params });
      if (name === 'confirm_verified_pagbank_payment') return { data: orderId, error: null };
      if (name === 'fulfill_paid_order') return { data: null, error: fulfillmentError };
      if (name === 'record_verified_pagbank_status') return { data: params.p_provider_status, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    }
  };

  const createClientImpl = (_url, key) => {
    calls.clientKeys.push(key);
    if (key === env.SUPABASE_PUBLISHABLE_KEY) {
      return { auth: { async getUser(token) {
        return token === 'valid-token'
          ? { data: { user: { id: 'user-id' } }, error: null }
          : { data: { user: null }, error: new Error('invalid') };
      } } };
    }
    assert.equal(key, env.SUPABASE_SERVICE_ROLE_KEY);
    return backend;
  };
  return { backend, calls, createClientImpl, storedOrder, storedPayment };
}

function invoke(handler, { authorization, body = { orderId }, rawBody, signature, method = 'POST' } = {}) {
  return new Promise((resolve, reject) => {
    const responseHeaders = {};
    const response = {
      setHeader(name, value) { responseHeaders[name] = value; },
      status(status) { this.statusCode = status; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload, headers: responseHeaders }); }
    };
    const headers = {};
    if (authorization) headers.authorization = authorization;
    if (signature) headers['x-authenticity-token'] = signature;
    if (rawBody) headers['content-length'] = String(rawBody.length);
    Promise.resolve(handler({ method, headers, body, rawBody }, response)).catch(reject);
  });
}

test('validação oficial rejeita qualquer divergência financeira, de vínculo ou método', () => {
  const mutations = [
    (body) => { body.id = 'ORDE_AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'; },
    (body) => { body.reference_id = 'another-order'; },
    (body) => { body.charges[0].id = 'CHAR_AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'; },
    (body) => { body.charges[0].reference_id = 'another-payment'; },
    (body) => { body.charges[0].amount.value = 1; },
    (body) => { body.charges[0].amount.currency = 'USD'; },
    (body) => { body.charges[0].payment_method.type = 'BOLETO'; }
  ];
  for (const mutate of mutations) {
    const body = officialOrder('PAID');
    mutate(body);
    assert.throws(() => validatePagBankReconciliationResponse(body, payment), /PAGBANK_VERIFICATION_MISMATCH/);
  }
});

test('WAITING registra consulta verificada sem confirmar ou cumprir pedido', async () => {
  const fixture = backendFixture();
  const result = await reconcilePagBankPayment({
    backend: fixture.backend,
    payment,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch)
  });
  assert.deepEqual(result, {
    orderStatus: 'pending_payment', paymentStatus: 'pending', providerStatus: 'WAITING', fulfillmentCompleted: false
  });
  assert.deepEqual(fixture.calls.rpc.map((call) => call.name), ['record_verified_pagbank_status']);
  assert.equal(fixture.calls.fetch[0].url, `https://sandbox.api.pagseguro.com/orders/${externalOrderId}`);
  assert.equal(fixture.calls.fetch[0].options.headers.Authorization, `Bearer ${env.PAGBANK_TOKEN}`);
});

test('DECLINED registra falha sem marcar order como paid', async () => {
  const fixture = backendFixture();
  const result = await reconcilePagBankPayment({
    backend: fixture.backend,
    payment,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'DECLINED')
  });
  assert.equal(result.orderStatus, 'pending_payment');
  assert.equal(result.paymentStatus, 'failed');
  assert.deepEqual(fixture.calls.rpc.map((call) => call.name), ['record_verified_pagbank_status']);
});

test('refund não implementado falha conservadoramente sem qualquer mutação', async () => {
  const fixture = backendFixture();
  await assert.rejects(reconcilePagBankPayment({
    backend: fixture.backend,
    payment,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'REFUNDED')
  }), /PAGBANK_VERIFICATION_MISMATCH/);
  assert.deepEqual(fixture.calls.rpc, []);
});

test('PAID confirma financeiramente antes do fulfillment', async () => {
  const fixture = backendFixture();
  const result = await reconcilePagBankPayment({
    backend: fixture.backend,
    payment,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'PAID')
  });
  assert.equal(result.orderStatus, 'paid');
  assert.equal(result.paymentStatus, 'paid');
  assert.deepEqual(fixture.calls.rpc.map((call) => call.name), [
    'confirm_verified_pagbank_payment', 'fulfill_paid_order'
  ]);
});

test('falha de fulfillment não reverte resultado financeiro pago', async () => {
  const fixture = backendFixture({ fulfillmentError: { message: 'operational error' } });
  const safeLogs = [];
  const result = await reconcilePagBankPayment({
    backend: fixture.backend,
    payment,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'PAID'),
    logError: (...args) => safeLogs.push(args)
  });
  assert.equal(result.paymentStatus, 'paid');
  assert.equal(result.orderStatus, 'paid');
  assert.equal(result.fulfillmentCompleted, false);
  assert.equal(JSON.stringify(safeLogs).includes(env.PAGBANK_TOKEN), false);
});

test('reconciliação posterior tenta novamente o fulfillment de pagamento já confirmado', async () => {
  const fixture = backendFixture();
  let fulfillmentAttempts = 0;
  const originalRpc = fixture.backend.rpc;
  fixture.backend.rpc = async (name, params) => {
    if (name === 'fulfill_paid_order') {
      fulfillmentAttempts += 1;
      return fulfillmentAttempts === 1
        ? { data: null, error: { message: 'temporary failure' } }
        : { data: null, error: null };
    }
    return originalRpc.call(fixture.backend, name, params);
  };
  const options = {
    backend: fixture.backend,
    payment: { ...payment, status: 'paid', order: { ...order, status: 'paid' } },
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'PAID'),
    logError: () => {}
  };
  assert.equal((await reconcilePagBankPayment(options)).fulfillmentCompleted, false);
  assert.equal((await reconcilePagBankPayment(options)).fulfillmentCompleted, true);
  assert.equal(fulfillmentAttempts, 2);
});

test('status exige JWT, aceita somente orderId e restringe o pedido ao dono', async () => {
  const fixture = backendFixture();
  const handler = createPagBankPixStatusHandler({ createClientImpl: fixture.createClientImpl, env });
  assert.equal((await invoke(handler)).status, 401);
  assert.equal((await invoke(handler, {
    authorization: 'Bearer valid-token', body: { orderId, externalOrderId }
  })).status, 400);

  const foreign = backendFixture({ ownerId: 'another-user' });
  const foreignResult = await invoke(createPagBankPixStatusHandler({
    createClientImpl: foreign.createClientImpl, env
  }), { authorization: 'Bearer valid-token' });
  assert.equal(foreignResult.status, 404);
  assert.equal(foreign.calls.fetch.length, 0);
});

test('status reconcilia Pix existente por GET com IDs exclusivamente do banco', async () => {
  const fixture = backendFixture();
  const result = await invoke(createPagBankPixStatusHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'PAID')
  }), { authorization: 'Bearer valid-token' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { orderStatus: 'paid', paymentStatus: 'paid', providerStatus: 'PAID' });
  assert.equal(fixture.calls.fetch[0].url, `https://sandbox.api.pagseguro.com/orders/${externalOrderId}`);
  assert.equal(fixture.calls.fetch[0].options.method, 'GET');
});

test('assinatura do webhook usa bytes crus e comparação segura', () => {
  const raw = Buffer.from('{\n  "id": "value"\n}\n');
  const signature = createHash('sha256').update(`${env.PAGBANK_TOKEN}-`).update(raw).digest('hex');
  assert.equal(validPagBankWebhookSignature(raw, signature, env.PAGBANK_TOKEN), true);
  assert.equal(validPagBankWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(raw))), signature, env.PAGBANK_TOKEN), false);
  assert.equal(validPagBankWebhookSignature(raw, 'not-a-hash', env.PAGBANK_TOKEN), false);
});

test('webhook rejeita assinatura ausente ou inválida sem tocar no banco', async () => {
  const fixture = backendFixture();
  const rawBody = Buffer.from(JSON.stringify(officialOrder('PAID')));
  const handler = createPagBankWebhookHandler({ createClientImpl: fixture.createClientImpl, env });
  assert.equal((await invoke(handler, { rawBody })).status, 401);
  assert.equal((await invoke(handler, { rawBody, signature: '0'.repeat(64) })).status, 403);
  assert.deepEqual(fixture.calls.clientKeys, []);
  assert.deepEqual(fixture.calls.fetch, []);
});

test('webhook antes da persistência dos IDs externos é ignorado sem consultar PagBank', async () => {
  const fixture = backendFixture();
  fixture.storedPayment.external_order_id = null;
  fixture.storedPayment.external_payment_id = null;
  const rawBody = Buffer.from(JSON.stringify(officialOrder('PAID')));
  const signature = createHash('sha256').update(`${env.PAGBANK_TOKEN}-`).update(rawBody).digest('hex');
  const result = await invoke(createPagBankWebhookHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'PAID')
  }), { rawBody, signature });
  assert.equal(result.status, 202);
  assert.deepEqual(fixture.calls.fetch, []);
  assert.deepEqual(fixture.calls.rpc, []);
});

test('webhook válido é só sinal: localiza conhecido e ainda consulta GET oficial', async () => {
  const fixture = backendFixture();
  const rawBody = Buffer.from(JSON.stringify(officialOrder('PAID'), null, 2));
  const signature = createHash('sha256').update(`${env.PAGBANK_TOKEN}-`).update(rawBody).digest('hex');
  const handler = createPagBankWebhookHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'PAID')
  });
  const first = await invoke(handler, { rawBody, signature });
  const duplicate = await invoke(handler, { rawBody, signature });
  assert.equal(first.status, 200);
  assert.equal(duplicate.status, 200);
  assert.equal(fixture.calls.fetch.length, 2);
  assert.ok(fixture.calls.fetch.every((call) => call.options.method === 'GET'));
});

test('PAID no webhook não confirma quando o GET oficial ainda responde WAITING', async () => {
  const fixture = backendFixture();
  const rawBody = Buffer.from(JSON.stringify(officialOrder('PAID')));
  const signature = createHash('sha256').update(`${env.PAGBANK_TOKEN}-`).update(rawBody).digest('hex');
  const result = await invoke(createPagBankWebhookHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: providerFetch(fixture.calls.fetch, 'WAITING')
  }), { rawBody, signature });
  assert.equal(result.status, 200);
  assert.deepEqual(fixture.calls.rpc.map((call) => call.name), ['record_verified_pagbank_status']);
  assert.equal(fixture.calls.rpc.some((call) => call.name === 'confirm_verified_pagbank_payment'), false);
});

test('cliente de status envia somente orderId e polling para em paid', async () => {
  const requests = [];
  const statuses = ['WAITING', 'PAID'];
  const fetchImpl = async (_url, options) => {
    requests.push(options);
    const providerStatus = statuses.shift();
    return { ok: true, async json() {
      return {
        orderStatus: providerStatus === 'PAID' ? 'paid' : 'pending_payment',
        paymentStatus: providerStatus === 'PAID' ? 'paid' : 'pending',
        providerStatus
      };
    } };
  };
  const result = await pollPagBankPixStatus(orderId, {
    intervalMs: 10,
    maxDurationMs: 100,
    wait: async () => {},
    fetchImpl,
    getSession: async () => ({ access_token: 'browser-token' })
  });
  assert.equal(result.timedOut, false);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => JSON.stringify(JSON.parse(request.body)) === JSON.stringify({ orderId })));
  assert.ok(requests.every((request) => request.headers.Authorization === 'Bearer browser-token'));
});

test('polling tem limite e libera verificação manual pelo mesmo endpoint', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, async json() {
      return { orderStatus: 'pending_payment', paymentStatus: 'pending', providerStatus: 'WAITING' };
    } };
  };
  const result = await pollPagBankPixStatus(orderId, {
    intervalMs: 10,
    maxDurationMs: 30,
    wait: async () => {},
    fetchImpl,
    getSession: async () => ({ access_token: 'browser-token' })
  });
  assert.equal(result.timedOut, true);
  assert.equal(calls, 3);
  assert.equal((await checkPagBankPixStatus(orderId, {
    fetchImpl,
    getSession: async () => ({ access_token: 'browser-token' })
  })).providerStatus, 'WAITING');
});

test('migration separa finanças, fulfillment genérico e idempotência backend-only', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260904000000_confirm_pagbank_payments.sql', import.meta.url), 'utf8');
  for (const column of ['provider_status text', 'provider_verified_at timestamptz', 'paid_at timestamptz']) {
    assert.match(migration, new RegExp(column));
  }
  assert.match(migration, /create function public\.confirm_verified_pagbank_payment\(p_payment_id uuid\)/);
  assert.match(migration, /select \* into v_payment[\s\S]*for update/);
  assert.match(migration, /select \* into v_order[\s\S]*for update/);
  assert.match(migration, /v_order\.status not in \('pending_payment', 'paid'\)/);
  assert.match(migration, /v_payment\.status not in \('pending', 'paid'\)/);
  assert.match(migration, /provider_status = 'PAID'/);
  assert.match(migration, /paid_at = coalesce\(paid_at, statement_timestamp\(\)\)/);
  assert.match(migration, /update public\.payments[\s\S]*update public\.orders/);
  assert.match(migration, /create function public\.record_verified_pagbank_status/);
  assert.match(migration, /p_provider_status is null/);
  assert.match(migration, /p_provider_status = 'PAID'[\s\S]*PAID_REQUIRES_CONFIRMATION/);
  assert.match(migration, /create function public\.fulfill_paid_order\(p_order_id uuid\)/);
  assert.match(migration, /p\.product_type = 'tool'/);
  assert.match(migration, /p\.fulfillment_mode = 'document_download'/);
  assert.match(migration, /oi\.resource_type is not null/);
  assert.doesNotMatch(migration, /p\.active/);
  assert.match(migration, /on conflict \(order_id, product_id, resource_type, resource_id\)[\s\S]*do nothing/);
  assert.match(migration, /perform \* from public\.fulfill_paid_service_order/);
  for (const fn of ['confirm_verified_pagbank_payment\\(uuid\\)', 'record_verified_pagbank_status\\(uuid, text\\)', 'fulfill_paid_order\\(uuid\\)']) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\s+from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\s+to service_role`));
  }
});

test('checkout só oferece PDF depois do entitlement e expõe confirmação e ação manual', () => {
  const checkout = readFileSync(new URL('../src/app/routes/CheckoutPage.jsx', import.meta.url), 'utf8');
  assert.match(checkout, /state\.entitlements\.some/);
  assert.match(checkout, />Pagamento confirmado</);
  assert.match(checkout, /Verificar pagamento/);
  assert.match(checkout, /pollPagBankPixStatus/);
  assert.doesNotMatch(checkout, /PAGBANK_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(checkout, /PAGBANK_WEBHOOK_URL|external_order_id|external_payment_id/);
  const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(envExample, /^PAGBANK_WEBHOOK_URL=$/m);
  assert.doesNotMatch(envExample, /VITE_PAGBANK_(?:TOKEN|WEBHOOK_URL)/);
});
