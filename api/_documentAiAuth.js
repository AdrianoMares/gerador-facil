const PAGBANK_HOMOLOGATION_LOG_PREFIX = '[PAGBANK_HOMOLOGATION]';
const PAGBANK_HOMOLOGATION_LOG_CHUNK_SIZE = 1200;

// Temporary homologation aid: split only PagBank request/response evidence logs
// so Vercel does not truncate long JSON payloads. All other console.info calls
// keep their original behavior.
if (!globalThis.__resodiPagBankHomologationChunkLoggerInstalled) {
  const originalConsoleInfo = console.info.bind(console);

  console.info = (...args) => {
    const [prefix, serializedPayload, ...rest] = args;

    if (typeof prefix === 'string'
      && prefix.startsWith(PAGBANK_HOMOLOGATION_LOG_PREFIX)
      && typeof serializedPayload === 'string') {
      const totalChunks = Math.max(
        1,
        Math.ceil(serializedPayload.length / PAGBANK_HOMOLOGATION_LOG_CHUNK_SIZE)
      );
      let referenceId = 'unknown';

      try {
        const parsed = JSON.parse(serializedPayload);
        if (typeof parsed?.reference_id === 'string' && parsed.reference_id) {
          referenceId = parsed.reference_id;
        }
      } catch {
        // Keep logging the raw serialized payload even if it cannot be parsed.
      }

      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * PAGBANK_HOMOLOGATION_LOG_CHUNK_SIZE;
        const chunk = serializedPayload.slice(start, start + PAGBANK_HOMOLOGATION_LOG_CHUNK_SIZE);
        originalConsoleInfo(
          `${prefix}[REF:${referenceId}][CHUNK:${index + 1}/${totalChunks}]`,
          chunk
        );
      }
      return;
    }

    originalConsoleInfo(...args, ...rest);
  };

  globalThis.__resodiPagBankHomologationChunkLoggerInstalled = true;
}

export function setCommonHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export function sendJson(response, status, body, extraHeaders = {}) {
  setCommonHeaders(response);
  Object.entries(extraHeaders).forEach(([key, value]) => response.setHeader(key, value));
  return response.status(status).json(body);
}

export function bearerToken(authorization) {
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

export function requestContentLength(request) {
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

export async function authenticateRequest(request, createClientImpl, env) {
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
