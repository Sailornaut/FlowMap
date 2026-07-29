// @ts-check
/**
 * Shared analysis data loader.
 *
 * Single source of truth for loading an analysis run with all related data
 * (manifests, stage results, candidates, observations, vacancies).
 *
 * Used by both the analysis-detail API route and the report/PDF route
 * to prevent column-name drift between the two.
 */

import { getSupabaseAdmin } from "./supabase-admin.js";

// ── Shared select definitions ──────────────────────────────────────
// These must match the current Supabase schema exactly.
// If a migration adds or renames a column, update here once.

/** Columns selected from analysis_manifests (migration 0003). */
export const MANIFEST_SELECT =
  "id, version, depth, overall_confidence, runner_version, total_cost_usd, stages_planned, stages_completed, data_sources_used, created_at";

/** Columns selected from source_observations + data_sources join (migration 0002 + 0004). */
export const OBSERVATION_SELECT =
  "id, source_url_or_id, retrieved_at, raw_value, normalized_value, unit, confidence, subject_type, data_sources(name, kind, reliability_tier)";

/** Columns selected from business_candidates with nested scores (migration 0002). */
export const CANDIDATE_SELECT =
  "id, rank, verdict, tenant_categories(slug, name, sector), opportunity_scores(overall, confidence, completeness, positive_factors, negative_factors, disqualifiers, score_components(component_key, normalized, weight, explanation))";

// ── Error classes ──────────────────────────────────────────────────

/**
 * Thrown when a Supabase query fails (network error, bad column, etc.).
 * Callers should log and return 500.
 */
export class AnalysisLoadError extends Error {
  /**
   * @param {string} message
   * @param {string} analysisId
   * @param {object} [supabaseError]
   */
  constructor(message, analysisId, supabaseError) {
    super(message);
    this.name = "AnalysisLoadError";
    this.analysisId = analysisId;
    this.supabaseError = supabaseError || null;
  }
}

// ── Main loader ────────────────────────────────────────────────────

/**
 * Load a full analysis with all joined data needed for display or PDF rendering.
 *
 * @param {string} analysisId — UUID of the analysis_runs row
 * @returns {Promise<{
 *   analysis: object,
 *   stageOutputs: Record<string, object>,
 *   candidates: Array,
 *   vacancies: Array,
 *   observations: Array,
 * } | null>}
 *   Returns `null` when the query succeeds but no matching analysis exists.
 *   Throws `AnalysisLoadError` on query failures.
 */
export async function loadAnalysisById(analysisId) {
  const supabase = getSupabaseAdmin();

  // 1. Load analysis_run with property + stage_results
  const { data: analysis, error: runError } = await supabase
    .from("analysis_runs")
    .select("*, properties(*), analysis_stage_results(*)")
    .eq("id", analysisId)
    .maybeSingle();

  if (runError) {
    throw new AnalysisLoadError(
      `Failed to load analysis run: ${runError.message}`,
      analysisId,
      runError,
    );
  }

  if (!analysis) return null;

  // 2. Load manifests (separate query — matches analysis-detail route pattern)
  const { data: manifests, error: manifestError } = await supabase
    .from("analysis_manifests")
    .select(MANIFEST_SELECT)
    .eq("analysis_run_id", analysis.id)
    .order("version", { ascending: false });

  if (manifestError) {
    throw new AnalysisLoadError(
      `Failed to load manifests: ${manifestError.message}`,
      analysisId,
      manifestError,
    );
  }

  analysis.analysis_manifests = manifests || [];

  // 3. Load source observations with data_sources join
  const { data: observations, error: obsError } = await supabase
    .from("source_observations")
    .select(OBSERVATION_SELECT)
    .eq("analysis_run_id", analysis.id)
    .order("retrieved_at", { ascending: false });

  if (obsError) {
    throw new AnalysisLoadError(
      `Failed to load observations: ${obsError.message}`,
      analysisId,
      obsError,
    );
  }

  // 4. Load business candidates with scores
  const { data: candidates, error: candError } = await supabase
    .from("business_candidates")
    .select(CANDIDATE_SELECT)
    .eq("analysis_run_id", analysis.id)
    .order("rank", { ascending: true });

  if (candError) {
    throw new AnalysisLoadError(
      `Failed to load candidates: ${candError.message}`,
      analysisId,
      candError,
    );
  }

  // Flatten opportunity_scores from Supabase array to single object
  const flatCandidates = (candidates || []).map((c) => ({
    ...c,
    opportunity_scores: Array.isArray(c.opportunity_scores)
      ? c.opportunity_scores[0]
      : c.opportunity_scores,
  }));

  // 5. Load vacancies for the property
  const { data: vacancies, error: vacError } = await supabase
    .from("vacancies")
    .select("*")
    .eq("property_id", analysis.property_id)
    .order("unit_label", { ascending: true });

  if (vacError) {
    throw new AnalysisLoadError(
      `Failed to load vacancies: ${vacError.message}`,
      analysisId,
      vacError,
    );
  }

  // 6. Build stage outputs map (used by report narratives and scoring)
  const stageOutputs = {};
  for (const sr of analysis.analysis_stage_results || []) {
    if (sr.status === "ok" && sr.outputs) {
      stageOutputs[sr.stage_name] = sr.outputs;
    }
  }

  return {
    analysis,
    stageOutputs,
    candidates: flatCandidates,
    vacancies: vacancies || [],
    observations: observations || [],
  };
}
