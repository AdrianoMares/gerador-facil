import { createClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  requestContentLength,
  sendJson
} from './_documentAiAuth.js';

export const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
export const MAX_AUDIO_BYTES = 4_000_000;
export const MAX_TRANSCRIPTION_BODY_BYTES = 4_250_000;
export const MAX_TRANSCRIPTION_LENGTH = 4_000;

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_TIMEOUT_MS = 30_000;
const SUPPORTED_AUDIO_TYPES = new Map([
  ['audio/flac', 'flac'],
  ['audio/mp3', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/mpeg', 'mp3'],
  ['audio/ogg', 'ogg'],
  ['audio/wav', 'wav'],
  ['audio/webm', 'webm'],
  ['audio/x-wav', 'wav']
]);

class TranscriptionError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function contentType(request) {
  return request.headers?.['content-type'] || '';
}

function multipartBoundary(value) {
  const match = String(value).match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = match?.[1] || match?.[2];
  return boundary && boundary.length <= 200 ? boundary : null;
}

async function readRequestBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (request.body instanceof Uint8Array) return Buffer.from(request.body);
  if (typeof request.body === 'string') return Buffer.from(request.body, 'binary');
  if (!request?.[Symbol.asyncIterator]) throw new TranscriptionError('INVALID_MULTIPART');

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_TRANSCRIPTION_BODY_BYTES) throw new TranscriptionError('AUDIO_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseContentDisposition(value) {
  const name = value.match(/(?:^|;)\s*name="([^"]+)"/i)?.[1];
  const filename = value.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1];
  return { name, filename };
}

function parseAudioPart(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const partBoundary = Buffer.from(`\r\n--${boundary}`);
  let cursor = body.indexOf(delimiter);
  let audioPart = null;

  while (cursor >= 0) {
    cursor += delimiter.length;
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from('--'))) break;
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from('\r\n'))) cursor += 2;

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) throw new TranscriptionError('INVALID_MULTIPART');
    const nextBoundary = body.indexOf(partBoundary, headerEnd + 4);
    if (nextBoundary < 0) throw new TranscriptionError('INVALID_MULTIPART');

    const headers = Object.fromEntries(
      body.subarray(cursor, headerEnd).toString('latin1').split('\r\n').flatMap((line) => {
        const separator = line.indexOf(':');
        return separator < 0
          ? []
          : [[line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()]];
      })
    );
    const disposition = parseContentDisposition(headers['content-disposition'] || '');

    if (disposition.name === 'audio' && disposition.filename !== undefined) {
      if (audioPart) throw new TranscriptionError('INVALID_MULTIPART');
      audioPart = {
        bytes: body.subarray(headerEnd + 4, nextBoundary),
        type: String(headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      };
    }

    cursor = nextBoundary + 2;
  }

  return audioPart;
}

function validateAudioPart(audioPart) {
  if (!audioPart) throw new TranscriptionError('AUDIO_REQUIRED');
  if (!SUPPORTED_AUDIO_TYPES.has(audioPart.type)) throw new TranscriptionError('INVALID_AUDIO_TYPE');
  if (!audioPart.bytes.length) throw new TranscriptionError('AUDIO_REQUIRED');
  if (audioPart.bytes.length > MAX_AUDIO_BYTES) throw new TranscriptionError('AUDIO_TOO_LARGE');
  return audioPart;
}

async function callOpenAi(audio, fetchImpl, env) {
  if (!env.OPENAI_API_KEY) throw new Error('AI_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  const form = new FormData();
  const extension = SUPPORTED_AUDIO_TYPES.get(audio.type);
  form.append('file', new Blob([audio.bytes], { type: audio.type }), `gravacao.${extension}`);
  form.append('model', env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  try {
    const response = await fetchImpl(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 429) throw new TranscriptionError('AI_QUOTA');
      throw new TranscriptionError('TRANSCRIPTION_FAILED');
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new TranscriptionError('TRANSCRIPTION_FAILED');
    }

    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) throw new TranscriptionError('EMPTY_TRANSCRIPTION');
    if (text.length > MAX_TRANSCRIPTION_LENGTH) throw new TranscriptionError('TRANSCRIPTION_TOO_LONG');
    return text;
  } catch (error) {
    if (error?.name === 'AbortError') throw new TranscriptionError('TRANSCRIPTION_TIMEOUT');
    if (error instanceof TranscriptionError) throw error;
    throw new TranscriptionError('TRANSCRIPTION_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

function publicError(error) {
  if (error instanceof TranscriptionError) {
    if (['AUDIO_REQUIRED', 'INVALID_MULTIPART'].includes(error.code)) return { status: 400, code: error.code };
    if (error.code === 'INVALID_AUDIO_TYPE') return { status: 415, code: error.code };
    if (error.code === 'AUDIO_TOO_LARGE') return { status: 413, code: error.code };
    if (['EMPTY_TRANSCRIPTION', 'TRANSCRIPTION_TOO_LONG'].includes(error.code)) return { status: 422, code: error.code };
    if (error.code === 'AI_QUOTA') return { status: 429, code: error.code };
    if (error.code === 'TRANSCRIPTION_TIMEOUT') return { status: 504, code: error.code };
    return { status: 502, code: 'TRANSCRIPTION_FAILED' };
  }

  if (error?.message === 'AUTH_NOT_CONFIGURED' || error?.message === 'AI_NOT_CONFIGURED') {
    return { status: 503, code: 'SERVICE_NOT_CONFIGURED' };
  }

  return { status: 500, code: 'INTERNAL_ERROR' };
}

export function createAiTranscribeHandler({
  createClientImpl = createClient,
  fetchImpl = fetch,
  env = process.env
} = {}) {
  return async function aiTranscribe(request, response) {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    }

    if (requestContentLength(request) > MAX_TRANSCRIPTION_BODY_BYTES) {
      return sendJson(response, 413, { error: 'AUDIO_TOO_LARGE' });
    }

    try {
      const user = await authenticateRequest(request, createClientImpl, env);
      if (!user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const boundary = multipartBoundary(contentType(request));
      if (!boundary) throw new TranscriptionError('INVALID_MULTIPART');
      const body = await readRequestBody(request);
      if (body.length > MAX_TRANSCRIPTION_BODY_BYTES) throw new TranscriptionError('AUDIO_TOO_LARGE');
      const audio = validateAudioPart(parseAudioPart(body, boundary));
      const text = await callOpenAi(audio, fetchImpl, env);
      return sendJson(response, 200, { text });
    } catch (error) {
      const { status, code } = publicError(error);
      return sendJson(response, status, { error: code });
    }
  };
}

export default createAiTranscribeHandler();
