// @ts-check
/**
 * Analysis run routes.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { createGeocodingService, createIsochroneService } from "../services/mapbox.js";
import { createCensusService } from "../services/census.js";
import { createOverpassService } from "../services/overpass.js";
import { reportServerError } from "../middleware/error-handler.js";
import { runPipeline, RUNNER_VERSION } from "../pipeline/runner.js";
import { ALL_STAGES } from "../pipeline/stages/index.js";

const router = Router();

/**
 * GET /api/analyses — list analysis runs (optionally filtered by property).
 */
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("analysis_runs")
      .select("*, properties(name, address)")
      .order("created_at", { ascending: false });

    if (req.query.property_id) {
      query = query.eq("property_id", req.query.property_id);
    }
    if (req.query.status) {
      query = query.eq("status", req.query.status);
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ analyses: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/analyses", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not list analyses." });
  }
});

/**
 * GET /api/analyses/:id — get a single analysis run with stage results.
 */
router.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("analysis_runs")
      .select("*, properties(name, address, city, state, postal_code), analysis_stage_results(*)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Analysis run not found." });
    }

    // Fetch manifests (immutable provenance records)
    const { data: manifests } = await supabase
      .from("analysis_manifests")
      .select("id, version, depth, overall_confidence, runner_version, total_cost_usd, stages_planned, stages_completed, data_sources_used, created_at")
      .eq("analysis_run_id", data.id)
      .order("version", { ascending: false });

    // Fetch source observations for this run
    const { data: observations } = await supabase
      .from("source_observations")
      .select("id, source_url_or_id, retrieved_at, raw_value, normalized_value, unit, confidence, subject_type, data_sources(name, kind, reliability_tier)")
      .eq("analysis_run_id", data.id)
      .order("retrieved_at");

    // Fetch business candidates with scores
    const { data: candidates } = await supabase
      .from("business_candidates")
      .select("id, rank, verdict, tenant_categories(slug, name, sector), opportunity_scores(overall, confidence, completeness, positive_factors, negative_factors, disqualifiers, score_components(component_key, normalized, weight, explanation))")
      .eq("analysis_run_id", data.id)
      .order("rank", { ascending: true });

    data.analysis_manifests = manifests || [];
    data.source_observations = observations || [];
    data.business_candidates = candidates || [];

    res.json(data);
  } catch (error) {
    reportServerError(error, { route: { path: `/api/analyses/${req.params.id}`, method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not load analysis." });
  }
});

/**
 * POST /api/analyses — create a new analysis run for a property.
 *
 * Uses the `create_analysis_run_with_manifest` RPC to atomically create both
 * the analysis_runs row and the initial analysis_manifests row (version 1).
 * If the RPC is missing (migration 0003 not applied), returns a 503 error —
 * run creation is NOT allowed without a manifest.
 *
 * `analysis_manifests` is the authoritative source.
 * `analysis_runs.manifest` (JSONB) is deprecated backward-compatible data only.
 */
router.post("/", async (req, res) => {
  try {
    const { property_id, depth, notes } = req.body ?? {};

    if (!property_id) {
      return res.status(400).json({ error: "property_id is required." });
    }

    const supabase = getSupabaseAdmin();

    // Verify property exists
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", property_id)
      .maybeSingle();

    if (propError) throw propError;
    if (!property) {
      return res.status(404).json({ error: "Property not found." });
    }

    // Get active methodology version (if one exists)
    const { data: methodology } = await supabase
      .from("methodology_versions")
      .select("id, version")
      .eq("active", true)
      .maybeSingle();

    const runDepth = depth || "standard";
    const requestedBy = req.authContext?.user?.id || null;

    // Atomic creation via RPC — both run and manifest (version 1) in one transaction.
    // If the RPC doesn't exist, migration 0003 hasn't been applied.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_analysis_run_with_manifest",
      {
        p_property_id: property_id,
        p_requested_by: requestedBy,
        p_depth: runDepth,
        p_methodology_version_id: methodology?.id || null,
        p_notes: notes || null,
      },
    );

    if (rpcError) {
      // Distinguish "function does not exist" (migration not applied) from other errors
      const msg = (rpcError.message || "").toLowerCase();
      if (msg.includes("could not find the function") || (msg.includes("function") && msg.includes("does not exist"))) {
        reportServerError(rpcError, { context: "create_analysis_run_with_manifest RPC missing" });
        return res.status(503).json({
          error: "Infrastructure error: the create_analysis_run_with_manifest function is not available. "
            + "This typically means migration 0003 (analysis_manifests) has not been applied. "
            + "Apply the migration and retry.",
        });
      }
      throw rpcError;
    }

    // Also write the deprecated JSONB manifest column for backward compatibility.
    // This is non-authoritative data. Failure here is logged but does not block.
    try {
      const manifestData = {
        created_at: new Date().toISOString(),
        methodology_version: methodology?.version || null,
        requested_by: requestedBy,
        depth: runDepth,
        stages_planned: [],
        stages_completed: [],
        data_sources_used: [],
      };
      await supabase
        .from("analysis_runs")
        .update({ manifest: manifestData })
        .eq("id", rpcResult.id);
    } catch (backcompatErr) {
      reportServerError(backcompatErr, { context: "backward-compat JSONB manifest update (non-fatal)" });
    }

    res.status(201).json(rpcResult);
  } catch (error) {
    reportServerError(error, { route: { path: "/api/analyses", method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not create analysis." });
  }
});

/**
 * PATCH /api/analyses/:id — update analysis run status/notes.
 */
router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["status", "notes", "error"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (req.body.status === "running" && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (["complete", "failed"].includes(req.body.status)) {
      updates.finished_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("analysis_runs")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Analysis run not found." });
    }

    res.json(data);
  } catch (error) {
    reportServerError(error, { route: { path: `/api/analyses/${req.params.id}`, method: "PATCH" } });
    res.status(500).json({ error: error?.message || "Could not update analysis." });
  }
});

/**
 * POST /api/analyses/:id/execute — execute the analysis pipeline for a run.
 *
 * Loads the property, tenants, and vacancies, then runs the pipeline stages
 * in order. Persists stage results and source observations to the database.
 * Updates the run status as it progresses.
 *
 * On completion, inserts a new immutable manifest version into
 * `analysis_manifests`. The version is monotonically increasing and cannot
 * overwrite previous versions. Failure to persist the manifest is fatal —
 * an execution without an authoritative provenance record is not valid.
 *
 * The JSONB `analysis_runs.manifest` column is updated as deprecated
 * backward-compatible data. It is not authoritative.
 */
router.post("/:id/execute", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    // Load the analysis run
    const { data: run, error: runError } = await supabase
      .from("analysis_runs")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (runError) throw runError;
    if (!run) {
      return res.status(404).json({ error: "Analysis run not found." });
    }

    // Pre-flight status checks
    if (run.status === "running") {
      return res.status(409).json({ error: "Analysis is already running." });
    }
    if (run.status === "complete") {
      return res.status(409).json({
        error: "Analysis already complete. Create a new run to re-analyze.",
        code: "already_complete",
      });
    }
    if (run.status === "partial") {
      return res.status(409).json({
        error: "Analysis partially complete. Create a new run to re-analyze.",
        code: "already_partial",
      });
    }

    // Atomic status transition: only claim the run if it is still queued/failed.
    // This prevents a race where two concurrent requests both pass the check above.
    const { data: claimed, error: claimError } = await supabase
      .from("analysis_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .in("status", ["queued", "failed"])
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) {
      // Another request claimed it between our SELECT and UPDATE
      return res.status(409).json({ error: "Analysis is already running or complete." });
    }

    // Load property with tenants and vacancies
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", run.property_id)
      .maybeSingle();

    if (propError) throw propError;
    if (!property) {
      return res.status(404).json({ error: "Property not found for this analysis run." });
    }

    const { data: tenants } = await supabase
      .from("tenants")
      .select("*, tenant_categories(slug, name, sector)")
      .eq("property_id", run.property_id);

    const { data: vacancies } = await supabase
      .from("vacancies")
      .select("*")
      .eq("property_id", run.property_id);

    // Build pipeline context with live service clients.
    // Each factory returns null if its required config is missing — the
    // corresponding stage degrades gracefully to insufficient confidence.
    const services = {};
    const geocoding = createGeocodingService();
    if (geocoding) services.geocoding = geocoding;
    const isochrone = createIsochroneService();
    if (isochrone) services.isochrone = isochrone;
    const census = createCensusService();
    if (census) services.census = census;
    const places = createOverpassService();
    if (places) services.places = places;
    services.supabase = supabase;

    const pipelineCtx = {
      property,
      tenants: tenants || [],
      vacancies: vacancies || [],
      analysisRun: run,
      stageOutputs: {},
      services,
      config: {},
    };

    // Pre-load data source IDs (name → uuid) so observations can be linked.
    // If the data_sources table is empty (migration 0004 not applied), observations
    // will be skipped with a log warning rather than failing the pipeline.
    /** @type {Record<string, string>} */
    const dataSourceIds = {};
    try {
      const { data: sources } = await supabase
        .from("data_sources")
        .select("id, name")
        .eq("enabled", true);
      for (const s of sources || []) {
        dataSourceIds[s.name] = s.id;
      }
    } catch (dsErr) {
      reportServerError(dsErr, { context: "data_sources lookup (non-fatal)" });
    }

    // Execute pipeline with stage-result persistence callback
    const pipelineResult = await runPipeline(ALL_STAGES, pipelineCtx, {
      depth: run.depth || "standard",
      onStageComplete: async (record) => {
        // Persist stage result
        try {
          await supabase.from("analysis_stage_results").insert({
            analysis_run_id: run.id,
            stage_name: record.stageName,
            stage_version: record.stageVersion,
            status: record.status,
            inputs_hash: record.inputsHash,
            outputs: record.outputs,
            confidence: record.confidence,
            completeness: record.completeness,
            error: record.error,
            duration_ms: record.durationMs,
            cost_usd: record.cost,
            cache_hit: false,
          });

          // Persist source observations
          for (const obs of record.observations) {
            const sourceId = dataSourceIds[obs.source_name];
            if (!sourceId) {
              // source_id is NOT NULL — skip this observation rather than crash.
              // This happens when migration 0004 hasn't been applied yet.
              reportServerError(
                new Error(`No data_source row for "${obs.source_name}" — skipping observation`),
                { context: "source observation persistence", stage: record.stageName },
              );
              continue;
            }

            const { error: obsErr } = await supabase.from("source_observations").insert({
              source_id: sourceId,
              source_url_or_id: obs.source_url_or_id,
              retrieved_at: obs.retrieved_at,
              raw_value: obs.raw_value,
              normalized_value: obs.normalized_value,
              unit: obs.unit,
              confidence: obs.confidence,
              subject_type: "property",
              subject_id: run.property_id,
              analysis_run_id: run.id,
            });

            if (obsErr) {
              reportServerError(obsErr, {
                context: "source observation insert",
                stage: record.stageName,
                source_name: obs.source_name,
              });
            }
          }
        } catch (persistErr) {
          // Log but don't fail the pipeline for persistence errors
          reportServerError(persistErr, { context: "stage result persistence", stage: record.stageName });
        }
      },
    });

    // Update run status
    const finalStatus = pipelineResult.status === "complete" ? "complete"
      : pipelineResult.status === "partial" ? "partial"
      : "failed";

    // Build finalized manifest snapshot
    const stagesCompleted = pipelineResult.stages.map((s) => ({
      name: s.stageName,
      version: s.stageVersion,
      status: s.status,
      confidence: s.confidence,
      completeness: s.completeness,
      durationMs: s.durationMs,
      cost: s.cost,
    }));
    const dataSourcesUsed = pipelineResult.stages
      .flatMap((s) => s.observations || [])
      .map((o) => o.source_name)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    // Determine next manifest version for this run.
    // This MUST succeed — an execution without a manifest is invalid.
    const { data: existingManifests, error: versionQueryError } = await supabase
      .from("analysis_manifests")
      .select("version")
      .eq("analysis_run_id", run.id)
      .order("version", { ascending: false })
      .limit(1);

    if (versionQueryError) {
      const msg = versionQueryError.message || "";
      if (msg.includes("does not exist") || msg.includes("relation")) {
        // Table doesn't exist — migration 0003 not applied
        reportServerError(versionQueryError, { context: "analysis_manifests table missing" });
        return res.status(503).json({
          error: "Infrastructure error: the analysis_manifests table is not available. "
            + "This typically means migration 0003 has not been applied. "
            + "Apply the migration and retry.",
        });
      }
      throw versionQueryError;
    }

    const nextVersion = (existingManifests?.[0]?.version || 0) + 1;

    const { data: manifestRow, error: manifestError } = await supabase
      .from("analysis_manifests")
      .insert({
        analysis_run_id: run.id,
        version: nextVersion,
        methodology_version_id: run.methodology_version_id,
        depth: run.depth,
        requested_by: run.requested_by,
        stages_planned: ALL_STAGES.map((s) => ({ name: s.name, version: s.version })),
        stages_completed: stagesCompleted,
        data_sources_used: dataSourcesUsed,
        runner_version: RUNNER_VERSION,
        total_cost_usd: pipelineResult.totalCost,
        overall_confidence: pipelineResult.overallConfidence,
        created_by: run.requested_by,
      })
      .select("id, version")
      .single();

    if (manifestError) {
      // Fatal — the execution result has no authoritative provenance record.
      // Mark the run as failed so the user knows the manifest was not recorded.
      await supabase
        .from("analysis_runs")
        .update({
          status: "failed",
          error: `Pipeline completed but manifest persistence failed: ${manifestError.message}`,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      reportServerError(manifestError, { context: "finalized manifest persistence (FATAL)" });
      return res.status(500).json({
        error: "Pipeline completed but the finalized manifest could not be persisted. "
          + "The run has been marked as failed. "
          + `Manifest error: ${manifestError.message}`,
      });
    }

    // Update analysis_runs with final status and deprecated JSONB manifest
    const finalizedManifestJsonb = {
      created_at: new Date().toISOString(),
      methodology_version: run.methodology_version_id,
      requested_by: run.requested_by,
      depth: run.depth,
      stages_planned: ALL_STAGES.map((s) => s.name),
      stages_completed: stagesCompleted,
      data_sources_used: dataSourcesUsed,
      overall_confidence: pipelineResult.overallConfidence,
      data_quality_confidence: pipelineResult.dataQualityConfidence,
      total_cost_usd: pipelineResult.totalCost,
    };

    await supabase
      .from("analysis_runs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        total_cost_usd: pipelineResult.totalCost,
        manifest: finalizedManifestJsonb,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    res.json({
      run_id: run.id,
      status: finalStatus,
      manifest_id: manifestRow.id,
      manifest_version: manifestRow.version,
      stages: pipelineResult.stages.map((s) => ({
        name: s.stageName,
        status: s.status,
        confidence: s.confidence,
        durationMs: s.durationMs,
        error: s.error,
      })),
      totalCost: pipelineResult.totalCost,
      overallConfidence: pipelineResult.overallConfidence,
      dataQualityConfidence: pipelineResult.dataQualityConfidence,
    });
  } catch (error) {
    reportServerError(error, { route: { path: `/api/analyses/${req.params.id}/execute`, method: "POST" } });

    // If a run was claimed but the pipeline threw unexpectedly, mark it as failed
    // so it doesn't stay stuck in "running" forever.
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("analysis_runs")
        .update({
          status: "failed",
          error: "Pipeline execution failed unexpectedly.",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("status", "running"); // only if still running
    } catch (cleanupErr) {
      reportServerError(cleanupErr, { context: "execute cleanup (non-fatal)" });
    }

    // Return a safe error message — do not leak internal details
    res.status(500).json({ error: "Could not execute analysis. The run has been marked as failed." });
  }
});

export default router;
