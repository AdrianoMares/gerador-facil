import { createClient } from '@supabase/supabase-js';
import {
  AiRequestError,
  getOpenAiResponseSchema,
  MAX_AI_BODY_BYTES,
  normalizeOpenAiNullableResponse,
  parseAiAssistantResponse,
  validateAndSanitizeAiRequest
} from './_documentAiSchemas.js';
import { buildAiDocumentMessages } from './_documentAiPrompts.js';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-luna';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_TIMEOUT_MS = 20_000;
const OPENAI_MAX_OUTPUT_TOKENS = 1_600;

function setCommonHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function sendJson(response, status, body, extraHeaders = {}) {
  setCommonHeaders(response);
  Object.entries(extraHeaders).forEach(([key, value]) => response.setHeader(key, value));
  return response.status(status).json(body);
}

function bearerToken(authorization) {
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

function requestContentLength(request) {
  const value = Number(request.headers?.['content-length']);
  return Number.isFinite(value) ? value : 0;
}

function createAuthClient(createClientImpl, env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  return createClientImpl(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

async function authenticateRequest(request, createClientImpl, env) {
  const token = bearerToken(request.headers?.authorization);
  if (!token) return null;

  const supabase = createAuthClient(createClientImpl, env);
  if (!supabase) throw new Error('AUTH_NOT_CONFIGURED');

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

function openAiRequestBody(input, model) {
  return {
    model,
    input: buildAiDocumentMessages(input),
    text: {
      format: {
        type: 'json_schema',
        name: 'resodi_document_assist',
        strict: true,
        schema: getOpenAiResponseSchema(input.serviceType)
      }
    },
    reasoning: {
      effort: 'none'
    },
    store: false,
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS
  };
}

function extractOpenAiOutputText(payload) {
  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputItems) {
    if (item?.type !== 'message' || item.role !== 'assistant') continue;
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      if (content?.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text;
      }
    }
  }

  throw new AiRequestError('INVALID_AI_RESPONSE');
}

function parseOpenAiStructuredOutput(serviceType, payload) {
  if (payload?.status && payload.status !== 'completed') {
    throw new AiRequestError('INVALID_AI_RESPONSE');
  }

  const outputText = extractOpenAiOutputText(payload);
  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new AiRequestError('INVALID_AI_RESPONSE');
  }

  return parseAiAssistantResponse(
    serviceType,
    normalizeOpenAiNullableResponse(parsed)
  );
}

async function callOpenAi(input, fetchImpl, env) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  if (!apiKey) throw new Error('AI_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(openAiRequestBody(input, model)),
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new AiRequestError('AI_QUOTA');
      }
      throw new AiRequestError('AI_PROVIDER_ERROR');
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new AiRequestError('INVALID_AI_RESPONSE');
    }

    return parseOpenAiStructuredOutput(input.serviceType, payload);
  } catch (error) {
    if (error?.name === 'AbortError') throw new AiRequestError('AI_TIMEOUT');
    if (error instanceof AiRequestError) throw error;
    throw new AiRequestError('AI_PROVIDER_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

function publicError(error) {
  if (error instanceof AiRequestError) {
    if (['INVALID_BODY', 'UNSUPPORTED_FIELD', 'INVALID_SERVICE_TYPE', 'INVALID_MESSAGE', 'INVALID_CONVERSATION'].includes(error.code)) {
      return { status: 400, code: error.code };
    }
    if (error.code === 'AI_QUOTA') return { status: 429, code: error.code };
    if (error.code === 'AI_TIMEOUT') return { status: 504, code: error.code };
    return { status: 502, code: error.code };
  }

  if (error?.message === 'AUTH_NOT_CONFIGURED' || error?.message === 'AI_NOT_CONFIGURED') {
    return { status: 503, code: 'SERVICE_NOT_CONFIGURED' };
  }

  return { status: 500, code: 'INTERNAL_ERROR' };
}

export function createAiDocumentAssistHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env
} = {}) {
  return async function aiDocumentAssist(request, response) {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    }

    if (requestContentLength(request) > MAX_AI_BODY_BYTES) {
      return sendJson(response, 413, { error: 'BODY_TOO_LARGE' });
    }

    try {
      const user = await authenticateRequest(request, createClientImpl, env);
      if (!user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const input = validateAndSanitizeAiRequest(request.body);
      const result = await callOpenAi(input, fetchImpl, env);
      return sendJson(response, 200, result);
    } catch (error) {
      const { status, code } = publicError(error);
      return sendJson(response, status, { error: code });
    }
  };
}

export default createAiDocumentAssistHandler();
