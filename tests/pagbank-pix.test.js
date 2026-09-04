import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildPagBankPixPayload,
  createPagBankPixHandler,
  validatePagBankPixInput,
  validatePagBankPixResponse
} from '../api/payments/pagbank/pix/create.js';
import { createPagBankPix } from '../src/services/payments.js';

const orderId = '7e9f8d13-7f09-4ed1-aecb-a35d447f0e7a';
const paymentId = '14b585f1-5a49-4ee7-920b-d6bb499ab1a7';
const itemId = 'c2d60910-f13f-442b-b9ae-c0ddde218e21';
const externalOrderId = 'ORDE_3D560F48-E086-4F3C-A5A1-B7AB7BEACC2C';
const externalPaymentId = 'CHAR_114DB991-F5EA-496A-8D2C-4497F53CED22';
const expiresAt = '2026-09-04T12:30:00.000Z';
const validBody = {
  orderId,
  customer: {
    name: 'Maria da Silva',
    email: 'maria@example.com',
    taxId: '529.982.247-25',
    phone: '(11) 99999-1234'
  }
};
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  PAGBANK_ENV: 'sandbox',
  PAGBANK_TOKEN: 'pagbank-secret'
};

function invoke(handler, { method = 'POST', authorization, body = validBody, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const responseHeaders = {};
    const response = {
      setHeader(name, value) { responseHeaders[name] = value; },
      status(status) { this.statusCode = status; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload, headers: responseHeaders }); }
    };
    const requestHeaders = authorization ? { ...headers, authorization } : headers;
    Promise.resolve(handler({ method, headers: requestHeaders, body }, response)).catch(reject);
  });
}

function pagBankResponse(status = 'WAITING') {
  return {
    id: externalOrderId,
    reference_id: orderId,
    charges: [{
      id: externalPaymentId,
      reference_id: paymentId,
      status,
      amount: { value: 4900, currency: 'BRL' },
      payment_method: { type: 'PIX', pix: { expiration_date: expiresAt } },
      metadata: { ps_order_id: externalOrderId },
      links: status === 'WAITING' ? [{
        rel: 'QRCODE.PNG',
        href: 'https://sandbox.api.pagseguro.com/qrcode/QRCO_123/png',
        media: 'image/png',
        type: 'GET'
      }] : [],
      ...(status === 'WAITING' ? { qr_code: { text: '000201-pix-test-code' } } : {})
    }]
  };
}

function backendFixture({
  orderStatus = 'pending_payment',
  userId = 'user-id',
  providerRequestState = 'prepared',
  storedExternalOrderId = null,
  storedExternalPaymentId = null,
  prepareError = null,
  failUpdates = 0
} = {}) {
  const calls = { clientKeys: [], rpc: [], claimResults: [], updates: [], fetch: [] };
  let remainingUpdateFailures = failUpdates;
  const order = {
    id: orderId,
    user_id: userId,
    status: orderStatus,
    currency: 'BRL',
    total_cents: 4900,
    order_items: [{ id: itemId, product_name: 'Produto do banco', quantity: 1, unit_price_cents: 4900 }]
  };
  const payment = {
    id: paymentId,
    order_id: orderId,
    provider: 'pagbank',
    provider_environment: 'sandbox',
    payment_method: 'pix',
    provider_request_state: providerRequestState,
    provider_request_started_at: null,
    status: 'pending',
    amount_cents: 4900,
    currency: 'BRL',
    external_order_id: storedExternalOrderId,
    external_payment_id: storedExternalPaymentId
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
    return {
      async rpc(name, params) {
        calls.rpc.push({ name, params });
        if (name === 'prepare_pagbank_pix_payment') {
          return prepareError ? { data: null, error: { message: prepareError } } : { data: paymentId, error: null };
        }
        assert.equal(name, 'claim_pagbank_pix_submission');
        const claimed = payment.provider_request_state === 'prepared'
          && payment.external_order_id === null
          && payment.external_payment_id === null;
        if (claimed) payment.provider_request_state = 'submitting';
        calls.claimResults.push(claimed);
        return { data: claimed, error: null };
      },
      from(table) {
        return {
          select() {
            return {
              eq() {
                return { async maybeSingle() {
                  return { data: table === 'orders' ? order : payment, error: null };
                } };
              }
            };
          },
          update(values) {
            return { async eq(_field, id) {
              calls.updates.push({ table, id, values });
              if (remainingUpdateFailures > 0) {
                remainingUpdateFailures -= 1;
                return { error: new Error('database unavailable') };
              }
              if (table === 'payments') Object.assign(payment, values);
              return { error: null };
            } };
          }
        };
      }
    };
  };

  return { calls, createClientImpl, order, payment };
}

function successfulFetch(calls, status = 'WAITING') {
  return async (url, options) => {
    calls.fetch.push({ url, options });
    return { ok: true, status: options.method === 'GET' ? 200 : 201, async json() { return pagBankResponse(status); } };
  };
}

test('entrada aceita apenas orderId e dados permitidos do pagador', () => {
  const input = validatePagBankPixInput(validBody);
  assert.deepEqual(input.customer.phone, { country: '55', area: '11', number: '999991234' });
  assert.equal(input.customer.taxId, '52998224725');

  for (const field of ['amount', 'price', 'total', 'currency', 'items', 'status', 'paid', 'provider', 'externalOrderId', 'externalPaymentId']) {
    assert.throws(() => validatePagBankPixInput({ ...validBody, [field]: 'browser-value' }));
  }
  assert.throws(() => validatePagBankPixInput({ ...validBody, customer: { ...validBody.customer, amount: 1 } }));
});

test('payload usa valores e itens do banco e expiração central de 30 minutos', () => {
  const customer = validatePagBankPixInput(validBody).customer;
  const order = {
    id: orderId,
    total_cents: 4900,
    currency: 'BRL',
    order_items: [{ id: itemId, product_name: 'Produto do banco', quantity: 1, unit_price_cents: 4900 }]
  };
  const payload = buildPagBankPixPayload({
    order,
    payment: { id: paymentId },
    customer,
    now: new Date('2026-09-04T12:00:00.000Z')
  });

  assert.deepEqual(payload.items, [{ reference_id: itemId, name: 'Produto do banco', quantity: 1, unit_amount: 4900 }]);
  assert.deepEqual(payload.charges[0].amount, { value: 4900, currency: 'BRL' });
  assert.equal(payload.charges[0].reference_id, paymentId);
  assert.equal(payload.charges[0].payment_method.pix.expiration_date, '2026-09-04T12:30:00.000Z');
  assert.equal('shipping' in payload, false);
  assert.equal('notification_urls' in payload, false);
});

test('resposta valida vínculo e extrai Pix Copia e Cola e PNG', () => {
  const result = validatePagBankPixResponse(pagBankResponse(), {
    order: { id: orderId, total_cents: 4900 },
    payment: { id: paymentId }
  });
  assert.equal(result.providerStatus, 'WAITING');
  assert.equal(result.qrCode, '000201-pix-test-code');
  assert.equal(result.qrCodeUrl, 'https://sandbox.api.pagseguro.com/qrcode/QRCO_123/png');
  assert.equal(result.expiresAt, expiresAt);
});

test('endpoint autentica antes de criar client service_role e falha fechado fora do Sandbox', async () => {
  const unauthenticated = backendFixture();
  const handler = createPagBankPixHandler({ createClientImpl: unauthenticated.createClientImpl, env });
  assert.equal((await invoke(handler)).status, 401);
  assert.deepEqual(unauthenticated.calls.clientKeys, []);

  const production = backendFixture();
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: production.createClientImpl,
    env: { ...env, PAGBANK_ENV: 'production' },
    fetchImpl: successfulFetch(production.calls)
  }), { authorization: 'Bearer valid-token' });
  assert.equal(result.status, 503);
  assert.deepEqual(production.calls.clientKeys, ['publishable-key']);
  assert.equal(production.calls.fetch.length, 0);
});

test('endpoint restringe pedido ao dono e exige pending_payment', async () => {
  for (const [fixture, expected] of [
    [backendFixture({ userId: 'another-user' }), 404],
    [backendFixture({ orderStatus: 'paid' }), 409]
  ]) {
    const result = await invoke(createPagBankPixHandler({
      createClientImpl: fixture.createClientImpl,
      env,
      fetchImpl: successfulFetch(fixture.calls)
    }), { authorization: 'Bearer valid-token' });
    assert.equal(result.status, expected);
    assert.equal(fixture.calls.fetch.length, 0);
  }
});

test('somente um caller concorrente vence o claim e apenas ele faz POST /orders', async () => {
  const fixture = backendFixture();
  let releasePost;
  const fetchImpl = (url, options) => {
    fixture.calls.fetch.push({ url, options });
    return new Promise((resolve) => { releasePost = () => resolve({
      ok: true,
      status: 201,
      async json() { return pagBankResponse(); }
    }); });
  };
  const handler = createPagBankPixHandler({ createClientImpl: fixture.createClientImpl, env, fetchImpl });

  const first = invoke(handler, { authorization: 'Bearer valid-token' });
  while (fixture.calls.fetch.length === 0) await new Promise((resolve) => setImmediate(resolve));
  const second = await invoke(handler, { authorization: 'Bearer valid-token' });

  assert.equal(second.status, 409);
  assert.deepEqual(second.body, { error: 'PIX_CREATION_UNCERTAIN' });
  assert.equal(fixture.calls.fetch.length, 1);
  assert.deepEqual(fixture.calls.claimResults, [true]);

  releasePost();
  assert.equal((await first).status, 201);
});

test('timeout marca provider_request_state uncertain e retry não faz novo POST', async () => {
  const fixture = backendFixture();
  const handler = createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: async (url, options) => {
      fixture.calls.fetch.push({ url, options });
      throw new Error('timeout');
    }
  });

  const first = await invoke(handler, { authorization: 'Bearer valid-token' });
  assert.equal(first.status, 502);
  assert.deepEqual(first.body, { error: 'PIX_CREATION_UNCERTAIN' });
  assert.equal(fixture.payment.status, 'pending');
  assert.equal(fixture.payment.provider_request_state, 'uncertain');

  const retry = await invoke(handler, { authorization: 'Bearer valid-token' });
  assert.equal(retry.status, 409);
  assert.deepEqual(retry.body, { error: 'PIX_CREATION_UNCERTAIN' });
  assert.equal(fixture.calls.fetch.length, 1);
});

test('estado submitting bloqueia POST /orders', async () => {
  const fixture = backendFixture({ providerRequestState: 'submitting' });
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: successfulFetch(fixture.calls)
  }), { authorization: 'Bearer valid-token' });
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { error: 'PIX_CREATION_UNCERTAIN' });
  assert.equal(fixture.calls.fetch.length, 0);
});

test('sucesso persiste estado created e IDs externos', async () => {
  const fixture = backendFixture();
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: successfulFetch(fixture.calls)
  }), { authorization: 'Bearer valid-token' });

  assert.equal(result.status, 201);
  assert.equal(fixture.payment.provider_request_state, 'created');
  assert.equal(fixture.payment.external_order_id, externalOrderId);
  assert.equal(fixture.payment.external_payment_id, externalPaymentId);
  assert.equal(fixture.payment.status, 'pending');
  assert.equal(fixture.calls.fetch[0].options.method, 'POST');
  assert.equal('x-idempotency-key' in fixture.calls.fetch[0].options.headers, false);
  assert.equal(JSON.stringify(fixture.calls.rpc[0].params).includes('52998224725'), false);
});

test('DECLINED persiste payment failed e provider_request_state failed', async () => {
  const fixture = backendFixture();
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: successfulFetch(fixture.calls, 'DECLINED')
  }), { authorization: 'Bearer valid-token' });
  assert.equal(result.status, 422);
  assert.equal(fixture.payment.status, 'failed');
  assert.equal(fixture.payment.provider_request_state, 'failed');
  assert.equal(fixture.payment.external_order_id, externalOrderId);
  assert.equal(fixture.payment.external_payment_id, externalPaymentId);
});

test('falhas 5xx, JSON inválido e resposta inválida ficam uncertain', async () => {
  const scenarios = [
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, status: 201, async json() { throw new Error('invalid json'); } }),
    async () => ({ ok: true, status: 201, async json() { return { id: 'invalid' }; } })
  ];
  for (const fetchImpl of scenarios) {
    const fixture = backendFixture();
    const result = await invoke(createPagBankPixHandler({ createClientImpl: fixture.createClientImpl, env, fetchImpl }), {
      authorization: 'Bearer valid-token'
    });
    assert.equal(result.status, 502);
    assert.equal(fixture.payment.status, 'pending');
    assert.equal(fixture.payment.provider_request_state, 'uncertain');
  }
});

test('falha ao persistir IDs tenta marcar a submissão uncertain', async () => {
  const fixture = backendFixture({ failUpdates: 1 });
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: successfulFetch(fixture.calls)
  }), { authorization: 'Bearer valid-token' });
  assert.equal(result.status, 502);
  assert.equal(fixture.payment.provider_request_state, 'uncertain');
  assert.equal(fixture.calls.updates.length, 2);
});

test('payment created recupera o mesmo Pix por GET usando ID armazenado', async () => {
  const fixture = backendFixture({
    providerRequestState: 'created',
    storedExternalOrderId: externalOrderId,
    storedExternalPaymentId: externalPaymentId
  });
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: successfulFetch(fixture.calls)
  }), { authorization: 'Bearer valid-token' });

  assert.equal(result.status, 200);
  assert.equal(result.body.pix.copyPaste, '000201-pix-test-code');
  assert.equal(fixture.calls.fetch.length, 1);
  assert.equal(fixture.calls.fetch[0].options.method, 'GET');
  assert.equal(fixture.calls.fetch[0].url, `https://sandbox.api.pagseguro.com/orders/${externalOrderId}`);
  assert.equal(fixture.calls.fetch[0].options.body, undefined);
  assert.equal(fixture.calls.claimResults.length, 0);
});

test('GET recuperado valida order, payment, valor, moeda e método PIX', async () => {
  const mutations = [
    (body) => { body.id = 'ORDE_AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'; },
    (body) => { body.reference_id = 'another-order'; },
    (body) => { body.charges[0].id = 'CHAR_AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'; },
    (body) => { body.charges[0].reference_id = '0f25c47d-90f3-44cc-bb63-ab9156a9fc72'; },
    (body) => { body.charges[0].amount.value = 1; },
    (body) => { body.charges[0].amount.currency = 'USD'; },
    (body) => { body.charges[0].payment_method.type = 'BOLETO'; }
  ];

  for (const mutate of mutations) {
    const fixture = backendFixture({
      providerRequestState: 'created',
      storedExternalOrderId: externalOrderId,
      storedExternalPaymentId: externalPaymentId
    });
    const fetchImpl = async () => {
      const body = pagBankResponse();
      mutate(body);
      return { ok: true, status: 200, async json() { return body; } };
    };
    const result = await invoke(createPagBankPixHandler({ createClientImpl: fixture.createClientImpl, env, fetchImpl }), {
      authorization: 'Bearer valid-token'
    });
    assert.equal(result.status, 502);
    assert.deepEqual(result.body, { error: 'PAGBANK_RESPONSE_UNCERTAIN' });
  }
});

test('PAID recuperado não altera order, entitlement nem executa fulfillment', async () => {
  const fixture = backendFixture({
    providerRequestState: 'created',
    storedExternalOrderId: externalOrderId,
    storedExternalPaymentId: externalPaymentId
  });
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: successfulFetch(fixture.calls, 'PAID')
  }), { authorization: 'Bearer valid-token' });
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { error: 'PAYMENT_STATUS_REVIEW_REQUIRED' });
  assert.equal(fixture.order.status, 'pending_payment');
  assert.equal(fixture.calls.updates.some((call) => call.table !== 'payments'), false);
  assert.equal(fixture.calls.rpc.some((call) => /fulfill|entitlement/i.test(call.name)), false);
});

test('serviço frontend envia somente orderId e customer com JWT do usuário', async () => {
  let request;
  await createPagBankPix(validBody, {
    getSession: async () => ({ access_token: 'browser-token' }),
    fetchImpl: async (_url, options) => {
      request = options;
      return { ok: true, async json() {
        return { environment: 'sandbox', status: 'pending', pix: { copyPaste: 'pix-code' } };
      } };
    }
  });
  assert.equal(request.headers.Authorization, 'Bearer browser-token');
  assert.deepEqual(JSON.parse(request.body), validBody);
});

test('migration protege claim atômico, estados e índices por environment', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260903030000_create_payment_customer_foundation.sql', import.meta.url), 'utf8');
  assert.match(migration, /add column provider_request_state text/);
  assert.match(migration, /add column provider_request_started_at timestamptz/);
  for (const state of ['prepared', 'submitting', 'created', 'uncertain', 'failed']) assert.match(migration, new RegExp(`'${state}'`));
  assert.match(migration, /'pix',\s+'prepared',\s+'pending'/);
  assert.match(migration, /create function public\.claim_pagbank_pix_submission/);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(migration, /for update/);
  assert.match(migration, /v_payment\.order_id is distinct from v_order\.id/);
  assert.match(migration, /v_order\.user_id is distinct from p_user_id/);
  assert.match(migration, /v_order\.status <> 'pending_payment'/);
  assert.match(migration, /v_payment\.provider <> 'pagbank'/);
  assert.match(migration, /v_payment\.provider_environment <> 'sandbox'/);
  assert.match(migration, /v_payment\.payment_method <> 'pix'/);
  assert.match(migration, /v_payment\.status <> 'pending'/);
  assert.match(migration, /provider_request_state = 'submitting'/);
  assert.match(migration, /where id = v_payment\.id\s+and provider_request_state = 'prepared'\s+and external_order_id is null\s+and external_payment_id is null/);
  assert.match(migration, /return found/);
  assert.match(migration, /revoke all on function public\.claim_pagbank_pix_submission\(uuid, uuid, uuid\)\s+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claim_pagbank_pix_submission\(uuid, uuid, uuid\)\s+to service_role/);
  assert.match(migration, /\(provider, provider_environment, external_order_id\)/);
  assert.match(migration, /\(provider, provider_environment, external_payment_id\)/);
  assert.doesNotMatch(migration, /tax_id|cpf|cnpj/i);
});

test('frontend explica persistência do contato e não expõe segredos', () => {
  const checkout = readFileSync(new URL('../src/app/routes/CheckoutPage.jsx', import.meta.url), 'utf8');
  const payments = readFileSync(new URL('../src/services/payments.js', import.meta.url), 'utf8');
  const frontend = `${checkout}\n${payments}`;
  assert.match(checkout, /dados de contato serão vinculados ao pedido/);
  assert.match(checkout, /CPF\/CNPJ é usado apenas para criar a cobrança/);
  assert.doesNotMatch(checkout, /dados abaixo serão usados somente para criar a cobrança/i);
  assert.match(checkout, /Não foi possível confirmar a criação do Pix\. Aguarde antes de tentar novamente\./);
  assert.doesNotMatch(frontend, /PAGBANK_TOKEN|SUPABASE_SERVICE_ROLE_KEY|VITE_PAGBANK_TOKEN/);
  assert.doesNotMatch(checkout, /(?:update|insert)\([^)]*orders|fulfill_paid/i);
});
