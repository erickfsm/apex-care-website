import { createClient as createSupabaseClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
/**
 * @fileoverview Initializes and exports the Supabase client.
 * @module supabase-client
 */

const globalEnv = typeof window !== 'undefined' ? window : {};
const embeddedEnv = globalEnv.__ENV__ || {};

/**
 * @constant {string} SUPABASE_URL
 * @description The URL of the Supabase project.
 */
const SUPABASE_URL =
  embeddedEnv.SUPABASE_URL ||
  globalEnv.SUPABASE_URL ||
  'https://xrajjehettusnbvjielf.supabase.co';

/**
 * @constant {string} SUPABASE_ANON_KEY
 * @description The anonymous key for the Supabase project.
 */
const SUPABASE_ANON_KEY =
  embeddedEnv.SUPABASE_ANON_KEY ||
  globalEnv.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] Missing configuration. Please define SUPABASE_URL and SUPABASE_ANON_KEY.'
  );
}

/**
 * @constant {object} supabase
 * @description The Supabase client instance.
 */
export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Gets the Supabase configuration.
 * @returns {object} An object with the Supabase URL and anonymous key.
 */
export const getSupabaseConfig = () => ({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
});

/**
 * Re-exports the Supabase client creation function.
 * @function createClient
 */
export { createSupabaseClient as createClient };
