const required = (value, name) => {
  if (!value) {
    throw new Error(`Falta configurar ${name}`);
  }
  return value;
};

export const appEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  businessTimezone:
    import.meta.env.VITE_BUSINESS_TIMEZONE || 'America/Argentina/Buenos_Aires',
  photoBucket: import.meta.env.VITE_SUPABASE_BUCKET || 'time-entry-photos',
};

export function assertSupabaseEnv() {
  return {
    supabaseUrl: required(appEnv.supabaseUrl, 'VITE_SUPABASE_URL'),
    supabaseAnonKey: required(
      appEnv.supabaseAnonKey,
      'VITE_SUPABASE_ANON_KEY'
    ),
  };
}
