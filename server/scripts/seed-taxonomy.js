#!/usr/bin/env node
// @ts-check
/**
 * Seed tenant_categories, methodology_versions, and category_profiles
 * from the canonical src/domain/taxonomy + scoring modules.
 *
 * Idempotent: uses upserts on unique constraints. Safe to rerun.
 *
 * Usage:
 *   node server/scripts/seed-taxonomy.js
 *
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env or .env files.
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, TAXONOMY_VERSION } from "../../src/domain/taxonomy/categories.js";
import { validateTaxonomy } from "../../src/domain/taxonomy/index.js";
import { DEFAULT_WEIGHTS, SCORING_VERSION } from "../../src/domain/scoring/index.js";

dotenv.config({ path: "trafficscout-api.env" });
dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // ── Validate taxonomy before writing ────────────────────────────────
  const problems = validateTaxonomy();
  if (problems.length > 0) {
    console.error("Taxonomy validation failed:");
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log(`Taxonomy valid: ${CATEGORIES.length} categories, version ${TAXONOMY_VERSION}`);

  // ── Seed tenant_categories ──────────────────────────────────────────
  const categoryRows = CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    sector: c.sector,
    taxonomy_version: TAXONOMY_VERSION,
    active: true,
  }));

  const { data: upsertedCategories, error: catError } = await supabase
    .from("tenant_categories")
    .upsert(categoryRows, { onConflict: "slug" })
    .select("id, slug");

  if (catError) {
    console.error("Failed to seed tenant_categories:", catError.message);
    process.exit(1);
  }
  console.log(`Seeded ${upsertedCategories.length} tenant_categories`);

  const slugToId = new Map(upsertedCategories.map((r) => [r.slug, r.id]));

  // ── Seed default methodology version ────────────────────────────────
  const methodologyVersion = `scoring-${SCORING_VERSION}`;

  const { data: existingMV } = await supabase
    .from("methodology_versions")
    .select("id")
    .eq("version", methodologyVersion)
    .maybeSingle();

  let methodologyId;
  if (existingMV) {
    methodologyId = existingMV.id;
    // Update weights if changed
    const { error: mvUpdateError } = await supabase
      .from("methodology_versions")
      .update({ weights: DEFAULT_WEIGHTS, active: true })
      .eq("id", methodologyId);
    if (mvUpdateError) {
      console.error("Failed to update methodology_versions:", mvUpdateError.message);
      process.exit(1);
    }
    console.log(`Updated methodology version: ${methodologyVersion} (${methodologyId})`);
  } else {
    const { data: newMV, error: mvError } = await supabase
      .from("methodology_versions")
      .insert({
        version: methodologyVersion,
        weights: DEFAULT_WEIGHTS,
        active: true,
        notes: `Auto-seeded from scoring engine v${SCORING_VERSION}, taxonomy v${TAXONOMY_VERSION}`,
      })
      .select("id")
      .single();
    if (mvError) {
      console.error("Failed to seed methodology_versions:", mvError.message);
      process.exit(1);
    }
    methodologyId = newMV.id;
    console.log(`Created methodology version: ${methodologyVersion} (${methodologyId})`);
  }

  // ── Seed category_profiles ──────────────────────────────────────────
  const profileRows = CATEGORIES.map((c) => ({
    category_id: slugToId.get(c.slug),
    methodology_version_id: methodologyId,
    attrs: c.profile,
  }));

  // Upsert on (category_id, methodology_version_id) unique constraint
  const { error: profileError } = await supabase
    .from("category_profiles")
    .upsert(profileRows, { onConflict: "category_id,methodology_version_id" });

  if (profileError) {
    console.error("Failed to seed category_profiles:", profileError.message);
    process.exit(1);
  }
  console.log(`Seeded ${profileRows.length} category_profiles`);

  console.log("\nSeed complete.");
  console.log(`  methodology_version_id: ${methodologyId}`);
  console.log(`  Use this ID when querying opportunity_scores.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
