// @ts-check
/**
 * End-to-end live analysis test.
 *
 * Exercises the EXACT same code path as POST /api/analyses/:id/execute:
 *   1. Creates a test property in Supabase
 *   2. Creates an analysis run via the atomic RPC
 *   3. Runs all 5 pipeline stages with live external APIs
 *   4. Persists stage results and source observations
 *   5. Creates an immutable manifest
 *   6. Verifies everything was persisted correctly
 *
 * Run locally (NOT in CI/sandbox):
 *   cd FlowMap && node server/__tests__/e2e-live-analysis.js
 *
 * Requires:
 *   - trafficscout-api.env with VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_MAPBOX_ACCESS_TOKEN
 *   - Migrations 0001–0003 applied
 *   - A profile with role='staff' or 'admin' in profiles table
 */

import dotenv from "dotenv";
dotenv.config({ path: "trafficscout-api.env" });
dotenv.config({ path: ".env.local" });
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { createGeocodingService, createIsochroneService } from "../services/mapbox.js";
import { createCensusService } from "../services/census.js";
import { createOverpassService } from "../services/overpass.js";
import { runPipeline, RUNNER_VERSION } from "../pipeline/runner.js";
import { ALL_STAGES } from "../pipeline/stages/index.js";

// ── Helpers ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log("  ✓", msg); }
  else { failed++; console.error("  ✗ FAIL:", msg); }
}

function fatal(msg) {
  console.error("\n✗ FATAL:", msg);
  process.exit(1);
}

// ── Supabase client ──────────────────────────────────────────────────
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fatal("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Test address ─────────────────────────────────────────────────────
const TEST_PROPERTY = {
  name: "E2E Test — Barbur Blvd Strip Center",
  address: "8530 SW Barbur Blvd",
  city: "Portland",
  state: "OR",
  postal_code: "97219",
  property_type: "retail",
  total_gla_sqft: 22000,
  analyst_notes: "Automated end-to-end test property. Safe to delete.",
};

const RUN_DEPTH = "standard";

// Track IDs for cleanup
let propertyId;
let runId;

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  TrafficScout — End-to-End Live Analysis");
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Step 1: Create test property ─────────────────────────────────
  console.log("── Step 1: Create test property ──");
  {
    const { data, error } = await supabase
      .from("properties")
      .insert(TEST_PROPERTY)
      .select("id, name, address, city, state, postal_code")
      .single();

    if (error) fatal(`Could not create property: ${error.message}`);
    propertyId = data.id;
    assert(!!propertyId, `property created: ${propertyId}`);
    assert(data.address === TEST_PROPERTY.address, `address matches: ${data.address}`);
    console.log("  property_id:", propertyId);
  }

  // ── Step 2: Create analysis run via atomic RPC ───────────────────
  console.log("\n── Step 2: Create analysis run (atomic RPC) ──");
  {
    const { data, error } = await supabase.rpc("create_analysis_run_with_manifest", {
      p_property_id: propertyId,
      p_requested_by: null,
      p_depth: RUN_DEPTH,
      p_methodology_version_id: null,
      p_notes: "E2E test run",
    });

    if (error) fatal(`RPC failed: ${error.message}\nHave you applied migration 0003?`);
    runId = data.id;
    assert(!!runId, `analysis run created: ${runId}`);
    assert(data.manifest_id != null, `manifest v1 created: ${data.manifest_id}`);
    assert(data.manifest_version === 1, `manifest version is 1`);
    console.log("  run_id:", runId);
    console.log("  manifest_id:", data.manifest_id);
  }

  // Verify the run row exists
  {
    const { data: run } = await supabase
      .from("analysis_runs")
      .select("id, status, depth")
      .eq("id", runId)
      .single();

    assert(run?.status === "queued", `run status is 'queued': ${run?.status}`);
    assert(run?.depth === RUN_DEPTH, `run depth is '${RUN_DEPTH}'`);
  }

  // ── Step 3: Build live service clients ───────────────────────────
  console.log("\n── Step 3: Build service clients ──");
  const services = {};
  const geocoding = createGeocodingService();
  if (geocoding) services.geocoding = geocoding;
  const isochrone = createIsochroneService();
  if (isochrone) services.isochrone = isochrone;
  const census = createCensusService();
  if (census) services.census = census;
  const places = createOverpassService();
  if (places) services.places = places;

  assert(!!services.geocoding, "geocoding service available");
  assert(!!services.isochrone, "isochrone service available");
  assert(!!services.census, "census service available");
  assert(!!services.places, "overpass/POI service available");

  // ── Step 4: Mark run as running & execute pipeline ───────────────
  console.log("\n── Step 4: Execute pipeline (5 stages, live APIs) ──");
  {
    await supabase
      .from("analysis_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);
  }

  // Load property back (with all columns)
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("*, tenant_categories(slug, name, sector)")
    .eq("property_id", propertyId);

  const { data: vacancies } = await supabase
    .from("vacancies")
    .select("*")
    .eq("property_id", propertyId);

  const pipelineCtx = {
    property,
    tenants: tenants || [],
    vacancies: vacancies || [],
    analysisRun: { id: runId, depth: RUN_DEPTH },
    stageOutputs: {},
    services,
    config: {},
  };

  let persistedStageResults = 0;
  let persistedObservations = 0;

  // Pre-load data source IDs (name → uuid) for observation linking
  const dataSourceIds = {};
  {
    const { data: sources } = await supabase
      .from("data_sources")
      .select("id, name")
      .eq("enabled", true);
    for (const s of sources || []) {
      dataSourceIds[s.name] = s.id;
    }
    const count = Object.keys(dataSourceIds).length;
    assert(count >= 4, `${count} data sources loaded (need ≥4 — apply migration 0004 if 0)`);
    if (count > 0) console.log("  sources:", Object.keys(dataSourceIds).join(", "));
  }

  const pipelineResult = await runPipeline(ALL_STAGES, pipelineCtx, {
    depth: RUN_DEPTH,
    onStageComplete: async (record) => {
      // Persist stage result (same logic as analyses.js route)
      const { error: stageErr } = await supabase.from("analysis_stage_results").insert({
        analysis_run_id: runId,
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

      if (stageErr) {
        console.error(`  ✗ stage persist error (${record.stageName}):`, stageErr.message);
      } else {
        persistedStageResults++;
      }

      // Persist source observations (requires data_sources rows from migration 0004)
      for (const obs of record.observations || []) {
        const sourceId = dataSourceIds[obs.source_name];
        if (!sourceId) {
          console.warn(`  ⚠ no data_source for "${obs.source_name}" — skipping observation`);
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
          subject_id: propertyId,
          analysis_run_id: runId,
        });
        if (obsErr) {
          console.error(`  ✗ observation persist error:`, obsErr.message);
        } else {
          persistedObservations++;
        }
      }

      const icon = record.status === "ok" ? "✓" : record.status === "skipped" ? "⊘" : "✗";
      console.log(`  ${icon} ${record.stageName} [${record.status}] confidence=${record.confidence} ${record.durationMs}ms`);
    },
  });

  console.log(`\n  Pipeline status: ${pipelineResult.status}`);
  console.log(`  Overall confidence: ${pipelineResult.overallConfidence}`);
  console.log(`  Data quality confidence: ${pipelineResult.dataQualityConfidence}`);
  console.log(`  Total duration: ${pipelineResult.totalDurationMs}ms`);
  console.log(`  Total cost: $${pipelineResult.totalCost.toFixed(4)}`);

  assert(["complete", "partial"].includes(pipelineResult.status), `pipeline completed: ${pipelineResult.status}`);
  assert(pipelineResult.stages.length === ALL_STAGES.length, `all ${ALL_STAGES.length} stages ran`);

  // ── Step 5: Persist manifest ─────────────────────────────────────
  console.log("\n── Step 5: Persist finalized manifest ──");

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
    .filter((v, i, a) => v && a.indexOf(v) === i);

  // Get next version (v1 was created by RPC, so this should be v2)
  const { data: existingManifests } = await supabase
    .from("analysis_manifests")
    .select("version")
    .eq("analysis_run_id", runId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = (existingManifests?.[0]?.version || 0) + 1;
  assert(nextVersion === 2, `manifest next version is 2 (v1 from RPC, v2 from execution)`);

  const { data: manifest, error: manifestErr } = await supabase
    .from("analysis_manifests")
    .insert({
      analysis_run_id: runId,
      version: nextVersion,
      methodology_version_id: null,
      depth: RUN_DEPTH,
      requested_by: null,
      stages_planned: ALL_STAGES.map((s) => ({ name: s.name, version: s.version })),
      stages_completed: stagesCompleted,
      data_sources_used: dataSourcesUsed,
      runner_version: RUNNER_VERSION,
      total_cost_usd: pipelineResult.totalCost,
      overall_confidence: pipelineResult.overallConfidence,
      created_by: null,
    })
    .select("id, version")
    .single();

  if (manifestErr) fatal(`Manifest persistence failed: ${manifestErr.message}`);
  assert(manifest.version === 2, `manifest v2 persisted: ${manifest.id}`);

  // Update run status
  const finalStatus = pipelineResult.status === "complete" ? "complete"
    : pipelineResult.status === "partial" ? "partial" : "failed";

  await supabase
    .from("analysis_runs")
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      total_cost_usd: pipelineResult.totalCost,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  // ── Step 6: Verify persistence ───────────────────────────────────
  console.log("\n── Step 6: Verify persistence ──");

  // 6a. Run status
  {
    const { data: finalRun } = await supabase
      .from("analysis_runs")
      .select("id, status, depth, finished_at, total_cost_usd")
      .eq("id", runId)
      .single();

    assert(finalRun?.status === finalStatus, `run final status: ${finalRun?.status}`);
    assert(finalRun?.finished_at != null, "run has finished_at");
  }

  // 6b. Stage results
  {
    const { data: stages } = await supabase
      .from("analysis_stage_results")
      .select("stage_name, status, confidence")
      .eq("analysis_run_id", runId)
      .order("created_at");

    assert(stages?.length === persistedStageResults, `${stages?.length} stage results persisted`);
    for (const s of stages || []) {
      console.log(`    ${s.stage_name}: ${s.status} (${s.confidence})`);
    }
  }

  // 6c. Source observations
  {
    const { data: obs, count } = await supabase
      .from("source_observations")
      .select("source_url_or_id, confidence", { count: "exact" })
      .eq("analysis_run_id", runId);

    assert(count === persistedObservations, `${count} source observations persisted`);
  }

  // 6d. Manifests (should have v1 from RPC + v2 from execution)
  {
    const { data: manifests } = await supabase
      .from("analysis_manifests")
      .select("id, version, overall_confidence, depth, runner_version")
      .eq("analysis_run_id", runId)
      .order("version");

    assert(manifests?.length === 2, `2 manifest versions exist`);
    assert(manifests?.[0]?.version === 1, "manifest v1 (RPC) present");
    assert(manifests?.[1]?.version === 2, "manifest v2 (execution) present");
    assert(manifests?.[1]?.runner_version === RUNNER_VERSION, `runner version: ${RUNNER_VERSION}`);
  }

  // 6e. Verify manifest immutability (UPDATE should be rejected)
  {
    const { error: updateErr } = await supabase
      .from("analysis_manifests")
      .update({ depth: "full" })
      .eq("analysis_run_id", runId)
      .eq("version", 1);

    assert(updateErr != null, `manifest UPDATE rejected: ${updateErr?.message?.slice(0, 60)}`);
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`  Property: ${propertyId}`);
  console.log(`  Run:      ${runId}`);
  console.log(`  Status:   ${finalStatus}`);
  console.log(`  Stages:   ${persistedStageResults} persisted`);
  console.log(`  Sources:  ${persistedObservations} observations`);
  console.log("═══════════════════════════════════════════════════════");

  if (failed > 0) {
    console.log("\n⚠  Some assertions failed. Review the output above.");
    process.exit(1);
  }

  console.log("\n✓ End-to-end live analysis verified.");
  console.log("\nThe test property and analysis remain in the database.");
  console.log("You can view them in the workspace UI at /workspace/properties");
  console.log("To clean up later: DELETE FROM properties WHERE id = '" + propertyId + "'");
}

main().catch((err) => {
  console.error("\nUnhandled error:", err);
  process.exit(1);
});
