import { supabase } from './supabase';

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
  return Boolean(supabase);
}

export async function getDocumentDraftSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();

  if (error) throw error;
  return data.session;
}

export async function createAnonymousDocumentSession(captchaToken) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInAnonymously({
    options: { captchaToken }
  });

  if (error) throw error;
  return data.session;
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
