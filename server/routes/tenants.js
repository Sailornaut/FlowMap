// @ts-check
/**
 * Tenant CRUD routes.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { reportServerError } from "../middleware/error-handler.js";

const router = Router({ mergeParams: true });

/**
 * GET /api/properties/:propertyId/tenants — list tenants for a property.
 */
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tenants")
      .select("*, tenant_categories(slug, name, sector)")
      .eq("property_id", req.params.propertyId)
      .order("is_anchor", { ascending: false })
      .order("name");

    if (error) throw error;

    res.json({ tenants: data });
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not list tenants." });
  }
});

/**
 * POST /api/properties/:propertyId/tenants — create a tenant.
 */
router.post("/", async (req, res) => {
  try {
    const { name, category_id, unit_label, sqft, is_anchor, since, notes } = req.body ?? {};

    if (!name) {
      return res.status(400).json({ error: "name is required." });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tenants")
      .insert({
        property_id: req.params.propertyId,
        name,
        category_id: category_id || null,
        unit_label: unit_label || null,
        sqft: sqft != null ? Number(sqft) : null,
        is_anchor: Boolean(is_anchor),
        since: since || null,
        notes: notes || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not create tenant." });
  }
});

/**
 * PATCH /api/properties/:propertyId/tenants/:id — update a tenant.
 */
router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["name", "category_id", "unit_label", "sqft", "is_anchor", "since", "notes"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tenants")
      .update(updates)
      .eq("id", req.params.id)
      .eq("property_id", req.params.propertyId)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Tenant not found." });
    }

    res.json(data);
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "PATCH" } });
    res.status(500).json({ error: error?.message || "Could not update tenant." });
  }
});

/**
 * DELETE /api/properties/:propertyId/tenants/:id — delete a tenant.
 */
router.delete("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("tenants")
      .delete()
      .eq("id", req.params.id)
      .eq("property_id", req.params.propertyId);

    if (error) throw error;

    res.status(204).end();
  } catch (error) {
    reportServerError(error, { route: { path: req.originalUrl, method: "DELETE" } });
    res.status(500).json({ error: error?.message || "Could not delete tenant." });
  }
});

export default router;
