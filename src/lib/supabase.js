import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

let cachedSession = null;
let sessionRequest = null;

async function fetchSessionWithRetry() {
  if (!supabase) {
    return null;
  }

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      cachedSession = session;
      return session;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw lastError;
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session;
  });
}

export async function getSupabaseSession() {
  if (!supabase) {
    return null;
  }

  if (cachedSession) {
    return cachedSession;
  }

  if (!sessionRequest) {
    sessionRequest = fetchSessionWithRetry().finally(() => {
      sessionRequest = null;
    });
  }

  return sessionRequest;
}
