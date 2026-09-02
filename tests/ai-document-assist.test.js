import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAiResponseSchema,
  getOpenAiResponseSchema,
  normalizeOpenAiNullableResponse,
  parseAiAssistantResponse,
  validateAndSanitizeAiRequest
} from '../api/_documentAiSchemas.js';
import {
  AI_TIMEZONE,
  buildAiDocumentMessages,
  currentDateInTimezone
} from '../api/_documentAiPrompts.js';
import {
  createAiDocumentAssistHandler,
  DEFAULT_OPENAI_MODEL
} from '../api/ai-document-assist.js';

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  OPENAI_API_KEY: 'openai-test-key',
  OPENAI_MODEL: 'gpt-5.6-luna-test'
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

function openAiRawText(text) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        status: 'completed',
        output: [
          { type: 'reasoning', content: [] },
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text }]
          }
        ]
      };
    }
  });
}

function openAiResponse(response) {
  return openAiRawText(JSON.stringify(response));
}

function openAiSuccess(patch = {}) {
  return openAiResponse({
    assistantMessage: 'Dados organizados.',
    patch
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

test('mantém o modelo OpenAI padrão definido para a integração', () => {
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.6-luna');
});

test('schema da IA aplica regras específicas aos campos do recibo', () => {
  const schema = getAiResponseSchema('receipt');
  const fields = schema.properties.patch.properties;

  assert.equal(fields.payerName.maxLength, 150);
  assert.equal(fields.recipientName.maxLength, 150);
  assert.equal(fields.payerDocument.maxLength, 30);
  assert.equal(fields.recipientDocument.maxLength, 30);
  assert.equal(fields.amount.maxLength, 30);
  assert.match('450.50', new RegExp(fields.amount.pattern));
  assert.doesNotMatch('R$ 450 porque...', new RegExp(fields.amount.pattern));
  assert.equal(fields.description.maxLength, 300);
  assert.equal(fields.city.maxLength, 120);
  assert.equal(fields.date.minLength, 10);
  assert.equal(fields.date.maxLength, 10);
  assert.match('2026-09-01', new RegExp(fields.date.pattern));
  assert.doesNotMatch('hoje', new RegExp(fields.date.pattern));
  assert.deepEqual(schema.properties.patch.required, undefined);
  assert.equal(schema.properties.assistantMessage.maxLength, 400);
});

test('adapta o schema do recibo para Structured Outputs strict sem alterar o schema interno', () => {
  const internalSchema = getAiResponseSchema('receipt');
  const openAiSchema = getOpenAiResponseSchema('receipt');
  const patch = openAiSchema.properties.patch;

  assert.deepEqual(internalSchema.properties.patch.required, undefined);
  assert.deepEqual(patch.required, [
    'payerName',
    'payerDocument',
    'recipientName',
    'recipientDocument',
    'amount',
    'description',
    'city',
    'date'
  ]);
  assert.equal(patch.additionalProperties, false);
  assert.deepEqual(patch.properties.payerName.type, ['string', 'null']);
  assert.deepEqual(patch.properties.amount.type, ['string', 'null']);
  assert.equal(patch.properties.amount.pattern, internalSchema.properties.patch.properties.amount.pattern);
});

test('adapta objetos e itens do currículo para campos nullable e arrays obrigatórios', () => {
  const schema = getOpenAiResponseSchema('resume');
  const patch = schema.properties.patch;
  const experience = patch.properties.experiences.items;
  const activity = experience.properties.activities.items;

  assert.deepEqual(patch.required, [
    'personal',
    'professionalSummary',
    'education',
    'courses',
    'skills',
    'experiences'
  ]);
  assert.deepEqual(patch.properties.personal.required, [
    'fullName',
    'professionalTitle',
    'phone',
    'email',
    'location'
  ]);
  assert.deepEqual(patch.properties.personal.properties.email.type, ['string', 'null']);
  assert.deepEqual(patch.properties.professionalSummary.type, ['string', 'null']);
  assert.equal(patch.properties.experiences.type, 'array');
  assert.equal(experience.additionalProperties, false);
  assert.deepEqual(experience.required, [
    'id',
    'company',
    'role',
    'startDate',
    'endDate',
    'current',
    'activities'
  ]);
  assert.deepEqual(experience.properties.current.type, ['boolean', 'null']);
  assert.equal(experience.properties.activities.type, 'array');
  assert.deepEqual(activity.required, ['id', 'description']);
  assert.deepEqual(activity.properties.description.type, ['string', 'null']);
});

test('normaliza null como ausência sem convertê-lo em texto ou string vazia', () => {
  assert.deepEqual(normalizeOpenAiNullableResponse({
    assistantMessage: 'Dados organizados.',
    patch: {
      payerName: 'Maria Silva',
      recipientName: null,
      amount: '450',
      description: null
    }
  }), {
    assistantMessage: 'Dados organizados.',
    patch: {
      payerName: 'Maria Silva',
      amount: '450'
    }
  });
});

test('remove placeholders e explicações do patch final do recibo', () => {
  const result = parseAiAssistantResponse('receipt', {
    assistantMessage: 'Organizei os dados encontrados.',
    patch: {
      payerName: 'Maria Silva',
      amount: '450',
      description: 'manutenção de computador',
      city: 'Aracruz',
      date: '2026-09-01',
      recipientName: '(vazio) - não foi possível inferir o nome do recebedor com segurança porque a mensagem não informou...'
    }
  });

  assert.deepEqual(result.patch, {
    payerName: 'Maria Silva',
    amount: '450',
    description: 'manutenção de computador',
    city: 'Aracruz',
    date: '2026-09-01'
  });
});

test('valida deterministicamente valores estruturados do recibo', async (context) => {
  const cases = [
    { field: 'recipientName', value: 'João Neves', expected: 'João Neves' },
    { field: 'amount', value: '450', expected: '450' },
    { field: 'amount', value: 'R$ 450 porque foi pago hoje', expected: undefined },
    { field: 'date', value: '2026-09-01', expected: '2026-09-01' },
    { field: 'date', value: 'hoje', expected: undefined },
    { field: 'date', value: '2026-02-31', expected: undefined },
    { field: 'city', value: `Aracruz ${'explicação '.repeat(20)}`, expected: undefined }
  ];

  for (const item of cases) {
    await context.test(`${item.field}: ${item.value.slice(0, 30)}`, () => {
      const result = parseAiAssistantResponse('receipt', {
        assistantMessage: 'Dados organizados.',
        patch: { [item.field]: item.value }
      });
      assert.equal(result.patch[item.field], item.expected);
    });
  }
});

test('preserva valores existentes do currentPayload sem submetê-los às regras estritas do patch', () => {
  const input = validateAndSanitizeAiRequest(validBody({
    currentPayload: {
      payerName: 'Maria Silva',
      amount: 'R$ 450,00',
      description: 'Serviço já informado'
    }
  }));

  assert.deepEqual(input.currentPayload, {
    payerName: 'Maria Silva',
    amount: 'R$ 450,00',
    description: 'Serviço já informado'
  });
});

test('remove placeholders dos campos estruturados do currículo sem bloquear textos livres', () => {
  const result = parseAiAssistantResponse('resume', {
    assistantMessage: 'Organizei os dados válidos.',
    patch: {
      personal: {
        fullName: '(vazio)',
        professionalTitle: 'Analista fiscal'
      },
      professionalSummary: 'Profissional com experiência em rotinas fiscais e atendimento.',
      experiences: [{
        company: 'não foi possível inferir a empresa',
        role: 'Contador',
        activities: [{ description: 'Responsável pelo fechamento mensal.' }]
      }],
      education: [{ course: 'Ciências Contábeis', institution: 'não informado' }],
      skills: [{ name: 'campo ausente' }, { name: 'Excel' }]
    }
  });

  assert.deepEqual(result.patch.personal, { professionalTitle: 'Analista fiscal' });
  assert.equal(result.patch.professionalSummary, 'Profissional com experiência em rotinas fiscais e atendimento.');
  assert.deepEqual(result.patch.experiences[0], {
    role: 'Contador',
    activities: [{ description: 'Responsável pelo fechamento mensal.' }]
  });
  assert.deepEqual(result.patch.education[0], { course: 'Ciências Contábeis' });
  assert.deepEqual(result.patch.skills, [{ name: 'Excel' }]);
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
      expectedPromptFragments: ['somente recipientName recebe valor novo', 'Não repita nem apague']
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
      assert.match(systemPrompt, /recipientName recebe "João Neves", city recebe "Aracruz"/);
      assert.match(systemPrompt, /retorne null nesse campo/);
      assert.match(systemPrompt, /Explique a ausência somente em assistantMessage/);
      assert.match(systemPrompt, /Resposta proibida/);
      assert.match(systemPrompt, /"payerName":"Maria Silva","payerDocument":null/);
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
      assert.match(systemPrompt, /"março de 2020" vira "2020-03"/);
      assert.match(systemPrompt, /somente anos, não invente meses/);
      assert.match(systemPrompt, /startDate e endDate retornam null/);
      assert.doesNotMatch(systemPrompt, /"startDate":"2020-01"/);
      assert.doesNotMatch(systemPrompt, /"endDate":"2025-12"/);
      assert.match(systemPrompt, /"name":"Departamento fiscal"/);
      assert.match(systemPrompt, /preserve os IDs internos/);
      assert.match(systemPrompt, /Não mencione foto/);
      assert.match(systemPrompt, /campos opcionais sem informação segura/);
    });
  }
});

test('rejeita métodos diferentes de POST', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, { method: 'GET' });

  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'POST');
});

test('rejeita chamada sem Bearer token', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, { body: validBody() });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'UNAUTHORIZED');
});

test('rejeita serviceType desconhecido', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody({ serviceType: 'invoice' })
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_SERVICE_TYPE');
});

test('rejeita mensagem maior que 4000 caracteres', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody({ message: 'a'.repeat(4001) })
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_MESSAGE');
});

test('remove a foto do currículo antes de chamar a OpenAI', async () => {
  let openAiRequest;
  const fetchImpl = async (_url, options) => {
    openAiRequest = JSON.parse(options.body);
    return openAiSuccess({ personal: { fullName: 'Maria' } })();
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

  const promptPayload = JSON.parse(openAiRequest.input[1].content);
  assert.equal(result.status, 200);
  assert.equal('photo' in promptPayload.currentPayload.personal, false);
  assert.equal(JSON.stringify(openAiRequest).includes('secret-photo'), false);
  assert.deepEqual(result.body.patch.personal, { fullName: 'Maria' });
  assert.equal(JSON.stringify(result.body).includes(env.OPENAI_API_KEY), false);
});

test('rejeita campos que tentam controlar modelo ou system prompt', async () => {
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: { ...validBody(), model: 'outro-modelo' }
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'UNSUPPORTED_FIELD');
});

test('envia à Responses API o modelo configurado e Structured Outputs strict sem incluir a chave no body', async () => {
  let requestUrl;
  let requestOptions;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return openAiSuccess({ payerName: 'Maria Silva', amount: '450' })();
  };
  const handler = createAiDocumentAssistHandler({ createClientImpl, fetchImpl, env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody()
  });
  const requestBody = JSON.parse(requestOptions.body);

  assert.equal(result.status, 200);
  assert.equal(requestUrl, 'https://api.openai.com/v1/responses');
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.headers.Authorization, `Bearer ${env.OPENAI_API_KEY}`);
  assert.equal(requestBody.model, env.OPENAI_MODEL);
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.reasoning.effort, 'none');
  assert.equal(requestBody.text.format.type, 'json_schema');
  assert.equal(requestBody.text.format.name, 'resodi_document_assist');
  assert.equal(requestBody.text.format.strict, true);
  assert.deepEqual(requestBody.text.format.schema, getOpenAiResponseSchema('receipt'));
  assert.equal(Number.isInteger(requestBody.max_output_tokens), true);
  assert.equal(JSON.stringify(requestBody).includes(env.OPENAI_API_KEY), false);
});

test('usa gpt-5.6-luna quando OPENAI_MODEL não está configurado', async () => {
  let requestBody;
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return openAiSuccess()();
  };
  const handler = createAiDocumentAssistHandler({
    createClientImpl,
    fetchImpl,
    env: { ...env, OPENAI_MODEL: '' }
  });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody()
  });

  assert.equal(result.status, 200);
  assert.equal(requestBody.model, DEFAULT_OPENAI_MODEL);
});

test('normaliza resposta nullable do recibo antes da sanitização', async () => {
  const response = {
    assistantMessage: 'Organizei o pagador, o valor, a referência, a cidade e a data.',
    patch: {
      payerName: 'Maria Silva',
      payerDocument: null,
      recipientName: null,
      recipientDocument: null,
      amount: '450',
      description: 'manutenção de computador',
      city: 'Aracruz',
      date: '2026-09-02'
    }
  };
  const handler = createAiDocumentAssistHandler({
    createClientImpl,
    fetchImpl: openAiResponse(response),
    env
  });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody({
      message: 'Recebi R$ 450 de Maria Silva referente à manutenção de computador em Aracruz hoje.'
    })
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    assistantMessage: response.assistantMessage,
    patch: {
      payerName: 'Maria Silva',
      amount: '450',
      description: 'manutenção de computador',
      city: 'Aracruz',
      date: '2026-09-02'
    }
  });
  assert.equal('recipientName' in result.body.patch, false);
});

test('normaliza resposta nullable do currículo e preserva IDs e arrays válidos', async () => {
  const response = {
    assistantMessage: 'Organizei o resumo, a experiência e a formação.',
    patch: {
      personal: {
        fullName: null,
        professionalTitle: null,
        phone: null,
        email: null,
        location: null
      },
      professionalSummary: 'Profissional com experiência em rotinas fiscais.',
      education: [{
        id: null,
        course: 'Ciências Contábeis',
        institution: null,
        startDate: null,
        endDate: null
      }],
      courses: [],
      skills: [],
      experiences: [{
        id: 'experience-2',
        company: null,
        role: 'Analista fiscal',
        startDate: null,
        endDate: null,
        current: null,
        activities: [{
          id: null,
          description: 'Responsável pelo fechamento mensal.'
        }]
      }]
    }
  };
  const handler = createAiDocumentAssistHandler({
    createClientImpl,
    fetchImpl: openAiResponse(response),
    env
  });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    body: validBody({ serviceType: 'resume' })
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.patch, {
    personal: {},
    professionalSummary: 'Profissional com experiência em rotinas fiscais.',
    education: [{ course: 'Ciências Contábeis' }],
    courses: [],
    skills: [],
    experiences: [{
      id: 'experience-2',
      role: 'Analista fiscal',
      activities: [{ description: 'Responsável pelo fechamento mensal.' }]
    }]
  });
});

test('preserva o contrato público para configuração, quota, provedor, timeout e resposta inválida', async (context) => {
  const cases = [
    {
      name: 'OPENAI_API_KEY ausente',
      env: { ...env, OPENAI_API_KEY: '' },
      fetchImpl: openAiSuccess(),
      status: 503,
      error: 'SERVICE_NOT_CONFIGURED'
    },
    {
      name: 'OpenAI 429',
      env,
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        async json() { return { error: { message: 'quota detail must stay private' } }; }
      }),
      status: 429,
      error: 'AI_QUOTA'
    },
    {
      name: 'OpenAI 5xx',
      env,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        async json() { throw new Error('provider detail must stay private'); }
      }),
      status: 502,
      error: 'AI_PROVIDER_ERROR'
    },
    {
      name: 'timeout',
      env,
      fetchImpl: async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
      status: 504,
      error: 'AI_TIMEOUT'
    },
    {
      name: 'JSON inválido',
      env,
      fetchImpl: openAiRawText('not-json'),
      status: 502,
      error: 'INVALID_AI_RESPONSE'
    },
    {
      name: 'resposta incompleta',
      env,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            status: 'incomplete',
            output: [{
              type: 'message',
              content: [{ type: 'output_text', text: '{}' }]
            }]
          };
        }
      }),
      status: 502,
      error: 'INVALID_AI_RESPONSE'
    },
    {
      name: 'output ausente',
      env,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() { return { status: 'completed' }; }
      }),
      status: 502,
      error: 'INVALID_AI_RESPONSE'
    }
  ];

  for (const item of cases) {
    await context.test(item.name, async () => {
      const handler = createAiDocumentAssistHandler({
        createClientImpl,
        fetchImpl: item.fetchImpl,
        env: item.env
      });
      const result = await invoke(handler, {
        authorization: 'Bearer valid-token',
        body: validBody()
      });

      assert.equal(result.status, item.status);
      assert.deepEqual(result.body, { error: item.error });
      assert.equal(JSON.stringify(result.body).includes('must stay private'), false);
      assert.equal(JSON.stringify(result.body).includes(env.OPENAI_API_KEY), false);
    });
  }
});
