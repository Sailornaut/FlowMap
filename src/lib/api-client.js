import { supabase, isSupabaseConfigured } from "@/lib/supabase";

async function getAccessToken() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || null;
}

export async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(path, {
    ...options,
    headers,
  });
}

export async function getAccountSummary() {
  const response = await apiFetch("/api/account");
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not load account.");
  }

  return payload;
}

export async function createCheckoutSession(plan) {
  const response = await apiFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not create checkout session.");
  }

  return payload;
}

export async function createPortalSession() {
  const response = await apiFetch("/api/billing/portal", {
    method: "POST",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not create billing portal session.");
  }

  return payload;
}
