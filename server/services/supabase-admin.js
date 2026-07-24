// @ts-check
/**
 * Supabase admin client (service-role key, server-only).
 * Shared singleton; never import from client code.
 */

import { createClient } from "@supabase/supabase-js";

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let client = null;

export function getSupabaseAdmin() {
  if (client) return client;

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}
