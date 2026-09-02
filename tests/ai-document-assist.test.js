import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_MODEL } from '../api/_documentAiSchemas.js';
import {
  AI_TIMEZONE,
  buildAiDocumentMessages,
  currentDateInTimezone
} from '../api/_documentAiPrompts.js';
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

function promptInput(serviceType, message, currentPayload = {}) {
  return {
    serviceType,
    message,
    currentPayload,
    conversation: []
  };
}

test('mantém o modelo Cloudflare definido para a integração', () => {
  assert.equal(AI_MODEL, '@cf/meta/llama-3.1-8b-instruct-fast');
});

test('calcula currentDate no fuso America/Sao_Paulo e envia o contexto ao modelo', () => {
  const now = new Date('2026-09-02T02:30:00.000Z');
  const messages = buildAiDocumentMessages(
    promptInput('receipt', 'O pagamento foi hoje.'),
    { now }
  );
  const context = JSON.parse(messages[1].content);

  assert.equal(currentDateInTimezone(now), '2026-09-01');
  assert.equal(context.currentDate, '2026-09-01');
  assert.equal(context.timezone, AI_TIMEZONE);
  assert.match(messages[0].content, /hoje, ontem e amanhã/);
  assert.match(messages[0].content, /currentDate é 2026-09-01/);
});

test('prompt do recibo exige extração completa e contém as regressões semânticas', async (context) => {
  const cases = [
    {
      message: 'Recebi R$ 450 de Maria Silva referente à manutenção de computador em Aracruz hoje.',
      expectedPromptFragments: ['"payerName":"Maria Silva"', '"amount":"450"', '"city":"Aracruz"']
    },
    {
      message: 'João Pereira pagou 1.250 reais para Carlos Souza pelo serviço de pintura realizado em Vitória no dia 15/08/2026.',
      expectedPromptFragments: ['"recipientName":"Carlos Souza"', '"date":"2026-08-15"']
    },
    {
      message: 'Quem recebeu foi João Neves.',
      expectedPromptFragments: ['patch é somente {"recipientName":"João Neves"}', 'Não repita nem apague']
    }
  ];

  for (const item of cases) {
    await context.test(item.message, () => {
      const messages = buildAiDocumentMessages(promptInput('receipt', item.message), {
        now: new Date('2026-09-01T15:00:00.000Z')
      });
      const systemPrompt = messages[0].content;
      const requestContext = JSON.parse(messages[1].content);

      assert.equal(requestContext.message, item.message);
      assert.match(systemPrompt, /Não pare após encontrar o primeiro dado/);
      assert.match(systemPrompt, /payerName, payerDocument, amount, description, recipientName, recipientDocument, city e date/);
      assert.match(systemPrompt, /"date":"2026-09-01"/);
      assert.match(systemPrompt, /"recebi" e "me pagou" não revelam o nome do recebedor/);
      assert.match(systemPrompt, /Organizei o valor, o pagador, a referência, a cidade e a data/);
      assert.match(systemPrompt, /"recipientName":"João Neves","city":"Aracruz"/);
      item.expectedPromptFragments.forEach((fragment) => assert.ok(systemPrompt.includes(fragment)));
    });
  }
});

test('prompt do currículo varre campos aninhados e preserva IDs em continuações', async (context) => {
  const cases = [
    'Sou contador, moro em Aracruz, trabalhei de 2020 a 2025 na Empresa X como analista fiscal e tenho experiência com imposto de renda e departamento fiscal.',
    'Meu nome é Ana Lima, sou designer de produto e uso Figma e pesquisa com usuários.',
    'Na Empresa Alfa também liderei o fechamento mensal.'
  ];

  for (const message of cases) {
    await context.test(message, () => {
      const messages = buildAiDocumentMessages(promptInput('resume', message, {
        experiences: [{ id: 'experience-2', company: 'Empresa Alfa' }]
      }));
      const systemPrompt = messages[0].content;
      const requestContext = JSON.parse(messages[1].content);

      assert.equal(requestContext.message, message);
      assert.match(systemPrompt, /personal, professionalSummary, experiences, education, courses e skills/);
      assert.match(systemPrompt, /"professionalTitle":"Contador"/);
      assert.match(systemPrompt, /"company":"Empresa X"/);
      assert.match(systemPrompt, /"startDate":"2020-01"/);
      assert.match(systemPrompt, /"name":"Departamento fiscal"/);
      assert.match(systemPrompt, /preserve os IDs internos/);
      assert.match(systemPrompt, /Não mencione foto/);
    });
  }
});

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
