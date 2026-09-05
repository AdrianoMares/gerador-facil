import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fetchPagBankFeePlans, validatePagBankFeePlans } from '../api/_pagbankCard.js';
import {
  buildPagBankCardPayload,
  createPagBankCardHandler,
  validatePagBankCardInput,
  validatePagBankCardResponse
} from '../api/payments/pagbank/card/create.js';
import { createPagBankCardInstallmentsHandler } from '../api/payments/pagbank/card/installments.js';
import { createPagBankCardPublicKeyHandler } from '../api/payments/pagbank/card/public-key.js';
import { validatePagBankReconciliationResponse } from '../api/_pagbankReconciliation.js';

const orderId = '7e9f8d13-7f09-4ed1-aecb-a35d447f0e7a';
const paymentId = '14b585f1-5a49-4ee7-920b-d6bb499ab1a7';
const externalOrderId = 'ORDE_12345678-1234-1234-1234-123456789abc';
const externalPaymentId = 'CHAR_12345678-1234-1234-1234-123456789abc';
const baseAmount = 1490;
const env = {
  SUPABASE_URL: 'https://db.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  PAGBANK_ENV: 'sandbox',
  PAGBANK_TOKEN: 'secret',
  PAGBANK_WEBHOOK_URL: 'https://example.com/api/payments/pagbank/webhook'
};

function feesResponse() {
  return {
    payment_methods: {
      credit_card: {
        visa: {
          installment_plans: [
            { installments: 1, installment_value: 1490, interest_free: true, amount: { value: 1490, currency: 'BRL' } },
            { installments: 2, installment_value: 760, interest_free: false, amount: { value: 1520, currency: 'BRL', fees: { buyer: { interest: { total: 30, installments: 1 } } } } },
            { installments: 3, installment_value: 520, interest_free: false, amount: { value: 1560, currency: 'BRL', fees: { buyer: { interest: { total: 70, installments: 2 } } } } },
            { installments: 6, installment_value: 270, interest_free: false, amount: { value: 1620, currency: 'BRL', fees: { buyer: { interest: { total: 130, installments: 5 } } } } }
          ]
        }
      }
    }
  };
}

test('Fees aceita somente planos oficiais 1..5, parcela mínima e buyer fee coerente', () => {
  const plans = validatePagBankFeePlans(feesResponse(), baseAmount);
  assert.deepEqual(plans.map((plan) => plan.installments), [1, 2, 3]);
  assert.equal(plans[0].buyerFee, 0);
  assert.equal(plans[1].totalAmount, baseAmount + plans[1].buyerFee);
  const belowMinimum = feesResponse();
  belowMinimum.payment_methods.credit_card.visa.installment_plans[2].installment_value = 499;
  assert.throws(() => validatePagBankFeePlans(belowMinimum, baseAmount), /INVALID_PAGBANK_FEES_RESPONSE/);
});

test('Fees aceita arredondamento de centavos distribuído entre parcelas', () => {
  const payload = feesResponse();
  payload.payment_methods.credit_card.visa.installment_plans[2].amount.value = 1559;
  payload.payment_methods.credit_card.visa.installment_plans[2].amount.fees.buyer.interest.total = 69;
  assert.equal(validatePagBankFeePlans(payload, baseAmount)[2].totalAmount, 1559);
});

test('Fees falha fechado quando parcela acima de 1 não traz juros do comprador', () => {
  const payload = feesResponse();
  delete payload.payment_methods.credit_card.visa.installment_plans[1].amount.fees;
  assert.throws(() => validatePagBankFeePlans(payload, baseAmount), /INVALID_PAGBANK_FEES_RESPONSE/);
});

test('consulta Fees fixa CREDIT_CARD, máximo 5, 1x sem juros e usa valor fornecido pelo banco', async () => {
  let requested;
  const plans = await fetchPagBankFeePlans(async (url, options) => {
    requested = { url: new URL(url), options };
    return { ok: true, status: 200, async json() { return feesResponse(); } };
  }, { PAGBANK_ENV: 'sandbox', PAGBANK_TOKEN: 'secret' }, baseAmount, '411111');
  assert.equal(requested.url.searchParams.get('value'), String(baseAmount));
  assert.equal(requested.url.searchParams.get('payment_methods'), 'CREDIT_CARD');
  assert.equal(requested.url.searchParams.get('max_installments'), '5');
  assert.equal(requested.url.searchParams.get('max_installments_no_interest'), '1');
  assert.equal(requested.options.headers.Authorization, 'Bearer secret');
  assert.equal(plans.length, 3);
});

test('endpoint de parcelas autentica ownership e usa order.total_cents do banco', async () => {
  const calls = [];
  const createClientImpl = (_url, key) => key === 'publishable' ? {
    auth: { async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; } }
  } : {
    from(table) {
      assert.equal(table, 'orders');
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: { id: orderId, user_id: 'user-1', status: 'pending_payment', currency: 'BRL', total_cents: baseAmount }, error: null }; }
      };
    }
  };
  const response = { status(code) { this.statusCode = code; return this; }, setHeader() {}, json(body) { this.body = body; return this; } };
  await createPagBankCardInstallmentsHandler({
    createClientImpl,
    env: { SUPABASE_URL: 'https://db.test', SUPABASE_PUBLISHABLE_KEY: 'publishable', SUPABASE_SERVICE_ROLE_KEY: 'service', PAGBANK_ENV: 'sandbox', PAGBANK_TOKEN: 'secret' },
    fetchImpl: async (url) => {
      calls.push(new URL(url));
      return { ok: true, status: 200, async json() { return feesResponse(); } };
    }
  })({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: { orderId, cardBin: '411111' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].searchParams.get('value'), String(baseAmount));
  assert.deepEqual(Object.keys(response.body.installments[0]).sort(), ['buyerFee', 'installmentValue', 'installments', 'interestFree', 'totalAmount'].sort());
});

test('endpoint autenticado consulta apenas a chave pública existente e nunca expõe o token', async () => {
  let request;
  const handler = createPagBankCardPublicKeyHandler({
    env,
    createClientImpl: () => ({ auth: { async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; } } }),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() { return { public_key: `public-${'x'.repeat(120)}` }; } };
    }
  });
  const response = responseRecorder();
  await handler({ method: 'GET', headers: { authorization: 'Bearer jwt' } }, response);
  assert.equal(request.url, 'https://sandbox.api.pagseguro.com/public-keys/card');
  assert.equal(request.options.method, 'GET');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.publicKey.startsWith('public-'), true);
  assert.equal(JSON.stringify(response.body).includes(env.PAGBANK_TOKEN), false);
});

test('entrada da cobrança rejeita dinheiro, taxa ou dados abertos fora do contrato', () => {
  const valid = {
    orderId,
    customer: { name: 'Maria Silva', email: 'maria@example.com', taxId: '12345678901', phone: '11999999999' },
    holder: { name: 'Maria Silva', taxId: '12345678901' },
    encryptedCard: 'encrypted-card-value-long-enough',
    cardBin: '411111',
    installments: 2
  };
  assert.equal(validatePagBankCardInput(valid).installments, 2);
  assert.throws(() => validatePagBankCardInput({ ...valid, holder: { ...valid.holder, taxId: '12345678901234' } }), /INVALID_CARD_DATA/);
  for (const field of ['amount', 'buyerFee', 'totalAmount', 'cardNumber', 'securityCode']) {
    assert.throws(() => validatePagBankCardInput({ ...valid, [field]: 1 }), /INVALID_BODY/);
  }
});

function cardRequest() {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer jwt' },
    body: {
      orderId,
      customer: { name: 'Maria Silva', email: 'maria@example.com', taxId: '12345678901', phone: '11999999999' },
      holder: { name: 'Maria Silva', taxId: '12345678901' },
      encryptedCard: 'encrypted-card-value-long-enough',
      cardBin: '411111',
      installments: 2
    }
  };
}

function responseRecorder() {
  return { status(code) { this.statusCode = code; return this; }, setHeader() {}, json(body) { this.body = body; return this; } };
}

function cardHandlerFixture(postOrder) {
  const order = {
    id: orderId, user_id: 'user-1', status: 'pending_payment', currency: 'BRL', total_cents: baseAmount,
    order_items: [{ id: 'item-1', product_name: 'Documento', quantity: 1, unit_price_cents: baseAmount }]
  };
  const payment = {
    id: paymentId, order_id: orderId, provider: 'pagbank', provider_environment: 'sandbox',
    payment_method: 'credit_card', provider_request_state: 'prepared', status: 'pending',
    amount_cents: 1520, buyer_fee_cents: 30, installments: 2, currency: 'BRL',
    external_order_id: null, external_payment_id: null
  };
  const calls = { post: 0, fees: 0, rpc: [] };
  const backend = {
    rpc: async (name, params) => {
      calls.rpc.push({ name, params });
      if (name === 'prepare_pagbank_card_payment') return { data: payment.id, error: null };
      if (name === 'claim_pagbank_card_submission') {
        const claimed = payment.provider_request_state === 'prepared';
        if (claimed) payment.provider_request_state = 'submitting';
        return { data: claimed, error: null };
      }
      assert.equal(name, 'record_pagbank_card_creation');
      payment.external_order_id = params.p_external_order_id;
      payment.external_payment_id = params.p_external_payment_id;
      payment.provider_request_state = params.p_provider_status === 'DECLINED' ? 'failed' : 'created';
      payment.status = params.p_provider_status === 'DECLINED' ? 'failed' : payment.status;
      return { data: payment.id, error: null };
    },
    from(table) {
      if (table === 'orders') {
        return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: order, error: null }; } };
      }
      return {
        select() { return this; },
        update(values) {
          return { async eq() { Object.assign(payment, values); return { error: null }; } };
        },
        eq() { return this; },
        async maybeSingle() { return { data: payment, error: null }; }
      };
    }
  };
  const createClientImpl = (_url, key) => key === 'publishable'
    ? { auth: { async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; } } }
    : backend;
  const fetchImpl = async (url, options) => {
    if (url.includes('/charges/fees/calculate')) {
      calls.fees += 1;
      return { ok: true, status: 200, async json() { return feesResponse(); } };
    }
    calls.post += 1;
    return postOrder({ url, options, payment, order });
  };
  return { calls, order, payment, createClientImpl, fetchImpl };
}

test('criação revalida Fees, usa idempotency key estável e não confirma PAID síncrono', async () => {
  const fixture = cardHandlerFixture(({ options }) => {
    const body = JSON.parse(options.body);
    assert.equal(options.headers['x-idempotency-key'], `resodi-${paymentId}`);
    assert.equal(body.charges[0].amount.value, 1520);
    assert.equal(body.charges[0].amount.fees.buyer.interest.total, 30);
    return { ok: true, status: 201, async json() {
      return {
        id: externalOrderId, reference_id: orderId,
        charges: [{
          id: externalPaymentId, reference_id: paymentId, status: 'PAID',
          amount: { value: 1520, currency: 'BRL', fees: { buyer: { interest: { total: 30, installments: 1 } } } },
          payment_method: { type: 'CREDIT_CARD', installments: 2, capture: true, card: { store: false } }
        }]
      };
    } };
  });
  const response = responseRecorder();
  await createPagBankCardHandler({ createClientImpl: fixture.createClientImpl, fetchImpl: fixture.fetchImpl, env })(cardRequest(), response);
  assert.equal(response.statusCode, 202);
  assert.equal(fixture.calls.fees, 1);
  assert.equal(fixture.calls.post, 1);
  assert.equal(fixture.payment.status, 'pending');
  assert.equal(fixture.order.status, 'pending_payment');
  assert.equal(fixture.calls.rpc.some((call) => call.name === 'record_pagbank_card_creation'), true);
  assert.equal(fixture.payment.encryptedCard, undefined);
  assert.equal(fixture.payment.cardBin, undefined);
});

test('timeout deixa tentativa incerta e replay não faz um segundo POST', async () => {
  const fixture = cardHandlerFixture(async () => { throw new Error('timeout'); });
  const handler = createPagBankCardHandler({ createClientImpl: fixture.createClientImpl, fetchImpl: fixture.fetchImpl, env });
  const first = responseRecorder();
  await handler(cardRequest(), first);
  assert.equal(first.statusCode, 502);
  assert.equal(first.body.error, 'CARD_CREATION_UNCERTAIN');
  assert.equal(fixture.payment.provider_request_state, 'uncertain');
  const replay = responseRecorder();
  await handler(cardRequest(), replay);
  assert.equal(replay.statusCode, 409);
  assert.equal(fixture.calls.post, 1);
});

test('payload usa cartão criptografado, capture=true, store=false e repasse oficial', () => {
  const plan = validatePagBankFeePlans(feesResponse(), baseAmount)[1];
  const payload = buildPagBankCardPayload({
    order: { id: orderId, order_items: [{ id: 'item-1', product_name: 'Documento', quantity: 1, unit_price_cents: baseAmount }] },
    payment: { id: paymentId },
    customer: { name: 'Maria Silva', email: 'maria@example.com', taxId: '12345678901', phone: { country: '55', area: '11', number: '999999999' } },
    holder: { name: 'Maria Silva', taxId: '12345678901' },
    encryptedCard: 'encrypted-card-value-long-enough',
    plan,
    notificationUrl: 'https://example.com/webhook'
  });
  const charge = payload.charges[0];
  assert.equal(charge.amount.value, baseAmount + plan.buyerFee);
  assert.equal(charge.amount.fees.buyer.interest.total, plan.buyerFee);
  assert.equal(charge.payment_method.capture, true);
  assert.equal(charge.payment_method.card.store, false);
  assert.equal(charge.payment_method.card.encrypted, 'encrypted-card-value-long-enough');
  assert.equal(charge.payment_method.card.number, undefined);
  assert.equal(charge.payment_method.card.security_code, undefined);
});

test('resposta síncrona valida método, parcelas, total e taxa mas não confirma finanças', () => {
  const plan = validatePagBankFeePlans(feesResponse(), baseAmount)[1];
  const response = {
    id: externalOrderId,
    reference_id: orderId,
    charges: [{
      id: externalPaymentId, reference_id: paymentId, status: 'PAID',
      amount: { value: plan.totalAmount, currency: 'BRL', fees: { buyer: { interest: { total: plan.buyerFee, installments: plan.buyerFeeInstallments } } } },
      payment_method: { type: 'CREDIT_CARD', installments: 2, capture: true, card: { store: false } }
    }]
  };
  assert.equal(validatePagBankCardResponse(response, { order: { id: orderId }, payment: { id: paymentId }, plan }).providerStatus, 'PAID');
  response.charges[0].amount.value = baseAmount;
  assert.throws(() => validatePagBankCardResponse(response, { order: { id: orderId }, payment: { id: paymentId }, plan }));
});

test('reconciliação oficial aceita CREDIT_CARD com fee e preserva invariantes Pix', () => {
  const payment = {
    id: paymentId, order_id: orderId, provider: 'pagbank', provider_environment: 'sandbox', payment_method: 'credit_card',
    status: 'pending', amount_cents: 1520, buyer_fee_cents: 30, installments: 2, currency: 'BRL',
    external_order_id: externalOrderId, external_payment_id: externalPaymentId, refunded_amount_cents: 0,
    order: { id: orderId, status: 'pending_payment', total_cents: baseAmount, currency: 'BRL' }
  };
  const payload = {
    id: externalOrderId, reference_id: orderId,
    charges: [{ id: externalPaymentId, reference_id: paymentId, status: 'PAID', amount: {
      value: 1520, currency: 'BRL', fees: { buyer: { interest: { total: 30, installments: 1 } } },
      summary: { total: 1520, paid: 1520, refunded: 0 }
    }, payment_method: { type: 'CREDIT_CARD', installments: 2 } }]
  };
  assert.equal(validatePagBankReconciliationResponse(payload, payment).providerStatus, 'PAID');
  assert.throws(() => validatePagBankReconciliationResponse(payload, { ...payment, amount_cents: baseAmount }));
});

test('frontend não envia cartão aberto e backend não persiste ou registra criptograma/BIN', () => {
  const frontend = readFileSync(new URL('../src/services/payments.js', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../api/payments/pagbank/card/create.js', import.meta.url), 'utf8');
  const createRequest = frontend.match(/authenticatedRequest\('\/api\/payments\/pagbank\/card\/create'[\s\S]*?\}, options\)/)?.[0] || '';
  const createBody = createRequest.match(/body: JSON\.stringify\(\{[\s\S]*?\}\)/)?.[0] || '';
  assert.match(createBody, /encryptedCard/);
  assert.doesNotMatch(createBody, /number|expMonth|expYear|securityCode/);
  assert.doesNotMatch(backend, /console\.(?:log|error).*encrypted|console\.(?:log|error).*cardBin/i);
  assert.doesNotMatch(backend, /update\([^)]*(?:encryptedCard|cardBin)|insert\([^)]*(?:encryptedCard|cardBin)/i);
});

test('migration incremental protege tentativas, relação de valores e RPCs service_role only', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260904194511_support_pagbank_credit_card.sql', import.meta.url), 'utf8');
  assert.match(sql, /add column installments integer/);
  assert.match(sql, /add column buyer_fee_cents integer not null default 0/);
  assert.match(sql, /amount_cents = p_order\.total_cents \+ p_payment\.buyer_fee_cents/);
  assert.match(sql, /create unique index payments_one_pending_pagbank_card_sandbox_per_order_key/);
  assert.match(sql, /create unique index payments_one_pending_pagbank_sandbox_per_order_key/);
  assert.match(sql, /provider_request_state = 'submitting'/);
  assert.match(sql, /p_provider_status = 'DECLINED' then 'failed'/);
  for (const signature of [
    'prepare_pagbank_card_payment\\(uuid, uuid, text, text, text, text, text, integer, integer, integer\\)',
    'claim_pagbank_card_submission\\(uuid, uuid, uuid\\)',
    'record_pagbank_card_creation\\(uuid, uuid, text, text, text\\)'
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated;[\\s\\S]*?grant execute[\\s\\S]*?to service_role`));
  }
  assert.doesNotMatch(sql, /service_role[^;]*to (?:anon|authenticated)/);
});
