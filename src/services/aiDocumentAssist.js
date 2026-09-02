import { getDocumentDraftSession } from './documentDrafts';

const AI_REQUEST_TIMEOUT_MS = 25_000;
const MAX_CONVERSATION_MESSAGES = 8;

export class AiDocumentAssistError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AiDocumentAssistError';
    this.code = code;
  }
}

function withoutResumePhoto(serviceType, payload) {
  if (serviceType !== 'resume' || !payload?.personal) return payload;
  const personal = { ...payload.personal };
  delete personal.photo;
  return { ...payload, personal };
}

export async function requestAiDocumentAssist({
  serviceType,
  message,
  currentPayload,
  conversation
}) {
  const session = await getDocumentDraftSession();
  if (!session?.access_token) throw new AiDocumentAssistError('SESSION_REQUIRED');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/ai-document-assist', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        serviceType,
        message,
        currentPayload: withoutResumePhoto(serviceType, currentPayload),
        conversation: conversation.slice(-MAX_CONVERSATION_MESSAGES)
      }),
      signal: controller.signal
    });

    let body;
    try {
      body = await response.json();
    } catch {
      throw new AiDocumentAssistError('INVALID_RESPONSE');
    }

    if (!response.ok) {
      throw new AiDocumentAssistError(body?.error || `HTTP_${response.status}`);
    }

    if (typeof body?.assistantMessage !== 'string' || !body?.patch || typeof body.patch !== 'object') {
      throw new AiDocumentAssistError('INVALID_RESPONSE');
    }

    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new AiDocumentAssistError('AI_TIMEOUT');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
