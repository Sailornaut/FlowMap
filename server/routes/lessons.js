// @ts-check
/**
 * Lessons-learned routes.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { reportServerError } from "../middleware/error-handler.js";

const router = Router();

/** Valid subject types for lesson references. */
const VALID_SUBJECT_TYPES = new Set([
  "analysis_run", "report_project", "property",
  "vacancy", "observed_outcome", "follow_up",
]);

/**
 * GET /api/lessons — list lessons.
 * Query params: lesson_type, severity, subject_type + subject_id (find lessons referencing a specific entity).
 */
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    // If filtering by referenced entity, join through lesson_references
    if (req.query.subject_type && req.query.subject_id) {
      const { data: refs, error: refErr } = await supabase
        .from("lesson_references")
        .select("lesson_id")
        .eq("subject_type", req.query.subject_type)
        .eq("subject_id", req.query.subject_id);
      if (refErr) throw refErr;

      const lessonIds = (refs || []).map((r) => r.lesson_id);
      if (lessonIds.length === 0) {
        return res.json({ lessons: [] });
      }

      const { data, error } = await supabase
        .from("lessons_learned")
        .select("*, lesson_references(*)")
        .in("id", lessonIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return res.json({ lessons: data });
    }

    // Standard list
    let query = supabase
      .from("lessons_learned")
      .select("*, lesson_references(*)")
      .order("created_at", { ascending: false });

    if (req.query.lesson_type) query = query.eq("lesson_type", req.query.lesson_type);
    if (req.query.severity) query = query.eq("severity", req.query.severity);

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ lessons: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/lessons", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not list lessons." });
  }
});

/**
 * GET /api/lessons/:id — single lesson with references.
 */
router.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("lessons_learned")
      .select("*, lesson_references(*)")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Lesson not found." });

    res.json({ lesson: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/lessons/:id", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not fetch lesson." });
  }
});

/**
 * POST /api/lessons — create a lesson with optional references.
 * Body: { title, body, lesson_type, severity, references?: [{ subject_type, subject_id }] }
 */
router.post("/", async (req, res) => {
  try {
    const { title, body, lesson_type, severity, references } = req.body;
    if (!title || !body || !lesson_type) {
      return res.status(400).json({ error: "title, body, and lesson_type are required." });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    // Validate references if provided
    if (references && Array.isArray(references)) {
      for (const ref of references) {
        if (!VALID_SUBJECT_TYPES.has(ref.subject_type)) {
          return res.status(400).json({
            error: `Invalid subject_type "${ref.subject_type}". Must be one of: ${[...VALID_SUBJECT_TYPES].join(", ")}`,
          });
        }
        if (!ref.subject_id) {
          return res.status(400).json({ error: "Each reference must have a subject_id." });
        }
      }
    }

    const supabase = getSupabaseAdmin();

    // Create the lesson
    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons_learned")
      .insert({
        title,
        body,
        lesson_type,
        severity: severity || "minor",
        created_by: userId,
      })
      .select()
      .single();
    if (lessonErr) throw lessonErr;

    // Insert references if provided
    let lessonRefs = [];
    if (references && references.length > 0) {
      const refsToInsert = references.map((ref) => ({
        lesson_id: lesson.id,
        subject_type: ref.subject_type,
        subject_id: ref.subject_id,
      }));
      const { data: refData, error: refErr } = await supabase
        .from("lesson_references")
        .insert(refsToInsert)
        .select();
      if (refErr) {
        console.warn("[lessons] Failed to insert references:", refErr.message);
      } else {
        lessonRefs = refData;
      }
    }

    res.status(201).json({ lesson: { ...lesson, lesson_references: lessonRefs } });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/lessons", method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not create lesson." });
  }
});

/**
 * PATCH /api/lessons/:id — update a lesson.
 */
router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["title", "body", "lesson_type", "severity"];
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
      .from("lessons_learned")
      .update(updates)
      .eq("id", req.params.id)
      .select("*, lesson_references(*)")
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Lesson not found." });

    res.json({ lesson: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/lessons/:id", method: "PATCH" } });
    res.status(500).json({ error: error?.message || "Could not update lesson." });
  }
});

/**
 * POST /api/lessons/:id/references — add references to an existing lesson.
 * Body: { references: [{ subject_type, subject_id }] }
 */
router.post("/:id/references", async (req, res) => {
  try {
    const { references } = req.body;
    if (!references || !Array.isArray(references) || references.length === 0) {
      return res.status(400).json({ error: "references array is required." });
    }

    for (const ref of references) {
      if (!VALID_SUBJECT_TYPES.has(ref.subject_type)) {
        return res.status(400).json({
          error: `Invalid subject_type "${ref.subject_type}".`,
        });
      }
      if (!ref.subject_id) {
        return res.status(400).json({ error: "Each reference must have a subject_id." });
      }
    }

    const supabase = getSupabaseAdmin();

    // Verify lesson exists
    const { data: lesson, error: fetchErr } = await supabase
      .from("lessons_learned")
      .select("id")
      .eq("id", req.params.id)
      .single();
    if (fetchErr || !lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    const refsToInsert = references.map((ref) => ({
      lesson_id: req.params.id,
      subject_type: ref.subject_type,
      subject_id: ref.subject_id,
    }));

    const { data, error } = await supabase
      .from("lesson_references")
      .insert(refsToInsert)
      .select();
    if (error) throw error;

    res.status(201).json({ references: data });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/lessons/:id/references", method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not add references." });
  }
});

/**
 * DELETE /api/lessons/:id/references/:refId — remove a reference.
 */
router.delete("/:id/references/:refId", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("lesson_references")
      .delete()
      .eq("id", req.params.refId)
      .eq("lesson_id", req.params.id);
    if (error) throw error;

    res.json({ deleted: true });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/lessons/:id/references/:refId", method: "DELETE" } });
    res.status(500).json({ error: error?.message || "Could not delete reference." });
  }
});

export default router;
