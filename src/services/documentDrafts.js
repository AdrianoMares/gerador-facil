import { supabase } from './supabase';
import {
  createAnonymousSession,
  getSupabaseSession,
  isSupabaseSessionConfigured
} from './anonymousSession.js';

const draftFields = 'id, payload, status, revision, updated_at';

export class DocumentDraftConflictError extends Error {
  constructor() {
    super('O rascunho foi alterado em outra sessão.');
    this.name = 'DocumentDraftConflictError';
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase não está configurado.');
  }

  return supabase;
}

export function isDocumentDraftStorageConfigured() {
  return isSupabaseSessionConfigured();
}

export async function getDocumentDraftSession() {
  return getSupabaseSession();
}

export async function createAnonymousDocumentSession(captchaToken) {
  return createAnonymousSession(captchaToken);
}

export async function getLatestDocumentDraft(serviceType) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('document_drafts')
    .select(draftFields)
    .eq('service_type', serviceType)
    .in('status', ['draft', 'ready'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateDocumentDraft({ id, payload, status, revision }) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('document_drafts')
    .update({ payload, status })
    .eq('id', id)
    .eq('revision', revision)
    .select(draftFields)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new DocumentDraftConflictError();
  return data;
}

export async function createDocumentDraft({ serviceType, payload }) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('document_drafts')
    .insert({ service_type: serviceType, payload })
    .select(draftFields)
    .single();

  if (error) throw error;
  return data;
}
