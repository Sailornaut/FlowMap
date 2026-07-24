// @ts-check
/**
 * Vacancy CRUD routes.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { reportServerError } from "../middleware/error-handler.js";

const router = Router({ mergeParams: true });

/**
 * GET /api/properties/:propertyId/vacancies — list vacancies for a property.
 */
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vacancies")
      .select("*")
      .eq("property_id", req.params.propertyId)
      .order("unit_label");

    if (error) throw error;

    res.json({ vacancies: data });
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not list vacancies." });
  }
});

/**
 * POST /api/properties/:propertyId/vacancies — create a vacancy.
 */
router.post("/", async (req, res) => {
  try {
    const {
      unit_label, sqft, asking_rent_psf, rent_basis, cam_psf,
      condition, prior_tenant, prior_category_id, vacant_since,
      placement, frontage_ft, ceiling_height_ft,
      venting_possible, grease_trap, drive_through, patio_possible,
      loading_access, parking_proximity,
      allowed_uses, restricted_uses,
      analyst_notes, data_confidence,
    } = req.body ?? {};

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vacancies")
      .insert({
        property_id: req.params.propertyId,
        unit_label: unit_label || null,
        sqft: sqft != null ? Number(sqft) : null,
        asking_rent_psf: asking_rent_psf != null ? Number(asking_rent_psf) : null,
        rent_basis: rent_basis || null,
        cam_psf: cam_psf != null ? Number(cam_psf) : null,
        condition: condition || null,
        prior_tenant: prior_tenant || null,
        prior_category_id: prior_category_id || null,
        vacant_since: vacant_since || null,
        placement: placement || null,
        frontage_ft: frontage_ft != null ? Number(frontage_ft) : null,
        ceiling_height_ft: ceiling_height_ft != null ? Number(ceiling_height_ft) : null,
        venting_possible: venting_possible || "unknown",
        grease_trap: grease_trap || "unknown",
        drive_through: drive_through || "unknown",
        patio_possible: patio_possible || "unknown",
        loading_access: loading_access || null,
        parking_proximity: parking_proximity || null,
        allowed_uses: allowed_uses || null,
        restricted_uses: restricted_uses || null,
        analyst_notes: analyst_notes || null,
        data_confidence: data_confidence || "preliminary",
      })
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not create vacancy." });
  }
});

/**
 * PATCH /api/properties/:propertyId/vacancies/:id — update a vacancy.
 */
router.patch("/:id", async (req, res) => {
  try {
    const allowed = [
      "unit_label", "sqft", "asking_rent_psf", "rent_basis", "cam_psf",
      "condition", "prior_tenant", "prior_category_id", "vacant_since",
      "placement", "frontage_ft", "ceiling_height_ft",
      "venting_possible", "grease_trap", "drive_through", "patio_possible",
      "loading_access", "parking_proximity",
      "allowed_uses", "restricted_uses",
      "analyst_notes", "data_confidence",
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vacancies")
      .update(updates)
      .eq("id", req.params.id)
      .eq("property_id", req.params.propertyId)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Vacancy not found." });
    }

    res.json(data);
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "PATCH" } });
    res.status(500).json({ error: error?.message || "Could not update vacancy." });
  }
});

/**
 * DELETE /api/properties/:propertyId/vacancies/:id — delete a vacancy.
 */
router.delete("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("vacancies")
      .delete()
      .eq("id", req.params.id)
      .eq("property_id", req.params.propertyId);

    if (error) throw error;

    res.status(204).end();
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "DELETE" } });
    res.status(500).json({ error: error?.message || "Could not delete vacancy." });
  }
});

export default router;
