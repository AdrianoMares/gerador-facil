import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiDocumentAssistHandler } from '../api/ai-document-assist.js';

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_AI_API_TOKEN: 'cloudflare-token'
};

function createClientImpl() {
  return {
    auth: {
      async getUser(token) {
        return token === 'valid-token'
          ? { data: { user: { id: 'user-id' } }, error: null }
          : { data: { user: null }, error: new Error('invalid') };
      }
    }
  };
}

function cloudflareSuccess(patch = {}) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        success: true,
        result: {
          response: {
            assistantMessage: 'Dados organizados.',
            patch
          }
        }
      };
    }
  });
}

function invoke(handler, { method = 'POST', authorization, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const responseHeaders = {};
    const response = {
      setHeader(name, value) {
        responseHeaders[name] = value;
      },
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(responseBody) {
        resolve({ status: this.statusCode, body: responseBody, headers: responseHeaders });
      }
    };

    Promise.resolve(handler({
      method,
      headers: {
        ...headers,
        ...(authorization ? { authorization } : {})
      },
      body
    }, response)).catch(reject);
  });
}

function validBody(overrides = {}) {
  return {
    serviceType: 'receipt',
    message: 'Recebi R$ 450 de Maria Silva por manutenção.',
    currentPayload: {},
    conversation: [],
    ...overrides
  };
}

test('rejeita métodos diferentes de POST', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: cloudflareSuccess(), env });
  const result = await invoke(handler, { method: 'GET' });

  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'POST');
});

test('rejeita chamada sem Bearer token', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: cloudflareSuccess(), env });
  const result = await invoke(handler, { body: validBody() });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'UNAUTHORIZED');
});

test('rejeita serviceType desconhecido', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: cloudflareSuccess(), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody({ serviceType: 'invoice' })
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_SERVICE_TYPE');
});

test('rejeita mensagem maior que 4000 caracteres', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: cloudflareSuccess(), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody({ message: 'a'.repeat(4001) })
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_MESSAGE');
});

test('remove a foto do currículo antes de chamar a Cloudflare', async () => {
  let cloudflareRequest;
  const fetchImpl = async (_url, options) => {
    cloudflareRequest = JSON.parse(options.body);
    return cloudflareSuccess({ personal: { fullName: 'Maria' } })();
  };
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl, env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody({
      serviceType: 'resume',
      currentPayload: {
        personal: { fullName: '', photo: 'data:image/png;base64,secret-photo' },
        professionalSummary: '',
        education: [],
        courses: [],
        skills: [],
        experiences: []
      }
    })
  });

  const promptPayload = JSON.parse(cloudflareRequest.messages[1].content);
  assert.equal(result.status, 200);
  assert.equal('photo' in promptPayload.currentPayload.personal, false);
  assert.equal(JSON.stringify(cloudflareRequest).includes('secret-photo'), false);
  assert.deepEqual(result.body.patch.personal, { fullName: 'Maria' });
  assert.equal(JSON.stringify(result.body).includes(env.CLOUDFLARE_AI_API_TOKEN), false);
});

test('rejeita campos que tentam controlar modelo ou system prompt', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: cloudflareSuccess(), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: { ...validBody(), model: 'outro-modelo' }
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'UNSUPPORTED_FIELD');
});
