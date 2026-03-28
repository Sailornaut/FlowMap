import { supabase, isSupabaseConfigured, getSupabaseSession } from "@/lib/supabase";

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }

  return `https://${trimmed.replace(/\/$/, "")}`;
}

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
}

async function getAccessToken() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const session = await getSupabaseSession();

  return session?.access_token || null;
}

export async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = new Headers(options.headers || {});
  const requestUrl = buildApiUrl(path);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(`Failed to fetch (${requestUrl})`, { cause: error });
  }
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

export async function createAddonCheckoutSession() {
  const response = await apiFetch("/api/billing/addon-checkout", {
    method: "POST",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not create add-on checkout session.");
  }

  return payload;
}

export async function getCheckoutSessionStatus(sessionId) {
  const response = await apiFetch(`/api/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not verify checkout session.");
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
