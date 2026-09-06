import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAiTranscribeHandler,
  DEFAULT_TRANSCRIPTION_MODEL,
  MAX_AUDIO_BYTES,
  MAX_TRANSCRIPTION_BODY_BYTES
} from '../api/_aiTranscribe.js';

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  OPENAI_API_KEY: 'openai-transcription-test-key'
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

async function multipartBody({ type = 'audio/webm', bytes = new Uint8Array([1, 2, 3]), includeAudio = true } = {}) {
  const form = new FormData();
  if (includeAudio) form.append('audio', new Blob([bytes], { type }), 'gravacao');
  const request = new Request('http://localhost/api/ai-transcribe', { method: 'POST', body: form });
  const body = Buffer.from(await request.arrayBuffer());
  return {
    body,
    headers: {
      'content-type': request.headers.get('content-type'),
      'content-length': String(body.length)
    }
  };
}

function openAiSuccess(payload = { text: 'Texto transcrito.' }) {
  return async () => ({
    ok: true,
    status: 200,
    async json() { return payload; }
  });
}

test('ai-transcribe rejeita GET', async () => {
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, { method: 'GET' });

  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'POST');
  assert.deepEqual(result.body, { error: 'METHOD_NOT_ALLOWED' });
});

test('ai-transcribe rejeita chamada sem Bearer', async () => {
  const request = await multipartBody();
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, request);

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'UNAUTHORIZED' });
});

test('ai-transcribe rejeita arquivo ausente', async () => {
  const request = await multipartBody({ includeAudio: false });
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, { ...request, authorization: 'Bearer valid-token' });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'AUDIO_REQUIRED' });
});

test('ai-transcribe rejeita áudio grande pelo limite do body', async () => {
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, {
    authorization: 'Bearer valid-token',
    headers: {
      'content-type': 'multipart/form-data; boundary=test',
      'content-length': String(MAX_TRANSCRIPTION_BODY_BYTES + 1)
    },
    body: Buffer.alloc(0)
  });

  assert.equal(result.status, 413);
  assert.deepEqual(result.body, { error: 'AUDIO_TOO_LARGE' });
});

test('ai-transcribe rejeita arquivo de áudio acima de 4 MB', async () => {
  const request = await multipartBody({ bytes: new Uint8Array(MAX_AUDIO_BYTES + 1) });
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, { ...request, authorization: 'Bearer valid-token' });

  assert.equal(result.status, 413);
  assert.deepEqual(result.body, { error: 'AUDIO_TOO_LARGE' });
});

test('ai-transcribe rejeita tipo inválido', async () => {
  const request = await multipartBody({ type: 'text/plain' });
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl: openAiSuccess(), env });
  const result = await invoke(handler, { ...request, authorization: 'Bearer valid-token' });

  assert.equal(result.status, 415);
  assert.deepEqual(result.body, { error: 'INVALID_AUDIO_TYPE' });
});

test('ai-transcribe autentica a OpenAI somente no backend e retorna apenas text', async () => {
  let requestUrl;
  let requestOptions;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return openAiSuccess({ text: '  Sou contador e trabalho na área fiscal.  ', raw: 'não retornar' })();
  };
  const request = await multipartBody();
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl, env });
  const result = await invoke(handler, { ...request, authorization: 'Bearer valid-token' });

  assert.equal(requestUrl, 'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.headers.Authorization, `Bearer ${env.OPENAI_API_KEY}`);
  assert.equal(requestOptions.headers.Authorization.includes('valid-token'), false);
  assert.equal(requestOptions.body.get('model'), DEFAULT_TRANSCRIPTION_MODEL);
  assert.equal(requestOptions.body.get('language'), 'pt');
  assert.equal(requestOptions.body.get('response_format'), 'json');
  assert.equal(requestOptions.body.get('file').type, 'audio/webm');
  assert.deepEqual(result.body, { text: 'Sou contador e trabalho na área fiscal.' });
  assert.equal(JSON.stringify(result.body).includes(env.OPENAI_API_KEY), false);
  assert.equal(JSON.stringify(result.body).includes('não retornar'), false);
});

test('ai-transcribe não expõe resposta bruta em erro da OpenAI', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 500,
    async json() { return { error: { message: 'segredo do provedor' } }; }
  });
  const request = await multipartBody();
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl, env });
  const result = await invoke(handler, { ...request, authorization: 'Bearer valid-token' });

  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { error: 'TRANSCRIPTION_FAILED' });
  assert.equal(JSON.stringify(result.body).includes('segredo do provedor'), false);
});

test('ai-transcribe trata timeout', async () => {
  const fetchImpl = async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };
  const request = await multipartBody();
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl, env });
  const result = await invoke(handler, { ...request, authorization: 'Bearer valid-token' });

  assert.equal(result.status, 504);
  assert.deepEqual(result.body, { error: 'TRANSCRIPTION_TIMEOUT' });
});

test('ai-transcribe rejeita transcrição vazia', async () => {
  const request = await multipartBody();
  const handler = createAiTranscribeHandler({ createClientImpl, fetchImpl: openAiSuccess({ text: '   ' }), env });
  const result = await invoke(handler, { ...request, authorization: 'Bearer valid-token' });

  assert.equal(result.status, 422);
  assert.deepEqual(result.body, { error: 'EMPTY_TRANSCRIPTION' });
});
