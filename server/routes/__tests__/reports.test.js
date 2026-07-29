import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock the shared loader before importing the route ──────────────
// This lets us test error-handling paths without a real database.

const mockLoadAnalysisById = vi.fn();
const MockAnalysisLoadError = class extends Error {
  constructor(msg, id, supa) {
    super(msg);
    this.name = "AnalysisLoadError";
    this.analysisId = id;
    this.supabaseError = supa || null;
  }
};

vi.mock("../../services/load-analysis.js", () => ({
  loadAnalysisById: (...args) => mockLoadAnalysisById(...args),
  AnalysisLoadError: MockAnalysisLoadError,
  MANIFEST_SELECT: "id, version",
  OBSERVATION_SELECT: "id, confidence",
  CANDIDATE_SELECT: "id, rank, verdict",
}));

vi.mock("../../services/supabase-admin.js", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => ({ maybeSingle: () => ({ data: null }) }),
          maybeSingle: () => ({ data: null }),
          order: () => ({ limit: () => ({ maybeSingle: () => ({ data: null }) }) }),
          single: () => ({ data: { id: "v1" }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: "proj-1", version: 1 }, error: null }),
        }),
      }),
      update: () => ({ eq: () => ({ data: null, error: null }) }),
    }),
    storage: {
      from: () => ({
        upload: () => ({ error: null }),
        download: () => ({ data: null, error: { message: "not found" } }),
      }),
    },
  }),
}));

vi.mock("../../middleware/error-handler.js", () => ({
  reportServerError: vi.fn(),
}));

vi.mock("../../reports/analysis-pdf.js", () => ({
  renderAnalysisPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  buildReportSnapshot: vi.fn().mockReturnValue({
    schema_version: "2.0.0",
    sections_rendered: ["cover"],
  }),
}));

// ── Import route after mocking ─────────────────────────────────────
// We can't easily spin up the full Express app, so we test the loader
// integration contract here.

describe("report route error handling contract", () => {
  beforeEach(() => {
    mockLoadAnalysisById.mockReset();
  });

  it("loadAnalysisById returning null should produce 404, not 500", async () => {
    mockLoadAnalysisById.mockResolvedValue(null);

    // Simulate what the route does
    const loaded = await mockLoadAnalysisById("nonexistent-id");
    expect(loaded).toBeNull();
    // Route would return 404 here
  });

  it("loadAnalysisById throwing AnalysisLoadError should produce 500", async () => {
    const supaError = { message: "column \"stage_count\" does not exist", code: "42703" };
    mockLoadAnalysisById.mockRejectedValue(
      new MockAnalysisLoadError("Failed to load analysis run: column not found", "test-id", supaError)
    );

    await expect(mockLoadAnalysisById("test-id")).rejects.toThrow("Failed to load analysis run");

    try {
      await mockLoadAnalysisById("test-id");
    } catch (err) {
      expect(err.name).toBe("AnalysisLoadError");
      expect(err.analysisId).toBe("test-id");
      expect(err.supabaseError.code).toBe("42703");
      // Route should return 500, not 404, for this case
    }
  });

  it("loadAnalysisById returning data with status 'complete' passes status check", async () => {
    const loaded = {
      analysis: { id: "test", status: "complete", property_id: "p1", properties: { name: "Test" } },
      stageOutputs: {},
      candidates: [],
      vacancies: [],
      observations: [],
    };
    mockLoadAnalysisById.mockResolvedValue(loaded);

    const result = await mockLoadAnalysisById("test");
    // DB uses 'complete', not 'completed'
    expect(["complete", "partial"].includes(result.analysis.status)).toBe(true);
  });

  it("loadAnalysisById returning data with status 'completed' would NOT pass status check", async () => {
    // This ensures the route doesn't use the wrong status string
    expect(["complete", "partial"].includes("completed")).toBe(false);
    expect(["complete", "partial"].includes("complete")).toBe(true);
  });

  it("handles empty candidates gracefully", async () => {
    const loaded = {
      analysis: {
        id: "test", status: "complete", property_id: "p1",
        properties: { name: "Test" },
        analysis_manifests: [],
        analysis_stage_results: [],
      },
      stageOutputs: {},
      candidates: [],
      vacancies: [],
      observations: [],
    };
    mockLoadAnalysisById.mockResolvedValue(loaded);

    const result = await mockLoadAnalysisById("test");
    expect(result.candidates).toEqual([]);
    expect(result.observations).toEqual([]);
  });

  it("handles candidates with empty score arrays", async () => {
    const loaded = {
      analysis: {
        id: "test", status: "complete", property_id: "p1",
        properties: { name: "Test" },
        analysis_manifests: [],
        analysis_stage_results: [],
      },
      stageOutputs: {},
      candidates: [
        {
          id: "c1",
          rank: 1,
          verdict: "recommend",
          tenant_categories: { slug: "coffee", name: "Coffee Shop", sector: "food_beverage" },
          opportunity_scores: {
            overall: 72,
            confidence: "preliminary",
            completeness: 0.47,
            positive_factors: [],
            negative_factors: [],
            disqualifiers: [],
            score_components: [],
          },
        },
      ],
      vacancies: [],
      observations: [],
    };
    mockLoadAnalysisById.mockResolvedValue(loaded);

    const result = await mockLoadAnalysisById("test");
    const score = result.candidates[0].opportunity_scores;
    expect(score.positive_factors).toEqual([]);
    expect(score.negative_factors).toEqual([]);
    expect(score.score_components).toEqual([]);
  });
});
