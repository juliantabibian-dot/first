import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { DEMO_URL, demoFetch } from './demo';
import { safeStorage } from './safeStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Without Supabase keys the app runs as a self-contained demo: a stand-in
 * backend on the phone answers every request, and no text is ever sent.
 */
export const isDemo = !(url && anonKey);

export const supabase: SupabaseClient = createClient(
  isDemo ? DEMO_URL : url!,
  isDemo ? 'demo' : anonKey!,
  {
    auth: {
      storage: safeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: isDemo ? { fetch: demoFetch } : undefined,
  },
);
