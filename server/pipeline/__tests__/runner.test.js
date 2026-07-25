// @ts-check
import { describe, expect, it } from "vitest";
import {
  RUNNER_VERSION,
  computeInputsHash,
  filterStagesByDepth,
  computeOverallConfidence,
  runPipeline,
} from "../runner.js";

describe("runner module basics", () => {
  it("declares a version", () => {
    expect(RUNNER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("computeInputsHash", () => {
  it("returns a hex string", () => {
    const hash = computeInputsHash("test", { a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is deterministic", () => {
    const h1 = computeInputsHash("test", { a: 1, b: 2 });
    const h2 = computeInputsHash("test", { a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it("differs for different stage names", () => {
    const h1 = computeInputsHash("stage-a", { x: 1 });
    const h2 = computeInputsHash("stage-b", { x: 1 });
    expect(h1).not.toBe(h2);
  });
});

describe("filterStagesByDepth", () => {
  const stages = [
    { name: "always", version: "1.0.0", run: async () => ({}) },
    { name: "standard-up", version: "1.0.0", depths: ["standard", "full"], run: async () => ({}) },
    { name: "full-only", version: "1.0.0", depths: ["full"], run: async () => ({}) },
  ];

  it("includes all stages with no depths filter for full", () => {
    const result = filterStagesByDepth(stages, "full");
    expect(result).toHaveLength(3);
  });

  it("excludes full-only stages in teaser depth", () => {
    const result = filterStagesByDepth(stages, "teaser");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("always");
  });

  it("includes standard-up stages in standard depth", () => {
    const result = filterStagesByDepth(stages, "standard");
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toContain("standard-up");
    expect(result.map((s) => s.name)).not.toContain("full-only");
  });
});

describe("computeOverallConfidence", () => {
  it("returns insufficient when no stages completed", () => {
    expect(computeOverallConfidence([])).toEqual({ overall: "insufficient", dataQuality: "insufficient" });
    expect(
      computeOverallConfidence([{ status: "failed", confidence: "high" }])
    ).toEqual({ overall: "insufficient", dataQuality: "insufficient" });
  });

  it("returns the worst confidence across completed stages", () => {
    const records = [
      { status: "ok", confidence: "high" },
      { status: "ok", confidence: "moderate" },
      { status: "ok", confidence: "high" },
    ];
    expect(computeOverallConfidence(records).overall).toBe("moderate");
  });

  it("ignores failed stages in confidence calculation", () => {
    const records = [
      { status: "ok", confidence: "high" },
      { status: "failed", confidence: "insufficient" },
    ];
    expect(computeOverallConfidence(records).overall).toBe("high");
  });
});

describe("runPipeline", () => {
  const successStage = {
    name: "success",
    version: "1.0.0",
    async run() {
      return {
        outputs: { result: "ok" },
        observations: [{ source: "test" }],
        confidence: "high",
        completeness: 1,
        cost: 0.01,
      };
    },
  };

  const failStage = {
    name: "fail",
    version: "1.0.0",
    async run() {
      throw new Error("Stage blew up");
    },
  };

  const downstreamStage = {
    name: "downstream",
    version: "1.0.0",
    async run(ctx) {
      return {
        outputs: {
          received_prior: ctx.stageOutputs["success"]?.result || "none",
        },
        observations: [],
        confidence: "moderate",
        completeness: 1,
        cost: 0,
      };
    },
  };

  const baseContext = {
    property: { name: "Test" },
    tenants: [],
    vacancies: [],
    analysisRun: { id: "run-1" },
    stageOutputs: {},
  };

  it("returns complete when all stages succeed", async () => {
    const result = await runPipeline([successStage], baseContext);
    expect(result.status).toBe("complete");
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].status).toBe("ok");
    expect(result.totalCost).toBe(0.01);
  });

  it("returns partial when some stages fail", async () => {
    const result = await runPipeline([successStage, failStage], baseContext);
    expect(result.status).toBe("partial");
    expect(result.stages[0].status).toBe("ok");
    expect(result.stages[1].status).toBe("failed");
    expect(result.stages[1].error).toContain("Stage blew up");
  });

  it("returns failed when all stages fail", async () => {
    const result = await runPipeline([failStage], baseContext);
    expect(result.status).toBe("failed");
  });

  it("isolates failures — subsequent stages still run", async () => {
    const result = await runPipeline(
      [failStage, successStage],
      baseContext
    );
    expect(result.status).toBe("partial");
    expect(result.stages[1].status).toBe("ok");
  });

  it("passes accumulated outputs to downstream stages", async () => {
    const result = await runPipeline(
      [successStage, downstreamStage],
      baseContext
    );
    expect(result.stages[1].outputs.received_prior).toBe("ok");
  });

  it("records duration for each stage", async () => {
    const result = await runPipeline([successStage], baseContext);
    expect(result.stages[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("computes overall confidence", async () => {
    const result = await runPipeline([successStage], baseContext);
    expect(result.overallConfidence).toBe("high");
  });

  it("calls onStageComplete callback", async () => {
    const records = [];
    await runPipeline([successStage, failStage], baseContext, {
      onStageComplete: async (record) => {
        records.push(record.stageName);
      },
    });
    expect(records).toEqual(["success", "fail"]);
  });

  it("respects depth filtering", async () => {
    const fullOnly = {
      ...successStage,
      name: "full-only",
      depths: ["full"],
    };
    const result = await runPipeline([successStage, fullOnly], baseContext, {
      depth: "teaser",
    });
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].stageName).toBe("success");
  });
});
