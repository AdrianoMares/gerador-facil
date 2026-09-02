import { createClient } from '@supabase/supabase-js';
import {
  AI_MODEL,
  AiRequestError,
  getAiResponseSchema,
  MAX_AI_BODY_BYTES,
  parseAiAssistantResponse,
  validateAndSanitizeAiRequest
} from './_documentAiSchemas.js';
import { buildAiDocumentMessages } from './_documentAiPrompts.js';

const CLOUDFLARE_TIMEOUT_MS = 18_000;

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

function cloudflareRequestBody(input) {
  return {
    messages: buildAiDocumentMessages(input),
    response_format: {
      type: 'json_schema',
      json_schema: getAiResponseSchema(input.serviceType)
    },
    temperature: 0.2,
    max_tokens: 1_600,
    stream: false
  };
}

function cloudflareErrorCode(payload) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  return errors[0]?.code;
}

async function callCloudflare(input, fetchImpl, env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN;
  if (!accountId || !apiToken) throw new Error('AI_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_TIMEOUT_MS);

  try {
    const response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${AI_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cloudflareRequestBody(input)),
        signal: controller.signal
      }
    );

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new AiRequestError('INVALID_AI_RESPONSE');
    }

    if (!response.ok || payload?.success === false) {
      const code = cloudflareErrorCode(payload);
      if (response.status === 429 || code === 7505) {
        throw new AiRequestError('AI_QUOTA');
      }
      throw new AiRequestError('AI_PROVIDER_ERROR');
    }

    const result = payload?.result?.response;
    return parseAiAssistantResponse(input.serviceType, result);
  } catch (error) {
    if (error?.name === 'AbortError') throw new AiRequestError('AI_TIMEOUT');
    throw error;
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
      const result = await callCloudflare(input, fetchImpl, env);
      return sendJson(response, 200, result);
    } catch (error) {
      const { status, code } = publicError(error);
      return sendJson(response, status, { error: code });
    }
  };
}

export default createAiDocumentAssistHandler();
