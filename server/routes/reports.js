// @ts-check
/**
 * Report routes.
 * Handles PDF generation from completed analyses and report downloads.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { reportServerError } from "../middleware/error-handler.js";
import { renderAnalysisPdf, buildReportSnapshot } from "../reports/analysis-pdf.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Load a full analysis with all joined data needed for PDF rendering.
 * @param {string} analysisId
 * @returns {Promise<{analysis: object, stageOutputs: object, candidates: Array, vacancies: Array, observations: Array} | null>}
 */
async function loadAnalysisForReport(analysisId) {
  const supabase = getSupabaseAdmin();

  // Load analysis with property + manifests + stage results
  const { data: analysis, error } = await supabase
    .from("analysis_runs")
    .select(`
      *,
      properties(*),
      analysis_manifests(version, runner_version, stage_count, inputs_hash, overall_confidence, data_quality_confidence, created_at),
      analysis_stage_results(id, stage_name, stage_version, status, confidence, completeness, outputs, duration_ms, cost, error, created_at)
    `)
    .eq("id", analysisId)
    .order("version", { referencedTable: "analysis_manifests", ascending: false })
    .order("created_at", { referencedTable: "analysis_stage_results", ascending: true })
    .single();

  if (error || !analysis) return null;

  // Build stage outputs map
  const stageOutputs = {};
  for (const sr of analysis.analysis_stage_results || []) {
    if (sr.status === "ok" && sr.outputs) {
      stageOutputs[sr.stage_name] = sr.outputs;
    }
  }

  // Load business candidates with scores
  const { data: candidates } = await supabase
    .from("business_candidates")
    .select(`
      id, rank, verdict,
      tenant_categories(slug, name, sector),
      opportunity_scores(overall, confidence, completeness, positive_factors, negative_factors, disqualifiers,
        score_components(component_key, normalized, weight, explanation))
    `)
    .eq("analysis_run_id", analysisId)
    .order("rank", { ascending: true });

  // Flatten opportunity_scores from array to single object
  const flatCandidates = (candidates || []).map((c) => ({
    ...c,
    opportunity_scores: Array.isArray(c.opportunity_scores)
      ? c.opportunity_scores[0]
      : c.opportunity_scores,
  }));

  // Load vacancies for the property
  const { data: vacancies } = await supabase
    .from("vacancies")
    .select("*")
    .eq("property_id", analysis.property_id)
    .order("unit_label", { ascending: true });

  // Load source observations
  const { data: observations } = await supabase
    .from("source_observations")
    .select("*, data_sources(name, source_type, reliability_tier)")
    .eq("analysis_run_id", analysisId)
    .order("retrieved_at", { ascending: false });

  return {
    analysis,
    stageOutputs,
    candidates: flatCandidates,
    vacancies: vacancies || [],
    observations: observations || [],
  };
}

// ── POST /api/reports/generate/:analysisId ───────────────────────────

/**
 * Generate a PDF report from a completed analysis.
 * Creates a report_project + report_version with snapshot.
 * Returns the report_version ID for download.
 */
router.post("/generate/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;
    const supabase = getSupabaseAdmin();

    // Load full analysis data
    const loaded = await loadAnalysisForReport(analysisId);
    if (!loaded) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    const { analysis, stageOutputs, candidates, vacancies, observations } = loaded;

    // Verify analysis is in a terminal state
    if (!["completed", "partial"].includes(analysis.status)) {
      return res.status(409).json({
        error: "Analysis must be completed or partial to generate a report",
        status: analysis.status,
      });
    }

    // Build summary (import dynamically to avoid client-side dep chain)
    let summary = null;
    try {
      const { buildAnalysisSummary } = await import("../../src/lib/analysis-summary.js");
      summary = buildAnalysisSummary(analysis);
    } catch {
      // Summary is optional — proceed without it
    }

    // Check for existing report project for this analysis
    const { data: existingProject } = await supabase
      .from("report_projects")
      .select("id")
      .eq("analysis_run_id", analysis.id)
      .limit(1)
      .maybeSingle();

    let projectId;

    if (existingProject) {
      projectId = existingProject.id;
    } else {
      // Create report_project
      const { data: project, error: projError } = await supabase
        .from("report_projects")
        .insert({
          property_id: analysis.property_id,
          analysis_run_id: analysis.id,
          kind: "full",
          title: `Analysis Report — ${analysis.properties?.name || "Property"}`,
          status: "draft",
          branding: {},
        })
        .select("id")
        .single();

      if (projError) {
        console.error("Failed to create report_project:", projError.message);
        return res.status(500).json({ error: "Failed to create report project" });
      }
      projectId = project.id;
    }

    // Determine version number
    const { data: latestVersion } = await supabase
      .from("report_versions")
      .select("version")
      .eq("report_project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latestVersion?.version || 0) + 1;

    // Build snapshot
    const pdfParams = { analysis, summary, candidates, vacancies, observations, stageOutputs };
    const snapshot = buildReportSnapshot(pdfParams);

    // Render PDF
    const pdfBuffer = await renderAnalysisPdf(pdfParams);

    // Store report_version with snapshot (schema: id, report_project_id, version, snapshot, pdf_file_id, finalized_by, finalized_at, methodology_version_id)
    // We store pdf_bytes and file_path inside the snapshot since they're not columns.
    snapshot.pdf_bytes = pdfBuffer.length;

    const { data: version, error: versionError } = await supabase
      .from("report_versions")
      .insert({
        report_project_id: projectId,
        version: nextVersion,
        snapshot,
      })
      .select("id, version")
      .single();

    if (versionError) {
      console.error("Failed to create report_version:", versionError.message);
      return res.status(500).json({ error: "Failed to store report version" });
    }

    // Store the PDF in Supabase Storage (reports bucket)
    const pdfPath = `reports/${projectId}/v${nextVersion}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      // Storage may not be configured — log but don't fail
      // The PDF can still be regenerated from the snapshot
      console.warn("PDF storage upload failed (non-fatal):", uploadError.message);
    }

    // Update snapshot with storage path
    if (!uploadError) {
      snapshot.file_path = pdfPath;
      await supabase
        .from("report_versions")
        .update({ snapshot })
        .eq("id", version.id);
    }

    return res.status(201).json({
      report_project_id: projectId,
      report_version_id: version.id,
      version: nextVersion,
      pdf_bytes: snapshot.pdf_bytes,
      sections: snapshot.sections_rendered,
      stored: !uploadError,
    });
  } catch (err) {
    reportServerError(res, err, "report generation");
  }
});

// ── GET /api/reports/:reportVersionId/download ───────────────────────

/**
 * Download a generated PDF report.
 * First tries Supabase Storage; falls back to re-rendering from snapshot.
 */
router.get("/:reportVersionId/download", async (req, res) => {
  try {
    const { reportVersionId } = req.params;
    const supabase = getSupabaseAdmin();

    // Load report version
    const { data: version, error } = await supabase
      .from("report_versions")
      .select("*, report_projects(property_id, analysis_run_id, title)")
      .eq("id", reportVersionId)
      .single();

    if (error || !version) {
      return res.status(404).json({ error: "Report version not found" });
    }

    let pdfBuffer = null;

    // Try loading from storage (path stored in snapshot)
    const storedPath = version.snapshot?.file_path;
    if (storedPath) {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("reports")
        .download(storedPath);

      if (!dlError && fileData) {
        // fileData is a Blob in some Supabase versions, Buffer in others
        if (Buffer.isBuffer(fileData)) {
          pdfBuffer = fileData;
        } else if (fileData.arrayBuffer) {
          pdfBuffer = Buffer.from(await fileData.arrayBuffer());
        }
      }
    }

    // Fallback: re-render from snapshot
    if (!pdfBuffer) {
      const analysisId = version.report_projects?.analysis_run_id;
      if (!analysisId) {
        return res.status(500).json({ error: "Cannot regenerate — no linked analysis" });
      }

      const loaded = await loadAnalysisForReport(analysisId);
      if (!loaded) {
        return res.status(500).json({ error: "Cannot regenerate — analysis data unavailable" });
      }

      let summary = null;
      try {
        const { buildAnalysisSummary } = await import("../../src/lib/analysis-summary.js");
        summary = buildAnalysisSummary(loaded.analysis);
      } catch {
        // Optional
      }

      pdfBuffer = await renderAnalysisPdf({ ...loaded, summary });
    }

    const filename = `trafficscout-report-v${version.version}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    reportServerError(res, err, "report download");
  }
});

// ── GET /api/reports — list reports for a property or analysis ───────

router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("report_projects")
      .select("*, report_versions(id, version, status, pdf_bytes, created_at)")
      .order("created_at", { ascending: false });

    if (req.query.property_id) {
      query = query.eq("property_id", req.query.property_id);
    }
    if (req.query.analysis_run_id) {
      query = query.eq("analysis_run_id", req.query.analysis_run_id);
    }

    const { data, error } = await query.limit(50);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (err) {
    reportServerError(res, err, "list reports");
  }
});

export default router;
