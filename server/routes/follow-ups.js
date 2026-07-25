// @ts-check
/**
 * Follow-up routes.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { reportServerError } from "../middleware/error-handler.js";

const router = Router();

/** Default milestone definitions: label → months offset */
const DEFAULT_MILESTONES = [
  { milestone: "3_month", monthsOffset: 3, title: "3-month follow-up" },
  { milestone: "6_month", monthsOffset: 6, title: "6-month follow-up" },
  { milestone: "12_month", monthsOffset: 12, title: "12-month follow-up" },
  { milestone: "24_month", monthsOffset: 24, title: "24-month follow-up" },
];

/**
 * Compute a due date by adding months to a base date.
 * @param {Date} base
 * @param {number} months
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function addMonths(base, months) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * POST /api/follow-ups/generate — auto-create default milestones for a completed analysis.
 * Body: { analysis_run_id, property_id }
 * Idempotent: skips milestones that already exist for this analysis.
 */
router.post("/generate", async (req, res) => {
  try {
    const { analysis_run_id, property_id } = req.body;
    if (!analysis_run_id || !property_id) {
      return res.status(400).json({ error: "analysis_run_id and property_id are required." });
    }

    const supabase = getSupabaseAdmin();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    // Check which milestones already exist for this analysis
    const { data: existing, error: fetchErr } = await supabase
      .from("follow_ups")
      .select("milestone")
      .eq("analysis_run_id", analysis_run_id);
    if (fetchErr) throw fetchErr;

    const existingMilestones = new Set((existing || []).map((r) => r.milestone));
    const baseDate = new Date();
    const toInsert = DEFAULT_MILESTONES
      .filter((m) => !existingMilestones.has(m.milestone))
      .map((m) => ({
        property_id,
        analysis_run_id,
        milestone: m.milestone,
        due_date: addMonths(baseDate, m.monthsOffset),
        status: "pending",
        title: m.title,
        created_by: userId,
      }));

    if (toInsert.length === 0) {
      return res.json({ follow_ups: existing, created: 0 });
    }

    const { data, error } = await supabase
      .from("follow_ups")
      .insert(toInsert)
      .select();
    if (error) throw error;

    res.status(201).json({ follow_ups: data, created: data.length });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/follow-ups/generate", method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not generate follow-ups." });
  }
});

/**
 * GET /api/follow-ups — list follow-ups.
 * Query params: property_id, analysis_run_id, status, overdue (boolean).
 */
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("follow_ups")
      .select("*, properties(name, address)")
      .order("due_date", { ascending: true });

    if (req.query.property_id) query = query.eq("property_id", req.query.property_id);
    if (req.query.analysis_run_id) query = query.eq("analysis_run_id", req.query.analysis_run_id);
    if (req.query.status) query = query.eq("status", req.query.status);
    if (req.query.overdue === "true") {
      query = query.eq("status", "pending").lt("due_date", new Date().toISOString().slice(0, 10));
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ follow_ups: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/follow-ups", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not list follow-ups." });
  }
});

/**
 * GET /api/follow-ups/summary — counts by status for dashboard.
 */
router.get("/summary", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const [pendingRes, overdueRes, completedRes] = await Promise.all([
      supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", today),
      supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "completed"),
    ]);

    res.json({
      pending: pendingRes.count || 0,
      overdue: overdueRes.count || 0,
      completed: completedRes.count || 0,
    });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/follow-ups/summary", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not get summary." });
  }
});

/**
 * GET /api/follow-ups/:id — single follow-up.
 */
router.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("follow_ups")
      .select("*, properties(name, address)")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Follow-up not found." });

    res.json({ follow_up: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/follow-ups/:id", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not fetch follow-up." });
  }
});

/**
 * POST /api/follow-ups — create a single follow-up.
 */
router.post("/", async (req, res) => {
  try {
    const { property_id, analysis_run_id, vacancy_id, milestone, due_date, title, notes } = req.body;
    if (!property_id || !due_date || !title) {
      return res.status(400).json({ error: "property_id, due_date, and title are required." });
    }

    const supabase = getSupabaseAdmin();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const { data, error } = await supabase
      .from("follow_ups")
      .insert({
        property_id,
        analysis_run_id: analysis_run_id || null,
        vacancy_id: vacancy_id || null,
        milestone: milestone || "custom",
        due_date,
        title,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({ follow_up: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/follow-ups", method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not create follow-up." });
  }
});

/**
 * PATCH /api/follow-ups/:id — update a follow-up (status, notes, title, due_date).
 */
router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["status", "title", "notes", "due_date"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // If marking completed, set completed_at and completed_by
    if (updates.status === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = req.user?.id;
    }
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1 && updates.updated_at) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("follow_ups")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Follow-up not found." });

    res.json({ follow_up: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/follow-ups/:id", method: "PATCH" } });
    res.status(500).json({ error: error?.message || "Could not update follow-up." });
  }
});

export default router;

/**
 * Generate default follow-up milestones for a completed analysis.
 * Exported for use by the analysis execution route.
 * @param {{ analysisRunId: string, propertyId: string, userId: string }} params
 * @returns {Promise<number>} number of follow-ups created
 */
export async function generateDefaultFollowUps({ analysisRunId, propertyId, userId }) {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("follow_ups")
    .select("milestone")
    .eq("analysis_run_id", analysisRunId);

  const existingMilestones = new Set((existing || []).map((r) => r.milestone));
  const baseDate = new Date();
  const toInsert = DEFAULT_MILESTONES
    .filter((m) => !existingMilestones.has(m.milestone))
    .map((m) => ({
      property_id: propertyId,
      analysis_run_id: analysisRunId,
      milestone: m.milestone,
      due_date: addMonths(baseDate, m.monthsOffset),
      status: "pending",
      title: m.title,
      created_by: userId,
    }));

  if (toInsert.length === 0) return 0;

  const { data, error } = await supabase.from("follow_ups").insert(toInsert).select();
  if (error) {
    console.warn("[follow-ups] Failed to auto-generate milestones:", error.message);
    return 0;
  }
  return data.length;
}
