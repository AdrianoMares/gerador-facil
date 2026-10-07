import { supabase } from './supabase.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase não está configurado.');
  }

  return supabase;
}

export function isSupabaseSessionConfigured() {
  return Boolean(supabase);
}

export async function getSupabaseSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();

  if (error) throw error;
  return data.session;
}

export async function createAnonymousSession(captchaToken) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInAnonymously({
    options: { captchaToken }
  });

  if (error) throw error;
  return data.session;
}
