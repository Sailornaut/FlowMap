import { describe, expect, it } from "vitest";
import {
  MANIFEST_SELECT,
  OBSERVATION_SELECT,
  CANDIDATE_SELECT,
  AnalysisLoadError,
} from "../load-analysis.js";

// ── Schema validation tests ────────────────────────────────────────
// These ensure the shared SELECT constants only reference columns that
// actually exist in the Supabase schema (per migrations 0002–0005).

describe("MANIFEST_SELECT", () => {
  // Valid columns from migration 0003 (analysis_manifests):
  // id, analysis_run_id, version, methodology_version_id, depth,
  // requested_by, stages_planned, stages_completed, data_sources_used,
  // runner_version, total_cost_usd, overall_confidence, created_by, created_at
  const VALID_MANIFEST_COLUMNS = new Set([
    "id", "analysis_run_id", "version", "methodology_version_id", "depth",
    "requested_by", "stages_planned", "stages_completed", "data_sources_used",
    "runner_version", "total_cost_usd", "overall_confidence", "created_by",
    "created_at",
  ]);

  it("contains only valid manifest column names", () => {
    const columns = MANIFEST_SELECT.split(",").map((c) => c.trim());
    for (const col of columns) {
      expect(VALID_MANIFEST_COLUMNS.has(col), `"${col}" is not a valid analysis_manifests column`).toBe(true);
    }
  });

  it("does not reference obsolete stage_count column", () => {
    expect(MANIFEST_SELECT).not.toContain("stage_count");
  });

  it("does not reference obsolete inputs_hash column", () => {
    expect(MANIFEST_SELECT).not.toContain("inputs_hash");
  });

  it("does not reference obsolete data_quality_confidence column", () => {
    expect(MANIFEST_SELECT).not.toContain("data_quality_confidence");
  });
});

describe("OBSERVATION_SELECT", () => {
  it("references data_sources.kind, not source_type", () => {
    expect(OBSERVATION_SELECT).toContain("data_sources(name, kind, reliability_tier)");
    expect(OBSERVATION_SELECT).not.toContain("source_type");
  });
});

describe("CANDIDATE_SELECT", () => {
  it("includes positive_factors, negative_factors, disqualifiers", () => {
    expect(CANDIDATE_SELECT).toContain("positive_factors");
    expect(CANDIDATE_SELECT).toContain("negative_factors");
    expect(CANDIDATE_SELECT).toContain("disqualifiers");
  });

  it("includes score_components with required fields", () => {
    expect(CANDIDATE_SELECT).toContain("score_components(component_key, normalized, weight, explanation)");
  });
});

describe("AnalysisLoadError", () => {
  it("captures analysis ID and supabase error", () => {
    const supaErr = { message: "column not found", code: "42703" };
    const err = new AnalysisLoadError("load failed", "abc-123", supaErr);

    expect(err.name).toBe("AnalysisLoadError");
    expect(err.message).toBe("load failed");
    expect(err.analysisId).toBe("abc-123");
    expect(err.supabaseError).toEqual(supaErr);
    expect(err instanceof Error).toBe(true);
  });

  it("defaults supabaseError to null", () => {
    const err = new AnalysisLoadError("load failed", "abc-123");
    expect(err.supabaseError).toBeNull();
  });
});
