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

// --- Legacy billing functions removed: createCheckoutSession, createAddonCheckoutSession,
// getCheckoutSessionStatus, createPortalSession ---

// ---------------------------------------------------------------------------
// Workspace API — properties
// ---------------------------------------------------------------------------

export async function listProperties({ limit = 50, offset = 0 } = {}) {
  const response = await apiFetch(`/api/properties?limit=${limit}&offset=${offset}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not list properties.");
  }

  return payload;
}

export async function getProperty(id) {
  const response = await apiFetch(`/api/properties/${id}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not load property.");
  }

  return payload;
}

export async function createProperty(data) {
  const response = await apiFetch("/api/properties", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not create property.");
  }

  return payload;
}

export async function updateProperty(id, data) {
  const response = await apiFetch(`/api/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not update property.");
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Workspace API — analyses
// ---------------------------------------------------------------------------

export async function listAnalyses({ property_id, status, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (property_id) params.set("property_id", property_id);
  if (status) params.set("status", status);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const response = await apiFetch(`/api/analyses?${params}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not list analyses.");
  }

  return payload;
}

export async function getAnalysis(id) {
  const response = await apiFetch(`/api/analyses/${id}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not load analysis.");
  }

  return payload;
}

export async function createAnalysis(data) {
  const response = await apiFetch("/api/analyses", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not create analysis.");
  }

  return payload;
}

export async function executeAnalysis(id) {
  const response = await apiFetch(`/api/analyses/${id}/execute`, {
    method: "POST",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not execute analysis.");
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Workspace API — tenants & vacancies
// ---------------------------------------------------------------------------

export async function listTenants(propertyId) {
  const response = await apiFetch(`/api/properties/${propertyId}/tenants`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not list tenants.");
  }

  return payload;
}

export async function listVacancies(propertyId) {
  const response = await apiFetch(`/api/properties/${propertyId}/vacancies`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not list vacancies.");
  }

  return payload;
}

// ── Reports ──────────────────────────────────────────────────────────

export async function generateReport(analysisId) {
  const response = await apiFetch(`/api/reports/generate/${analysisId}`, {
    method: "POST",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not generate report.");
  }

  return payload;
}

export function getReportDownloadUrl(reportVersionId) {
  const base = import.meta.env.VITE_API_URL || "";
  return `${base}/api/reports/${reportVersionId}/download`;
}

export async function listReports({ property_id, analysis_run_id } = {}) {
  const params = new URLSearchParams();
  if (property_id) params.set("property_id", property_id);
  if (analysis_run_id) params.set("analysis_run_id", analysis_run_id);
  const qs = params.toString();
  const response = await apiFetch(`/api/reports${qs ? `?${qs}` : ""}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not list reports.");
  }

  return payload;
}

// ── Follow-ups ──────────────────────────────────────────────────────

export async function listFollowUps({ property_id, analysis_run_id, status, overdue } = {}) {
  const params = new URLSearchParams();
  if (property_id) params.set("property_id", property_id);
  if (analysis_run_id) params.set("analysis_run_id", analysis_run_id);
  if (status) params.set("status", status);
  if (overdue) params.set("overdue", "true");
  const qs = params.toString();
  const response = await apiFetch(`/api/follow-ups${qs ? `?${qs}` : ""}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not list follow-ups.");
  return payload;
}

export async function getFollowUp(id) {
  const response = await apiFetch(`/api/follow-ups/${id}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not fetch follow-up.");
  return payload;
}

export async function createFollowUp(data) {
  const response = await apiFetch("/api/follow-ups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not create follow-up.");
  return payload;
}

export async function updateFollowUp(id, data) {
  const response = await apiFetch(`/api/follow-ups/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not update follow-up.");
  return payload;
}

export async function generateFollowUps(analysisRunId, propertyId) {
  const response = await apiFetch("/api/follow-ups/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis_run_id: analysisRunId, property_id: propertyId }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not generate follow-ups.");
  return payload;
}

export async function getFollowUpSummary() {
  const response = await apiFetch("/api/follow-ups/summary");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not get follow-up summary.");
  return payload;
}

// ── Outcomes ────────────────────────────────────────────────────────

export async function listOutcomes({ property_id, analysis_run_id, vacancy_id, follow_up_id, evidence_type } = {}) {
  const params = new URLSearchParams();
  if (property_id) params.set("property_id", property_id);
  if (analysis_run_id) params.set("analysis_run_id", analysis_run_id);
  if (vacancy_id) params.set("vacancy_id", vacancy_id);
  if (follow_up_id) params.set("follow_up_id", follow_up_id);
  if (evidence_type) params.set("evidence_type", evidence_type);
  const qs = params.toString();
  const response = await apiFetch(`/api/outcomes${qs ? `?${qs}` : ""}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not list outcomes.");
  return payload;
}

export async function createOutcome(data) {
  const response = await apiFetch("/api/outcomes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not create outcome.");
  return payload;
}

export async function updateOutcome(id, data) {
  const response = await apiFetch(`/api/outcomes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not update outcome.");
  return payload;
}

// ── Lessons ─────────────────────────────────────────────────────────

export async function listLessons({ lesson_type, severity, subject_type, subject_id } = {}) {
  const params = new URLSearchParams();
  if (lesson_type) params.set("lesson_type", lesson_type);
  if (severity) params.set("severity", severity);
  if (subject_type) params.set("subject_type", subject_type);
  if (subject_id) params.set("subject_id", subject_id);
  const qs = params.toString();
  const response = await apiFetch(`/api/lessons${qs ? `?${qs}` : ""}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not list lessons.");
  return payload;
}

export async function getLesson(id) {
  const response = await apiFetch(`/api/lessons/${id}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not fetch lesson.");
  return payload;
}

export async function createLesson(data) {
  const response = await apiFetch("/api/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not create lesson.");
  return payload;
}

export async function updateLesson(id, data) {
  const response = await apiFetch(`/api/lessons/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not update lesson.");
  return payload;
}

export async function addLessonReferences(lessonId, references) {
  const response = await apiFetch(`/api/lessons/${lessonId}/references`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ references }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not add references.");
  return payload;
}

export async function removeLessonReference(lessonId, refId) {
  const response = await apiFetch(`/api/lessons/${lessonId}/references/${refId}`, {
    method: "DELETE",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not remove reference.");
  return payload;
}

// ── Assistant ───────────────────────────────────────────────────────

export async function askAssistant(question, threadId) {
  const response = await apiFetch("/api/assistant/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, thread_id: threadId || undefined }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Assistant request failed.");
  return payload;
}

export async function clearAssistantThread(threadId) {
  const response = await apiFetch(`/api/assistant/threads/${threadId}`, {
    method: "DELETE",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not clear thread.");
  return payload;
}
