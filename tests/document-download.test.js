import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocumentDownloadHandler } from '../api/documents/download.js';
import { renderReceiptPdf, renderResumePdf } from '../api/documents/pdfRenderers.js';
import { downloadFinalDocument } from '../src/services/commerce.js';

const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key' };
const resourceId = '7e9f8d13-7f09-4ed1-aecb-a35d447f0e7a';
const draft = { id: resourceId, service_type: 'receipt', status: 'ready', payload: { payerName: 'Ana', recipientName: 'Bruno', amount: '125.50', description: 'Serviço profissional', city: 'São Paulo', date: '2026-09-03' } };
const entitlement = { resource_id: resourceId, resource_type: 'receipt', revoked_at: null, product: { product_type: 'tool', fulfillment_mode: 'document_download', resource_kind: 'receipt' } };

function invoke(handler, { method = 'POST', authorization = 'Bearer valid-token', body = { resourceId } } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    const response = {
      setHeader(name, value) { headers[name] = value; },
      status(status) { this.statusCode = status; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload, headers }); },
      send(payload) { resolve({ status: this.statusCode, body: payload, headers }); }
    };
    Promise.resolve(handler({ method, headers: authorization ? { authorization } : {}, body }, response)).catch(reject);
  });
}

function query(result) {
  return {
    select() { return this; },
    eq() { return this; },
    is() { return this; },
    async maybeSingle() { return result; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
  };
}

function createClient({ draftResult = { data: draft, error: null }, entitlements = [entitlement] } = {}) {
  return () => ({
    auth: { async getUser(token) { return token === 'valid-token' ? { data: { user: { id: 'user-id' } }, error: null } : { data: { user: null }, error: new Error('invalid') }; } },
    from(table) {
      if (table === 'document_drafts') return query(draftResult);
      return query({ data: entitlements, error: null });
    }
  });
}

test('download bloqueia métodos, Bearer e resourceId inválidos', async () => {
  const handler = createDocumentDownloadHandler({ createClientImpl: createClient(), env });
  assert.equal((await invoke(handler, { method: 'GET' })).status, 405);
  assert.equal((await invoke(handler, { authorization: null })).status, 401);
  assert.equal((await invoke(handler, { body: { resourceId: 'invalid', paid: true } })).status, 400);
});

test('download não libera draft inexistente, não pronto ou sem entitlement válido', async () => {
  const cases = [
    { setup: { draftResult: { data: null, error: null } }, expected: 404 },
    { setup: { draftResult: { data: { ...draft, status: 'draft' }, error: null } }, expected: 403 },
    { setup: { entitlements: [] }, expected: 403 },
    { setup: { entitlements: [{ ...entitlement, revoked_at: '2026-09-03T00:00:00Z' }] }, expected: 403 },
    { setup: { entitlements: [{ ...entitlement, resource_type: 'resume' }] }, expected: 403 },
    { setup: { entitlements: [{ ...entitlement, product: { ...entitlement.product, resource_kind: 'resume' } }] }, expected: 403 }
  ];
  for (const { setup, expected } of cases) {
    const handler = createDocumentDownloadHandler({ createClientImpl: createClient(setup), env });
    assert.equal((await invoke(handler)).status, expected);
  }
});

test('download autorizado gera PDF final privado', async () => {
  const handler = createDocumentDownloadHandler({ createClientImpl: createClient(), env });
  const result = await invoke(handler);
  assert.equal(result.status, 200);
  assert.equal(result.headers['Content-Type'], 'application/pdf');
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.match(result.headers['Content-Disposition'], /recibo-resodi\.pdf/);
  assert.equal(Buffer.from(result.body).subarray(0, 4).toString(), '%PDF');
});

test('renderizadores geram PDFs válidos para campos opcionais, listas vazias e currículo longo', () => {
  const receipt = renderReceiptPdf({ ...draft.payload, payerDocument: '', recipientDocument: '', description: 'x'.repeat(1000) });
  assert.equal(receipt.subarray(0, 4).toString(), '%PDF');
  const resume = renderResumePdf({
    personal: { fullName: 'Ana da Silva', professionalTitle: 'Analista', phone: '', email: '', location: '' },
    professionalSummary: 'Resumo profissional.', education: [], courses: [], skills: [],
    experiences: Array.from({ length: 35 }, (_, index) => ({ role: `Cargo ${index}`, company: 'Empresa', startDate: '2020-01', current: false, endDate: '2021-01', activities: [{ description: 'Atividade longa e relevante para demonstrar a paginação do currículo.' }] }))
  });
  assert.equal(resume.subarray(0, 4).toString(), '%PDF');
  assert.ok((resume.toString('latin1').match(/\/Type \/Page/g) || []).length > 1);
});

test('serviço de download envia somente resourceId, exige PDF e revoga URL temporária', async () => {
  let request;
  let revoked;
  let clicked = false;
  const urlApi = { createObjectURL() { return 'blob:test'; }, revokeObjectURL(url) { revoked = url; } };
  const documentRef = { body: { appendChild() {} }, createElement() { return { click() { clicked = true; }, remove() {} }; } };
  await downloadFinalDocument(resourceId, {
    getSession: async () => ({ access_token: 'browser-token' }), urlApi, documentRef,
    fetchImpl: async (_url, options) => {
      request = options;
      return { ok: true, status: 200, headers: { get: () => 'application/pdf' }, blob: async () => new Blob(['pdf'], { type: 'application/pdf' }) };
    }
  });
  assert.deepEqual(JSON.parse(request.body), { resourceId });
  assert.equal(request.headers.Authorization, 'Bearer browser-token');
  assert.equal(clicked, true);
  assert.equal(revoked, 'blob:test');
  await assert.rejects(downloadFinalDocument(resourceId, {
    getSession: async () => ({ access_token: 'browser-token' }),
    fetchImpl: async () => ({ ok: false, status: 403, headers: { get: () => 'application/json' } })
  }), (error) => error.code === 'DOCUMENT_NOT_AVAILABLE');
});
