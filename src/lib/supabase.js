import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv } from './env';

let client;

export function getSupabaseClient() {
  if (client) {
    return client;
  }

  const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv();
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
