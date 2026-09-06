import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { verifyTurnstileToken } from '../api/_turnstile.js';

const secret = 'turnstile-secret';
const token = 'turnstile-token';

test('token válido é confirmado no Siteverify com action e IP esperados', async () => {
  let request;
  const result = await verifyTurnstileToken(token, {
    env: { TURNSTILE_SECRET_KEY: secret },
    request: {
      headers: {
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        'x-forwarded-host': 'TEST.RESODI.COM.BR:443',
        host: 'wrong.example.com'
      }
    },
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return { ok: true, async json() {
        return { success: true, action: 'checkout_payment', hostname: 'test.resodi.com.br' };
      } };
    }
  });
  assert.equal(result, true);
  assert.equal(request.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.deepEqual(request.body, { secret, response: token, remoteip: '203.0.113.10' });
  assert.equal(request.options.signal instanceof AbortSignal, true);
});

test('hostname correto é aceito para os hosts oficiais, removendo porta e ignorando caixa', async () => {
  for (const hostname of ['test.resodi.com.br', 'resodi.com.br', 'www.resodi.com.br']) {
    const result = await verifyTurnstileToken(token, {
      env: { TURNSTILE_SECRET_KEY: secret },
      request: { headers: { host: `${hostname.toUpperCase()}:443` } },
      fetchImpl: async () => ({
        ok: true,
        async json() { return { success: true, action: 'checkout_payment', hostname: hostname.toUpperCase() }; }
      })
    });
    assert.equal(result, true);
  }
});

test('hostname divergente, ausente ou inválido falha fechado', async () => {
  for (const [request, hostname] of [
    [{ headers: { host: 'test.resodi.com.br' } }, 'resodi.com.br'],
    [{ headers: { host: 'test.resodi.com.br' } }, undefined],
    [{ headers: { host: 'test.resodi.com.br' } }, 'test.resodi.com.br:443'],
    [{ headers: { host: 'test.resodi.com.br/path' } }, 'test.resodi.com.br']
  ]) {
    await assert.rejects(verifyTurnstileToken(token, {
      env: { TURNSTILE_SECRET_KEY: secret }, request,
      fetchImpl: async () => ({
        ok: true,
        async json() { return { success: true, action: 'checkout_payment', hostname }; }
      })
    }), /TURNSTILE_VALIDATION_FAILED/);
  }
});

test('token ausente, vazio ou acima do limite falha antes da rede', async () => {
  let calls = 0;
  const options = {
    env: { TURNSTILE_SECRET_KEY: secret },
    fetchImpl: async () => { calls += 1; }
  };
  for (const invalidToken of [undefined, '', 'x'.repeat(2_049)]) {
    await assert.rejects(verifyTurnstileToken(invalidToken, options), /TURNSTILE_VALIDATION_FAILED/);
  }
  assert.equal(calls, 0);
});

test('success=false e action divergente bloqueiam a criação', async () => {
  for (const payload of [
    { success: false, 'error-codes': ['invalid-input-response'] },
    { success: true, action: 'outra_acao' }
  ]) {
    await assert.rejects(verifyTurnstileToken(token, {
      env: { TURNSTILE_SECRET_KEY: secret },
      fetchImpl: async () => ({ ok: true, async json() { return payload; } })
    }), /TURNSTILE_VALIDATION_FAILED/);
  }
});

test('indisponibilidade, resposta inválida e timeout falham fechado', async () => {
  const scenarios = [
    async () => { throw new Error('network unavailable'); },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, async json() { throw new Error('invalid json'); } }),
    async () => ({ ok: true, async json() { return { success: false, 'error-codes': ['internal-error'] }; } }),
    async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })
  ];
  for (const fetchImpl of scenarios) {
    await assert.rejects(verifyTurnstileToken(token, {
      env: { TURNSTILE_SECRET_KEY: secret }, fetchImpl, timeoutMs: 1
    }), /SECURITY_VALIDATION_UNAVAILABLE/);
  }
});

test('secret ausente retorna configuração indisponível sem acessar a rede', async () => {
  let calls = 0;
  await assert.rejects(verifyTurnstileToken(token, {
    env: {}, fetchImpl: async () => { calls += 1; }
  }), /SECURITY_VALIDATION_NOT_CONFIGURED/);
  assert.equal(calls, 0);
});

test('checkout exige token, envia-o só na criação e reinicia após cada tentativa', () => {
  const checkout = readFileSync(new URL('../src/app/routes/CheckoutPage.jsx', import.meta.url), 'utf8');
  const payments = readFileSync(new URL('../src/services/payments.js', import.meta.url), 'utf8');
  assert.match(checkout, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(checkout, /disabled=\{pixState\.loading \|\| !turnstileToken\}/);
  assert.match(checkout, /disabled=\{cardState\.loading \|\| !selectedInstallments \|\| !turnstileToken\}/);
  assert.match(checkout, /disabled=\{boletoState\.loading \|\| !turnstileToken\}/);
  assert.equal((checkout.match(/finally \{\s*resetTurnstile\(\);\s*\}/g) || []).length, 3);
  assert.equal((payments.match(/turnstileToken/g) || []).length, 6);
  for (const statusPath of [
    '/api/payments/pagbank/pix/status',
    '/api/payments/pagbank/card/status'
  ]) {
    const start = payments.indexOf(statusPath);
    assert.notEqual(start, -1);
    assert.equal(payments.slice(start, start + 350).includes('turnstileToken'), false);
  }
});

test('status e webhook permanecem independentes do Turnstile e nenhum token é logado', () => {
  const status = readFileSync(new URL('../api/payments/pagbank/pix/status.js', import.meta.url), 'utf8');
  const webhook = readFileSync(new URL('../api/payments/pagbank/webhook.js', import.meta.url), 'utf8');
  const helper = readFileSync(new URL('../api/_turnstile.js', import.meta.url), 'utf8');
  assert.doesNotMatch(`${status}\n${webhook}`, /turnstile/i);
  assert.doesNotMatch(helper, /console\.(?:log|info|warn|error)/);
});
