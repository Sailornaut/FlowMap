import { describe, expect, it } from "vitest";
import { computeOverallConfidence, computeInputsHash, filterStagesByDepth } from "../pipeline/runner.js";

/**
 * Confidence aggregation tests.
 *
 * Aggregation rule (documented in runner.js):
 *   1. Stages are split into "data quality" (property-validation) and "analytical"
 *      (geo-enrichment, trade-area, demographics, demand-generators).
 *   2. Overall confidence = worst confidence across completed analytical stages.
 *   3. Data quality stages are reported separately and do NOT cap overall confidence.
 *   4. If no analytical stages completed, fall back to data quality confidence.
 *   5. If nothing completed, return "insufficient" for both.
 *
 * This prevents property-validation (which checks initial field completeness)
 * from permanently capping the analysis when geo-enrichment later fills in
 * the missing data.
 */

/** Helper to build a mock stage record. */
function rec(stageName, status, confidence) {
  return {
    stageName,
    stageVersion: "1.0.0",
    status,
    outputs: {},
    observations: [],
    confidence,
    completeness: status === "ok" ? 1 : 0,
    cost: 0,
    durationMs: 100,
    error: status === "failed" ? "test error" : null,
    inputsHash: "abc123",
  };
}

describe("computeOverallConfidence", () => {
  it("returns insufficient when no stages completed", () => {
    const result = computeOverallConfidence([]);
    expect(result).toEqual({ overall: "insufficient", dataQuality: "insufficient" });
  });

  it("returns insufficient when all stages failed", () => {
    const result = computeOverallConfidence([
      rec("property-validation", "failed", "insufficient"),
      rec("geo-enrichment", "failed", "insufficient"),
    ]);
    expect(result).toEqual({ overall: "insufficient", dataQuality: "insufficient" });
  });

  it("returns high when all analytical stages are high", () => {
    const result = computeOverallConfidence([
      rec("property-validation", "ok", "preliminary"),
      rec("geo-enrichment", "ok", "high"),
      rec("trade-area", "ok", "high"),
      rec("demographics", "ok", "high"),
      rec("demand-generators", "ok", "high"),
    ]);
    expect(result.overall).toBe("high");
    // Data quality is separate — validation's preliminary does NOT drag down overall
    expect(result.dataQuality).toBe("preliminary");
  });

  it("overall is capped by the weakest analytical stage", () => {
    const result = computeOverallConfidence([
      rec("property-validation", "ok", "high"),
      rec("geo-enrichment", "ok", "high"),
      rec("trade-area", "ok", "moderate"),
      rec("demographics", "ok", "high"),
      rec("demand-generators", "ok", "preliminary"),
    ]);
    expect(result.overall).toBe("preliminary");
  });

  it("property-validation (data quality) does not cap overall", () => {
    // This is the KEY test: validation says "preliminary" but all analytical
    // stages are "high" — overall should still be "high".
    const result = computeOverallConfidence([
      rec("property-validation", "ok", "preliminary"),
      rec("geo-enrichment", "ok", "high"),
      rec("demographics", "ok", "high"),
    ]);
    expect(result.overall).toBe("high");
    expect(result.dataQuality).toBe("preliminary");
  });

  it("falls back to data quality when no analytical stages completed", () => {
    const result = computeOverallConfidence([
      rec("property-validation", "ok", "moderate"),
      rec("geo-enrichment", "failed", "insufficient"),
      rec("demographics", "failed", "insufficient"),
    ]);
    expect(result.overall).toBe("moderate");
    expect(result.dataQuality).toBe("moderate");
  });

  it("skipped stages are ignored (only ok stages count)", () => {
    const result = computeOverallConfidence([
      rec("property-validation", "ok", "high"),
      rec("geo-enrichment", "ok", "high"),
      rec("trade-area", "skipped", "moderate"),
      rec("demographics", "ok", "high"),
      rec("demand-generators", "skipped", "insufficient"),
    ]);
    // Skipped stages not counted — only geo-enrichment + demographics (both high)
    expect(result.overall).toBe("high");
  });

  it("handles single analytical stage", () => {
    const result = computeOverallConfidence([
      rec("demographics", "ok", "moderate"),
    ]);
    expect(result.overall).toBe("moderate");
    expect(result.dataQuality).toBe("insufficient");
  });

  it("handles single data-quality stage", () => {
    const result = computeOverallConfidence([
      rec("property-validation", "ok", "high"),
    ]);
    // No analytical stages → fall back to data quality
    expect(result.overall).toBe("high");
    expect(result.dataQuality).toBe("high");
  });

  it("handles mixed failed and ok stages", () => {
    const result = computeOverallConfidence([
      rec("property-validation", "ok", "high"),
      rec("geo-enrichment", "ok", "high"),
      rec("trade-area", "failed", "insufficient"),
      rec("demographics", "ok", "moderate"),
      rec("demand-generators", "failed", "insufficient"),
    ]);
    // Only ok analytical: geo-enrichment(high) + demographics(moderate)
    expect(result.overall).toBe("moderate");
    expect(result.dataQuality).toBe("high");
  });
});

describe("computeInputsHash", () => {
  it("produces a 16-char hex string", () => {
    const hash = computeInputsHash("test-stage", { foo: 1 });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for same inputs", () => {
    const a = computeInputsHash("stage", { a: 1, b: 2 });
    const b = computeInputsHash("stage", { a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("differs for different stage names", () => {
    const a = computeInputsHash("stage-a", { x: 1 });
    const b = computeInputsHash("stage-b", { x: 1 });
    expect(a).not.toBe(b);
  });
});

describe("filterStagesByDepth", () => {
  const stages = [
    { name: "a", version: "1", run: async () => ({}) },
    { name: "b", version: "1", depths: ["standard", "full"], run: async () => ({}) },
    { name: "c", version: "1", depths: ["full"], run: async () => ({}) },
  ];

  it("includes all stages for full depth", () => {
    expect(filterStagesByDepth(stages, "full").map((s) => s.name)).toEqual(["a", "b", "c"]);
  });

  it("excludes full-only stages for standard depth", () => {
    expect(filterStagesByDepth(stages, "standard").map((s) => s.name)).toEqual(["a", "b"]);
  });

  it("includes stages with no depths restriction", () => {
    expect(filterStagesByDepth(stages, "teaser").map((s) => s.name)).toEqual(["a"]);
  });
});
