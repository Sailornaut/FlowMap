// @ts-check
/**
 * Property CRUD routes.
 * All routes require internal-staff access (enforced by middleware).
 */

import { Router } from "express";
import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { reportServerError } from "../middleware/error-handler.js";

const router = Router();

/**
 * GET /api/properties — list properties (with optional filters).
 */
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("properties")
      .select("*, tenants(count), vacancies(count)")
      .order("updated_at", { ascending: false });

    if (req.query.status) {
      query = query.eq("status", req.query.status);
    }
    if (req.query.property_type) {
      query = query.eq("property_type", req.query.property_type);
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ properties: data, count });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/properties", method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not list properties." });
  }
});

/**
 * GET /api/properties/:id — get a single property with tenants and vacancies.
 */
router.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("properties")
      .select("*, tenants(*), vacancies(*)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Property not found." });
    }

    res.json(data);
  } catch (error) {
    reportServerError(error, { route: { path: `/api/properties/${req.params.id}`, method: "GET" } });
    res.status(500).json({ error: error?.message || "Could not load property." });
  }
});

/**
 * POST /api/properties — create a property.
 */
router.post("/", async (req, res) => {
  try {
    const {
      name, address, city, state, postal_code,
      lat, lng, property_type, center_subtype,
      total_gla_sqft, parking_spaces, parking_notes,
      website, analyst_notes, status,
    } = req.body ?? {};

    if (!name || !address || !property_type) {
      return res.status(400).json({
        error: "name, address, and property_type are required.",
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("properties")
      .insert({
        name,
        address,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        lat: lat != null ? Number(lat) : null,
        lng: lng != null ? Number(lng) : null,
        property_type,
        center_subtype: center_subtype || null,
        total_gla_sqft: total_gla_sqft != null ? Number(total_gla_sqft) : null,
        parking_spaces: parking_spaces != null ? Number(parking_spaces) : null,
        parking_notes: parking_notes || null,
        website: website || null,
        analyst_notes: analyst_notes || null,
        status: status || "active",
        created_by: req.authContext?.user?.id || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    reportServerError(error, { route: { path: "/api/properties", method: "POST" } });
    res.status(500).json({ error: error?.message || "Could not create property." });
  }
});

/**
 * PATCH /api/properties/:id — update a property.
 */
router.patch("/:id", async (req, res) => {
  try {
    const allowed = [
      "name", "address", "city", "state", "postal_code",
      "lat", "lng", "property_type", "center_subtype",
      "total_gla_sqft", "parking_spaces", "parking_notes",
      "website", "analyst_notes", "status", "boundary",
      "access_points", "road_frontage", "signage_visibility",
      "data_freshness_at",
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
      .from("properties")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Property not found." });
    }

    res.json(data);
  } catch (error) {
    reportServerError(error, { route: { path: `/api/properties/${req.params.id}`, method: "PATCH" } });
    res.status(500).json({ error: error?.message || "Could not update property." });
  }
});

export default router;
