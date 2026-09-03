import { getDocumentDraftSession } from './documentDrafts';

const TRANSCRIPTION_TIMEOUT_MS = 35_000;

export class AiTranscriptionError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AiTranscriptionError';
    this.code = code;
  }
}

export async function requestAiTranscription(audioBlob, { signal: parentSignal } = {}) {
  const session = await getDocumentDraftSession();
  if (!session?.access_token) throw new AiTranscriptionError('SESSION_REQUIRED');

  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);
  const form = new FormData();
  form.append('audio', audioBlob, 'gravacao');

  try {
    const response = await fetch('/api/ai-transcribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form,
      signal: controller.signal
    });

    let body;
    try {
      body = await response.json();
    } catch {
      throw new AiTranscriptionError('INVALID_RESPONSE');
    }

    if (!response.ok) throw new AiTranscriptionError(body?.error || `HTTP_${response.status}`);
    if (typeof body?.text !== 'string' || !body.text.trim()) {
      throw new AiTranscriptionError('INVALID_RESPONSE');
    }
    return body.text.trim();
  } catch (error) {
    if (error?.name === 'AbortError') throw new AiTranscriptionError('TRANSCRIPTION_TIMEOUT');
    throw error;
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}
