// @ts-check
/**
 * Observed-outcome routes.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { reportServerError } from "../middleware/error-handler.js";

const router = Router();

/**
 * GET /api/outcomes — list observed outcomes.
 * Query params: property_id, analysis_run_id, vacancy_id, follow_up_id, outcome_type, evidence_type.
 */
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("observed_outcomes")
      .select("*, properties(name, address), tenant_categories(name, slug)")
      .order("created_at", { ascending: false });

    if (req.query.property_id) query = query.eq("property_id", req.query.property_id);
    if (req.query.analysis_run_id) query = query.eq("analysis_run_id", req.query.analysis_run_id);
    if (req.query.vacancy_id) query = query.eq("vacancy_id", req.query.vacancy_id);
    if (req.query.follow_up_id) query = query.eq("follow_up_id", req.query.follow_up_id);
    if (req.query.outcome_type) query = query.eq("outcome_type", req.query.outcome_type);
    if (req.query.evidence_type) query = query.eq("evidence_type", req.query.evidence_type);

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ outcomes: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/outcomes", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not list outcomes." });
  }
});

/**
 * GET /api/outcomes/:id — single outcome with joins.
 */
router.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("observed_outcomes")
      .select("*, properties(name, address), tenant_categories(name, slug), follow_ups(title, milestone)")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Outcome not found." });

    res.json({ outcome: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/outcomes/:id", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not fetch outcome." });
  }
});

/**
 * POST /api/outcomes — record an observed outcome.
 */
router.post("/", async (req, res) => {
  try {
    const {
      property_id, analysis_run_id, vacancy_id, follow_up_id,
      outcome_type, tenant_name, tenant_category_id,
      actual_rent_psf, rent_basis, lease_date,
      prediction_accuracy, our_recommendation_rank,
      evidence_type, source_observation_id, notes,
    } = req.body;

    if (!property_id || !outcome_type) {
      return res.status(400).json({ error: "property_id and outcome_type are required." });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("observed_outcomes")
      .insert({
        property_id,
        analysis_run_id: analysis_run_id || null,
        vacancy_id: vacancy_id || null,
        follow_up_id: follow_up_id || null,
        outcome_type,
        tenant_name: tenant_name || null,
        tenant_category_id: tenant_category_id || null,
        actual_rent_psf: actual_rent_psf != null ? actual_rent_psf : null,
        rent_basis: rent_basis || null,
        lease_date: lease_date || null,
        prediction_accuracy: prediction_accuracy || null,
        our_recommendation_rank: our_recommendation_rank != null ? our_recommendation_rank : null,
        evidence_type: evidence_type || "observation",
        source_observation_id: source_observation_id || null,
        notes: notes || null,
        recorded_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({ outcome: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/outcomes", method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not create outcome." });
  }
});

/**
 * PATCH /api/outcomes/:id — update an outcome.
 */
router.patch("/:id", async (req, res) => {
  try {
    const allowed = [
      "outcome_type", "tenant_name", "tenant_category_id",
      "actual_rent_psf", "rent_basis", "lease_date",
      "prediction_accuracy", "our_recommendation_rank",
      "evidence_type", "source_observation_id", "notes",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1 && updates.updated_at) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("observed_outcomes")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Outcome not found." });

    res.json({ outcome: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/outcomes/:id", method: "PATCH" } });
    res.status(500).json({ error: error?.message || "Could not update outcome." });
  }
});

export default router;
