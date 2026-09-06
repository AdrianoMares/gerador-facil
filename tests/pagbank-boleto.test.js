import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  boletoDueDate,
  buildPagBankBoletoPayload,
  createPagBankBoletoHandler,
  validatePagBankBoletoInput,
  validatePagBankBoletoResponse
} from '../api/payments/pagbank/boleto/create.js';
import { createPublicOrderStatusHandler } from '../api/orders/public-status.js';
import { reconcilePagBankPayment } from '../api/_pagbankReconciliation.js';

const orderId = '7e9f8d13-7f09-4ed1-aecb-a35d447f0e7a';
const paymentId = '14b585f1-5a49-4ee7-920b-d6bb499ab1a7';
const externalOrderId = 'ORDE_3D560F48-E086-4F3C-A5A1-B7AB7BEACC2C';
const externalPaymentId = 'CHAR_114DB991-F5EA-496A-8D2C-4497F53CED22';
const barcode = '1'.repeat(48);
const formattedBarcode = '11111.11111 11111.111111 11111.111111 1 11111111111111';
const dueDate = '2026-09-08';
const token = 'A'.repeat(43);
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PAGBANK_ENV: 'sandbox',
  PAGBANK_TOKEN: 'pagbank-secret',
  PAGBANK_WEBHOOK_URL: 'https://www.resodi.com.br/api/payments/pagbank/webhook',
  RESEND_API_KEY: 'resend-secret',
  RESODI_PUBLIC_URL: 'https://www.resodi.com.br'
};
const validBody = {
  orderId,
  customer: { name: 'Maria da Silva', email: 'maria@example.com', taxId: '529.982.247-25' },
  address: {
    street: 'Rua das Flores', number: '123', complement: 'Apto 4', locality: 'Centro',
    city: 'São Paulo', regionCode: 'SP', postalCode: '01001-000'
  }
};

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function boletoProviderResponse(status = 'WAITING', includeSummary = false) {
  return {
    id: externalOrderId,
    reference_id: orderId,
    charges: [{
      id: externalPaymentId,
      reference_id: paymentId,
      status,
      amount: {
        value: 4900,
        currency: 'BRL',
        ...(includeSummary ? { summary: { total: 4900, paid: status === 'PAID' ? 4900 : 0, refunded: 0 } } : {})
      },
      payment_method: {
        type: 'BOLETO',
        boleto: {
          due_date: dueDate,
          days_until_expiration: 3,
          barcode,
          formatted_barcode: formattedBarcode
        }
      },
      links: [{
        rel: 'SELF', href: 'https://boleto.pagseguro.com.br/teste/boleto.pdf',
        media: 'application/pdf', type: 'GET'
      }]
    }]
  };
}

function creationFixture() {
  const order = {
    id: orderId,
    user_id: 'user-1',
    status: 'pending_payment',
    currency: 'BRL',
    total_cents: 4900,
    order_items: [{
      id: 'item-1', product_name: 'Declaração Anual do MEI', quantity: 1, unit_price_cents: 4900,
      product: { product_type: 'service', fulfillment_mode: 'service_request' }
    }]
  };
  const payment = {
    id: paymentId,
    order_id: orderId,
    provider: 'pagbank',
    provider_environment: 'sandbox',
    payment_method: 'boleto',
    provider_request_state: 'prepared',
    status: 'pending',
    amount_cents: 4900,
    buyer_fee_cents: 0,
    installments: null,
    currency: 'BRL',
    external_order_id: null,
    external_payment_id: null,
    boleto_due_date: null
  };
  const calls = { post: 0, get: 0, resend: 0, rpc: [], tokenHashes: [], payload: null, emailSent: false };

  function query(table) {
    return {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() { return { data: table === 'orders' ? order : payment, error: null }; },
      update(values) {
        return { async eq() { Object.assign(payment, values); return { error: null }; } };
      }
    };
  }

  const backend = {
    from: query,
    async rpc(name, params) {
      calls.rpc.push(name);
      if (name === 'prepare_pagbank_boleto_payment') return { data: paymentId, error: null };
      if (name === 'claim_pagbank_boleto_submission') {
        const claimed = payment.provider_request_state === 'prepared';
        if (claimed) payment.provider_request_state = 'submitting';
        return { data: claimed, error: null };
      }
      if (name === 'record_pagbank_boleto_creation') {
        payment.external_order_id = params.p_external_order_id;
        payment.external_payment_id = params.p_external_payment_id;
        payment.provider_request_state = 'created';
        payment.boleto_due_date = params.p_due_date;
        calls.tokenHashes.push(params.p_token_hash);
        return { data: paymentId, error: null };
      }
      if (name === 'register_pagbank_boleto_access_token') {
        calls.tokenHashes.push(params.p_token_hash);
        return { data: true, error: null };
      }
      if (name === 'claim_transactional_email') {
        if (calls.emailSent) return { data: false, error: null };
        return { data: true, error: null };
      }
      if (name === 'complete_transactional_email') {
        if (params.p_success) calls.emailSent = true;
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    }
  };
  const createClientImpl = (_url, key) => key === env.SUPABASE_PUBLISHABLE_KEY
    ? { auth: { async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; } } }
    : backend;
  const fetchImpl = async (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      calls.resend += 1;
      assert.equal(options.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`);
      assert.match(options.headers['Idempotency-Key'], /^resodi-boleto_generated-[0-9a-f]{32}$/);
      assert.equal(JSON.parse(options.body).from, 'Resodi <atendimento@resodi.com.br>');
      return { ok: true, status: 202 };
    }
    if (options.method === 'POST') {
      calls.post += 1;
      calls.payload = JSON.parse(options.body);
      assert.equal(options.headers['x-idempotency-key'], `resodi-${paymentId}`);
      return { ok: true, status: 201, async json() { return boletoProviderResponse(); } };
    }
    calls.get += 1;
    return { ok: true, status: 200, async json() { return boletoProviderResponse(); } };
  };
  return { backend, calls, createClientImpl, fetchImpl, order, payment };
}

test('entrada do boleto aceita somente holder/endereço necessários e rejeita valor do frontend', () => {
  const input = validatePagBankBoletoInput(validBody);
  assert.equal(input.customer.taxId, '52998224725');
  assert.equal(input.address.region, 'São Paulo');
  assert.equal(input.address.postalCode, '01001000');
  assert.throws(() => validatePagBankBoletoInput({ ...validBody, amount: 1 }), /INVALID_BODY/);
  assert.throws(() => validatePagBankBoletoInput({ ...validBody, address: { ...validBody.address, regionCode: 'XX' } }), /INVALID_CUSTOMER_ADDRESS/);
});

test('vencimento é exatamente três dias corridos na data de São Paulo', () => {
  assert.equal(boletoDueDate(new Date('2026-09-05T23:30:00-03:00')), '2026-09-08');
});

test('payload usa valor e itens do banco, BOLETO atual, holder, instruções e webhook', () => {
  const input = validatePagBankBoletoInput(validBody);
  const fixture = creationFixture();
  const payload = buildPagBankBoletoPayload({
    order: fixture.order,
    payment: fixture.payment,
    customer: input.customer,
    address: input.address,
    dueDate,
    notificationUrl: env.PAGBANK_WEBHOOK_URL
  });
  assert.equal(payload.charges[0].amount.value, fixture.order.total_cents);
  assert.equal(payload.charges[0].amount.currency, 'BRL');
  assert.equal(payload.charges[0].payment_method.type, 'BOLETO');
  assert.equal(payload.charges[0].payment_method.boleto.due_date, dueDate);
  assert.equal(payload.charges[0].payment_method.boleto.holder.address.country, 'BRA');
  assert.equal(payload.charges[0].payment_method.boleto.instruction_lines.line_1.length > 0, true);
  assert.deepEqual(payload.notification_urls, [env.PAGBANK_WEBHOOK_URL]);
});

test('resposta aceita apenas WAITING e artefatos oficiais coerentes', () => {
  const fixture = creationFixture();
  const result = validatePagBankBoletoResponse(boletoProviderResponse(), {
    order: fixture.order, payment: fixture.payment, dueDate
  });
  assert.equal(result.formattedBarcode, formattedBarcode);
  for (const mutate of [
    (body) => { body.charges[0].status = 'PAID'; },
    (body) => { body.charges[0].amount.value = 1; },
    (body) => { body.charges[0].payment_method.type = 'PIX'; },
    (body) => { body.charges[0].payment_method.boleto.due_date = '2026-09-09'; },
    (body) => { body.charges[0].links[0].href = 'https://evil.example/boleto.pdf'; }
  ]) {
    const body = boletoProviderResponse();
    mutate(body);
    assert.throws(() => validatePagBankBoletoResponse(body, {
      order: fixture.order, payment: fixture.payment, dueDate
    }), /INVALID_PAGBANK_RESPONSE/);
  }
});

test('criação e retry são idempotentes no PagBank e tokens ficam somente como hash', async () => {
  const fixture = creationFixture();
  let sequence = 0;
  const handler = createPagBankBoletoHandler({
    createClientImpl: fixture.createClientImpl,
    fetchImpl: fixture.fetchImpl,
    env,
    now: () => new Date('2026-09-05T12:00:00-03:00'),
    randomBytesImpl: () => Buffer.alloc(32, ++sequence),
    logError: () => {}
  });
  const request = { method: 'POST', headers: { authorization: 'Bearer jwt' }, body: validBody };
  const first = responseRecorder();
  await handler(request, first);
  const second = responseRecorder();
  await handler(request, second);
  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(fixture.calls.post, 1);
  assert.equal(fixture.calls.get, 1);
  assert.equal(fixture.calls.resend, 1);
  assert.equal(fixture.calls.payload.charges[0].amount.value, 4900);
  assert.equal(fixture.calls.tokenHashes.length, 2);
  assert.equal(fixture.calls.tokenHashes.every((hash) => /^[0-9a-f]{64}$/.test(hash)), true);
  assert.equal(fixture.calls.tokenHashes.some((hash) => first.body.publicUrl.includes(hash)), false);
  assert.notEqual(first.body.publicUrl, second.body.publicUrl);
});

test('endpoint proíbe boleto para ferramenta/PDF antes de chamar o PagBank', async () => {
  const fixture = creationFixture();
  fixture.order.order_items[0].product = {
    product_type: 'tool', fulfillment_mode: 'document_download'
  };
  const handler = createPagBankBoletoHandler({
    createClientImpl: fixture.createClientImpl,
    fetchImpl: fixture.fetchImpl,
    env,
    randomBytesImpl: () => Buffer.alloc(32, 1),
    logError: () => {}
  });
  const response = responseRecorder();
  await handler({
    method: 'POST', headers: { authorization: 'Bearer jwt' }, body: validBody
  }, response);
  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error, 'BOLETO_NOT_AVAILABLE');
  assert.equal(fixture.calls.post, 0);
});

function publicBackendFixture({ providerStatus = 'WAITING', resendStatus = 202 } = {}) {
  const order = {
    id: orderId,
    status: 'pending_payment',
    total_cents: 4900,
    currency: 'BRL',
    order_items: [{
      product_name: 'Declaração Anual do MEI',
      product: { product_type: 'service', fulfillment_mode: 'service_request' }
    }]
  };
  const payment = {
    id: paymentId, order_id: orderId, provider: 'pagbank', provider_environment: 'sandbox',
    payment_method: 'boleto', status: 'pending', amount_cents: 4900, buyer_fee_cents: 0,
    installments: null, currency: 'BRL', external_order_id: externalOrderId,
    external_payment_id: externalPaymentId, provider_status: 'WAITING', refunded_amount_cents: 0,
    boleto_due_date: dueDate, boleto_barcode: barcode, boleto_formatted_barcode: formattedBarcode,
    boleto_url: 'https://boleto.pagseguro.com.br/teste/boleto.pdf'
  };
  const calls = { rpc: [], resend: 0, emailClaimed: false };
  function query(table) {
    return {
      select() { return this; }, eq() { return this; }, limit() { return this; },
      async maybeSingle() {
        if (table === 'order_public_access_tokens') return { data: { order_id: orderId, payment_id: paymentId }, error: null };
        if (table === 'orders') return { data: order, error: null };
        if (table === 'payments') return { data: payment, error: null };
        if (table === 'order_contacts') return { data: { email: 'maria@example.com' }, error: null };
        if (table === 'service_requests') return { data: { service_name: 'Declaração Anual do MEI' }, error: null };
        throw new Error(`Unexpected table ${table}`);
      }
    };
  }
  const backend = {
    from: query,
    async rpc(name, params) {
      calls.rpc.push(name);
      if (name === 'record_verified_pagbank_status') {
        payment.provider_status = params.p_provider_status;
        return { data: params.p_provider_status, error: null };
      }
      if (name === 'confirm_verified_pagbank_payment') {
        order.status = 'paid'; payment.status = 'paid'; payment.provider_status = 'PAID';
        return { data: orderId, error: null };
      }
      if (name === 'fulfill_paid_order') return { data: null, error: null };
      if (name === 'fulfill_paid_service_order') return { data: [], error: null };
      if (name === 'claim_transactional_email') {
        if (calls.emailClaimed) return { data: false, error: null };
        calls.emailClaimed = true;
        return { data: true, error: null };
      }
      if (name === 'complete_transactional_email') return { data: true, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    }
  };
  const fetchImpl = async (url) => {
    if (url === 'https://api.resend.com/emails') {
      calls.resend += 1;
      return { ok: resendStatus >= 200 && resendStatus < 300, status: resendStatus };
    }
    return { ok: true, status: 200, async json() { return boletoProviderResponse(providerStatus, true); } };
  };
  return { backend, calls, fetchImpl, order, payment };
}

test('acompanhamento rejeita token inválido e retorno público não contém PII nem IDs', async () => {
  const invalid = responseRecorder();
  await createPublicOrderStatusHandler({
    createClientImpl: () => { throw new Error('database should not be called'); }, env
  })({ method: 'POST', headers: {}, body: { token: 'fraco' } }, invalid);
  assert.equal(invalid.statusCode, 404);

  const fixture = publicBackendFixture();
  const response = responseRecorder();
  await createPublicOrderStatusHandler({
    createClientImpl: () => fixture.backend,
    fetchImpl: fixture.fetchImpl,
    env,
    now: () => new Date('2026-09-05T12:00:00-03:00'),
    logError: () => {}
  })({ method: 'POST', headers: {}, body: { token } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'waiting');
  assert.deepEqual(Object.keys(response.body).sort(), [
    'amountCents', 'boletoUrl', 'currency', 'digitableLine', 'dueDate', 'serviceName', 'status'
  ].sort());
  const serialized = JSON.stringify(response.body);
  for (const secret of ['maria@example.com', '52998224725', orderId, paymentId, externalOrderId]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('PAID confirma, cumpre serviço e e-mail é idempotente em reconciliações repetidas', async () => {
  const fixture = publicBackendFixture({ providerStatus: 'PAID' });
  const payment = { ...fixture.payment, order: fixture.order };
  const first = await reconcilePagBankPayment({
    backend: fixture.backend, payment, fetchImpl: fixture.fetchImpl, env, logError: () => {}
  });
  const second = await reconcilePagBankPayment({
    backend: fixture.backend, payment, fetchImpl: fixture.fetchImpl, env, logError: () => {}
  });
  assert.equal(first.orderStatus, 'paid');
  assert.equal(second.orderStatus, 'paid');
  assert.equal(fixture.calls.resend, 1);
  assert.equal(fixture.calls.rpc.filter((name) => name === 'fulfill_paid_service_order').length, 2);
});

test('falha do Resend não desfaz confirmação financeira nem fulfillment', async () => {
  const fixture = publicBackendFixture({ providerStatus: 'PAID', resendStatus: 500 });
  const result = await reconcilePagBankPayment({
    backend: fixture.backend,
    payment: { ...fixture.payment, order: fixture.order },
    fetchImpl: fixture.fetchImpl,
    env,
    logError: () => {}
  });
  assert.equal(result.orderStatus, 'paid');
  assert.equal(result.fulfillmentCompleted, true);
  assert.equal(fixture.calls.resend, 1);
});

test('migration restringe boleto a serviço, protege tokens/RPCs e torna e-mails idempotentes', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260905053057_support_pagbank_boleto_services.sql', import.meta.url), 'utf8');
  assert.match(migration, /payment_method = 'boleto'[\s\S]*amount_cents = p_order\.total_cents/);
  assert.match(migration, /p\.product_type = 'service'[\s\S]*p\.fulfillment_mode = 'service_request'/);
  assert.match(migration, /create table public\.order_public_access_tokens/);
  assert.match(migration, /token_hash text primary key/);
  assert.doesNotMatch(migration, /public_access_token\s+text/);
  assert.match(migration, /alter table public\.order_public_access_tokens enable row level security/);
  assert.match(migration, /revoke all on table public\.order_public_access_tokens from public, anon, authenticated/);
  assert.match(migration, /unique \(order_id, email_type\)/);
  assert.match(migration, /revoke all on function public\.claim_transactional_email\(uuid, text\)[\s\S]*from public, anon, authenticated/);
  const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(envExample, /^RESEND_API_KEY=$/m);
  assert.doesNotMatch(envExample, /VITE_RESEND_API_KEY/);
});

test('hash consultado no acesso público deriva do token e nunca do order_id', async () => {
  let observedHash;
  const backend = {
    from(table) {
      assert.equal(table, 'order_public_access_tokens');
      return {
        select() { return this; },
        eq(field, value) { assert.equal(field, 'token_hash'); observedHash = value; return this; },
        async maybeSingle() { return { data: null, error: null }; }
      };
    }
  };
  const response = responseRecorder();
  await createPublicOrderStatusHandler({ createClientImpl: () => backend, env })({
    method: 'POST', headers: {}, body: { token }
  }, response);
  assert.equal(observedHash, createHash('sha256').update(token).digest('hex'));
  assert.equal(response.statusCode, 404);
});

test('rota com token não envia URL para telemetria, referrer ou indexadores', () => {
  const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.match(main, /pathname\.startsWith\('\/pedido\/'\) \? null : event/);
  assert.match(main, /<Analytics beforeSend=\{suppressPublicOrderTelemetry\}/);
  assert.match(main, /<SpeedInsights beforeSend=\{suppressPublicOrderTelemetry\}/);
  const protectedRoute = vercel.headers.find((entry) => entry.source === '/pedido/(.*)');
  assert.equal(protectedRoute.headers.some((header) => (
    header.key === 'Referrer-Policy' && header.value === 'no-referrer'
  )), true);
  assert.equal(protectedRoute.headers.some((header) => (
    header.key === 'X-Robots-Tag' && header.value.includes('noindex')
  )), true);
});
