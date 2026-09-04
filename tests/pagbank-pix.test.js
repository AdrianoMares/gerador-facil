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

function backendFixture({ orderStatus = 'pending_payment', userId = 'user-id', rpcError = null } = {}) {
  const calls = { clientKeys: [], rpc: [], updates: [], fetch: [] };
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
    status: 'pending',
    amount_cents: 4900,
    currency: 'BRL',
    external_order_id: null,
    external_payment_id: null
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
        return rpcError ? { data: null, error: { message: rpcError } } : { data: paymentId, error: null };
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
              return { error: null };
            } };
          }
        };
      }
    };
  };

  return { calls, createClientImpl, order, payment };
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

  assert.equal(payload.reference_id, orderId);
  assert.deepEqual(payload.items, [{ reference_id: itemId, name: 'Produto do banco', quantity: 1, unit_amount: 4900 }]);
  assert.deepEqual(payload.charges[0].amount, { value: 4900, currency: 'BRL' });
  assert.equal(payload.charges[0].reference_id, paymentId);
  assert.equal(payload.charges[0].payment_method.type, 'PIX');
  assert.equal(payload.charges[0].payment_method.pix.expiration_date, '2026-09-04T12:30:00.000Z');
  assert.equal('shipping' in payload, false);
  assert.equal('notification_urls' in payload, false);
});

test('resposta valida vínculo, valor e extrai Pix Copia e Cola e PNG', () => {
  const result = validatePagBankPixResponse(pagBankResponse(), {
    order: { id: orderId, total_cents: 4900 },
    payment: { id: paymentId }
  });
  assert.deepEqual(result, {
    externalOrderId,
    externalPaymentId,
    providerStatus: 'WAITING',
    status: 'pending',
    qrCode: '000201-pix-test-code',
    qrCodeUrl: 'https://sandbox.api.pagseguro.com/qrcode/QRCO_123/png',
    expiresAt
  });

  const wrongAmount = pagBankResponse();
  wrongAmount.charges[0].amount.value = 1;
  assert.throws(() => validatePagBankPixResponse(wrongAmount, {
    order: { id: orderId, total_cents: 4900 }, payment: { id: paymentId }
  }));
});

test('endpoint exige autenticação antes de criar client service_role', async () => {
  const fixture = backendFixture();
  const handler = createPagBankPixHandler({ createClientImpl: fixture.createClientImpl, env });

  assert.equal((await invoke(handler)).status, 401);
  assert.deepEqual(fixture.calls.clientKeys, []);

  assert.equal((await invoke(handler, { authorization: 'Bearer invalid-token' })).status, 401);
  assert.deepEqual(fixture.calls.clientKeys, ['publishable-key']);
});

test('backend falha fechado fora do Sandbox antes de usar service_role ou PagBank', async () => {
  const fixture = backendFixture();
  let fetched = false;
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env: { ...env, PAGBANK_ENV: 'production' },
    fetchImpl: async () => { fetched = true; }
  }), { authorization: 'Bearer valid-token' });

  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: 'SERVICE_NOT_CONFIGURED' });
  assert.deepEqual(fixture.calls.clientKeys, ['publishable-key']);
  assert.equal(fetched, false);
});

test('endpoint restringe pedido ao dono e exige pending_payment', async () => {
  const foreign = backendFixture({ userId: 'another-user' });
  const foreignResult = await invoke(createPagBankPixHandler({
    createClientImpl: foreign.createClientImpl,
    env,
    fetchImpl: async () => { throw new Error('must not call'); }
  }), { authorization: 'Bearer valid-token' });
  assert.equal(foreignResult.status, 404);

  const paid = backendFixture({ orderStatus: 'paid' });
  const paidResult = await invoke(createPagBankPixHandler({
    createClientImpl: paid.createClientImpl,
    env,
    fetchImpl: async () => { throw new Error('must not call'); }
  }), { authorization: 'Bearer valid-token' });
  assert.equal(paidResult.status, 409);
});

test('endpoint usa service_role só no backend, não persiste CPF e envia apenas dados bancários ao PagBank', async () => {
  const fixture = backendFixture();
  const handler = createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    now: () => new Date('2026-09-04T12:00:00.000Z'),
    fetchImpl: async (url, options) => {
      fixture.calls.fetch.push({ url, options });
      return { ok: true, status: 201, async json() { return pagBankResponse(); } };
    }
  });
  const result = await invoke(handler, { authorization: 'Bearer valid-token' });

  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'pending');
  assert.equal(result.body.environment, 'sandbox');
  assert.equal(fixture.calls.rpc[0].name, 'prepare_pagbank_pix_payment');
  assert.equal(JSON.stringify(fixture.calls.rpc[0].params).includes('52998224725'), false);
  assert.equal(JSON.stringify(fixture.calls.rpc[0].params).includes('tax'), false);
  const request = fixture.calls.fetch[0];
  assert.equal(request.url, 'https://sandbox.api.pagseguro.com/orders');
  assert.equal(request.options.headers.Authorization, 'Bearer pagbank-secret');
  assert.equal('x-idempotency-key' in request.options.headers, false);
  const body = JSON.parse(request.options.body);
  assert.equal(body.customer.tax_id, '52998224725');
  assert.equal(body.charges[0].amount.value, 4900);
  assert.equal(body.items[0].unit_amount, 4900);
  assert.deepEqual(fixture.calls.updates[0].values, {
    external_order_id: externalOrderId,
    external_payment_id: externalPaymentId,
    status: 'pending'
  });
});

test('DECLINED vira failed e PAID inesperado permanece pending sem fulfillment', async () => {
  for (const [providerStatus, expectedStatus, expectedHttp] of [
    ['DECLINED', 'failed', 422],
    ['PAID', 'pending', 409]
  ]) {
    const fixture = backendFixture();
    const handler = createPagBankPixHandler({
      createClientImpl: fixture.createClientImpl,
      env,
      fetchImpl: async () => ({ ok: true, status: 201, async json() { return pagBankResponse(providerStatus); } })
    });
    const result = await invoke(handler, { authorization: 'Bearer valid-token' });
    assert.equal(result.status, expectedHttp);
    assert.equal(fixture.calls.updates.at(-1).table, 'payments');
    assert.equal(fixture.calls.updates.at(-1).values.status, expectedStatus);
    assert.equal(fixture.calls.rpc.some((call) => call.name.includes('fulfill')), false);
  }
});

test('falha de rede preserva tentativa pending para retry', async () => {
  const fixture = backendFixture();
  const result = await invoke(createPagBankPixHandler({
    createClientImpl: fixture.createClientImpl,
    env,
    fetchImpl: async () => { throw new Error('timeout'); }
  }), { authorization: 'Bearer valid-token' });
  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { error: 'PAGBANK_RESPONSE_UNCERTAIN' });
  assert.equal(fixture.calls.updates.length, 0);
});

test('serviço frontend envia somente orderId e customer com JWT do usuário', async () => {
  let request;
  const result = await createPagBankPix(validBody, {
    getSession: async () => ({ access_token: 'browser-token' }),
    fetchImpl: async (_url, options) => {
      request = options;
      return {
        ok: true,
        async json() {
          return { environment: 'sandbox', status: 'pending', pix: { copyPaste: 'pix-code' } };
        }
      };
    }
  });
  assert.equal(result.pix.copyPaste, 'pix-code');
  assert.equal(request.headers.Authorization, 'Bearer browser-token');
  assert.deepEqual(JSON.parse(request.body), validBody);
});

test('migration cria contato sem documento, RLS e tentativa local Pix idempotente', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260903030000_create_payment_customer_foundation.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table public\.order_contacts/);
  assert.doesNotMatch(migration, /tax_id|cpf|cnpj/i);
  assert.match(migration, /alter table public\.order_contacts enable row level security/);
  assert.match(migration, /grant select on public\.order_contacts to authenticated/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete).*public\.order_contacts to authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.order_contacts to service_role/);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /v_order\.user_id is distinct from p_user_id/);
  assert.match(migration, /v_order\.total_cents/);
  assert.match(migration, /v_order\.currency/);
  assert.match(migration, /and status = 'pending'/);
  assert.match(migration, /revoke all on function public\.prepare_pagbank_pix_payment[\s\S]+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.prepare_pagbank_pix_payment[\s\S]+to service_role/);
  assert.doesNotMatch(migration, /p_(?:amount|price|currency|items|status|paid|product_id)/);
});

test('segredos de backend não aparecem no bundle fonte do frontend', () => {
  const checkout = readFileSync(new URL('../src/app/routes/CheckoutPage.jsx', import.meta.url), 'utf8');
  const payments = readFileSync(new URL('../src/services/payments.js', import.meta.url), 'utf8');
  const frontend = `${checkout}\n${payments}`;
  assert.doesNotMatch(frontend, /PAGBANK_TOKEN|SUPABASE_SERVICE_ROLE_KEY|VITE_PAGBANK_TOKEN/);
  assert.match(checkout, /VITE_PAGBANK_SANDBOX_ENABLED/);
  assert.doesNotMatch(checkout, /(?:update|insert)\([^)]*orders|fulfill_paid/i);
});
