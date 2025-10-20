import { createClient as createSupabaseClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const globalEnv = typeof window !== 'undefined' ? window : {};
const embeddedEnv = globalEnv.__ENV__ || {};

const SUPABASE_URL =
  embeddedEnv.SUPABASE_URL ||
  globalEnv.SUPABASE_URL ||
  'https://xrajjehettusnbvjielf.supabase.co';

const SUPABASE_ANON_KEY =
  embeddedEnv.SUPABASE_ANON_KEY ||
  globalEnv.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] Missing configuration. Please define SUPABASE_URL and SUPABASE_ANON_KEY.'
  );
}

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const getSupabaseConfig = () => ({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
});
export { createSupabaseClient as createClient };
