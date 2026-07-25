// @ts-check
/**
 * Pipeline runner — executes an ordered sequence of stages for an analysis run.
 *
 * Each stage conforms to the contract:
 *   { name, version, run(ctx) -> { outputs, observations[], confidence, completeness, cost } }
 *
 * The runner:
 * - Executes stages in order, passing accumulated context
 * - Isolates failures (a stage failure does not abort the run)
 * - Records per-stage results (duration, cost, status, confidence)
 * - Propagates confidence degradation
 * - Supports configurable depth (teaser/standard/full) for stage subsetting
 * - Computes an inputs hash for cache/idempotency (future)
 */

import { createHash } from "crypto";

export const RUNNER_VERSION = "1.0.0";

/**
 * @typedef {Object} StageDefinition
 * @property {string} name              Unique stage identifier (e.g., "property-validation")
 * @property {string} version           Semver version of the stage logic
 * @property {string[]} [depths]        Which analysis depths include this stage (default: all)
 * @property {(ctx: StageContext) => Promise<StageResult>} run
 */

/**
 * @typedef {Object} StageContext
 * @property {object} property          The property being analyzed
 * @property {object[]} tenants         Existing tenants
 * @property {object[]} vacancies       Vacancies to analyze
 * @property {object} analysisRun       The analysis_runs row
 * @property {Record<string, object>} stageOutputs  Accumulated outputs from prior stages, keyed by stage name
 * @property {object} [services]        Service clients (supabase, mapbox, census, etc.)
 * @property {object} [config]          Per-run configuration
 */

/**
 * @typedef {Object} StageResult
 * @property {object} outputs           Stage-specific output data
 * @property {object[]} observations    Source observations to persist (provenance)
 * @property {string} confidence        "high" | "moderate" | "preliminary" | "insufficient"
 * @property {number} completeness      0–1 share of inputs available
 * @property {number} cost              USD cost of this stage execution
 */

/**
 * @typedef {Object} StageRecord
 * @property {string} stageName
 * @property {string} stageVersion
 * @property {"ok"|"skipped"|"failed"} status
 * @property {object} outputs
 * @property {object[]} observations
 * @property {string} confidence
 * @property {number} completeness
 * @property {number} cost
 * @property {number} durationMs
 * @property {string|null} error
 * @property {string} inputsHash
 */

/**
 * @typedef {Object} PipelineResult
 * @property {"complete"|"partial"|"failed"} status
 * @property {StageRecord[]} stages
 * @property {number} totalCost
 * @property {number} totalDurationMs
 * @property {string} overallConfidence
 */

/**
 * Compute a deterministic hash of the inputs to a stage for cache keying.
 * @param {string} stageName
 * @param {object} inputs
 * @returns {string}
 */
export function computeInputsHash(stageName, inputs) {
  const hash = createHash("sha256");
  hash.update(stageName);
  hash.update(JSON.stringify(inputs, Object.keys(inputs).sort()));
  return hash.digest("hex").slice(0, 16);
}

/**
 * Filter stages based on analysis depth.
 * @param {StageDefinition[]} stages
 * @param {string} depth   "teaser" | "standard" | "full"
 * @returns {StageDefinition[]}
 */
export function filterStagesByDepth(stages, depth) {
  return stages.filter((stage) => {
    if (!stage.depths) return true; // included in all depths
    return stage.depths.includes(depth);
  });
}

/**
 * Stages classified as "data quality gates" rather than analytical stages.
 * These stages assess input completeness and are reported separately.
 * They do NOT cap the overall analytical confidence.
 *
 * Rationale: property-validation checks whether the property record is
 * complete. A property missing lat/lng at creation gets "preliminary"
 * from validation, but geo-enrichment then geocodes it successfully.
 * Letting validation permanently cap the analysis would penalize the
 * normal workflow where enrichment stages fill in missing data.
 */
const DATA_QUALITY_STAGES = new Set(["property-validation"]);

/**
 * Determine overall confidence from individual stage confidences.
 *
 * Aggregation rule:
 *   1. Separate stages into "analytical" and "data quality" categories.
 *   2. Overall confidence = minimum across completed analytical stages.
 *   3. Data quality stages (e.g. property-validation) are excluded from
 *      the overall calculation but reported in `dataQualityConfidence`.
 *   4. If no analytical stages completed, fall back to data quality.
 *   5. If nothing completed, return "insufficient".
 *
 * @param {StageRecord[]} stageRecords
 * @returns {{ overall: string, dataQuality: string }}
 */
export function computeOverallConfidence(stageRecords) {
  const levels = ["insufficient", "preliminary", "moderate", "high"];
  const completed = stageRecords.filter((s) => s.status === "ok");

  if (completed.length === 0) return { overall: "insufficient", dataQuality: "insufficient" };

  const analytical = completed.filter((s) => !DATA_QUALITY_STAGES.has(s.stageName));
  const dataQuality = completed.filter((s) => DATA_QUALITY_STAGES.has(s.stageName));

  function worstConfidence(stages) {
    if (stages.length === 0) return "insufficient";
    let worst = levels.length - 1;
    for (const stage of stages) {
      const idx = levels.indexOf(stage.confidence);
      if (idx >= 0 && idx < worst) worst = idx;
    }
    return levels[worst];
  }

  const analyticalConfidence = worstConfidence(analytical);
  const dqConfidence = worstConfidence(dataQuality);

  // If no analytical stages completed, fall back to data quality
  const overall = analytical.length > 0 ? analyticalConfidence : dqConfidence;

  return { overall, dataQuality: dqConfidence };
}

/**
 * Execute a pipeline: run stages in order, isolate failures, accumulate results.
 *
 * @param {StageDefinition[]} stages        Ordered stage definitions
 * @param {StageContext} initialContext      Starting context (property, tenants, vacancies, etc.)
 * @param {object} [options]
 * @param {string} [options.depth]          Analysis depth ("teaser"|"standard"|"full"), default "full"
 * @param {number} [options.stageTimeoutMs]  Per-stage timeout in ms (default: 60_000)
 * @param {(record: StageRecord) => Promise<void>} [options.onStageComplete]  Callback after each stage
 * @returns {Promise<PipelineResult>}
 */
export async function runPipeline(stages, initialContext, options = {}) {
  const depth = options.depth || "full";
  const stageTimeoutMs = options.stageTimeoutMs || 60_000;
  const onStageComplete = options.onStageComplete || null;

  const activeStages = filterStagesByDepth(stages, depth);
  const stageOutputs = { ...initialContext.stageOutputs };
  const records = [];
  let totalCost = 0;
  const pipelineStart = Date.now();

  for (const stage of activeStages) {
    const ctx = { ...initialContext, stageOutputs: { ...stageOutputs } };
    const stageStart = Date.now();

    // Compute inputs hash for this stage
    const hashInputs = {
      property: ctx.property,
      tenants: ctx.tenants,
      vacancies: ctx.vacancies,
      priorOutputs: Object.keys(stageOutputs),
    };
    const inputsHash = computeInputsHash(stage.name, hashInputs);

    /** @type {StageRecord} */
    let record;

    try {
      // Run with a timeout to prevent a single slow external API from
      // blocking the entire pipeline indefinitely.
      const result = await Promise.race([
        stage.run(ctx),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Stage "${stage.name}" timed out after ${stageTimeoutMs}ms`)), stageTimeoutMs)
        ),
      ]);
      const durationMs = Date.now() - stageStart;

      record = {
        stageName: stage.name,
        stageVersion: stage.version,
        status: "ok",
        outputs: result.outputs,
        observations: result.observations || [],
        confidence: result.confidence || "moderate",
        completeness: result.completeness ?? 1,
        cost: result.cost || 0,
        durationMs,
        error: null,
        inputsHash,
      };

      // Accumulate outputs for downstream stages
      stageOutputs[stage.name] = result.outputs;
    } catch (err) {
      const durationMs = Date.now() - stageStart;

      record = {
        stageName: stage.name,
        stageVersion: stage.version,
        status: "failed",
        outputs: {},
        observations: [],
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        inputsHash,
      };
      // Stage failure is isolated — continue to next stage
    }

    records.push(record);
    totalCost += record.cost;

    if (onStageComplete) {
      await onStageComplete(record);
    }
  }

  const totalDurationMs = Date.now() - pipelineStart;
  const okCount = records.filter((r) => r.status === "ok").length;
  const failCount = records.filter((r) => r.status === "failed").length;

  let status;
  if (failCount === 0 && okCount > 0) {
    status = "complete";
  } else if (okCount > 0) {
    status = "partial";
  } else {
    status = "failed";
  }

  const confidenceResult = computeOverallConfidence(records);

  return {
    status,
    stages: records,
    totalCost,
    totalDurationMs,
    overallConfidence: confidenceResult.overall,
    dataQualityConfidence: confidenceResult.dataQuality,
  };
}
