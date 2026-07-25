// @ts-check
/**
 * Evidence extractor — converts pipeline stage outputs into EvidenceInputs
 * for the scoring engine.
 *
 * Each function maps real, persisted stage data to a 0–100 score.
 * No fabrication: if data is missing, the score is null (defaults to 50
 * in the scoring engine, with reduced completeness).
 *
 * All thresholds are documented and traceable.
 */

/**
 * @typedef {import("../../src/domain/scoring/index.js").EvidenceInputs} EvidenceInputs
 * @typedef {import("../../src/domain/taxonomy/categories.js").CategoryProfile} CategoryProfile
 */

// ── Level-to-numeric mapping ──────────────────────────────────────────

const LEVEL_MAP = { low: 1, medium: 2, high: 3 };

function levelToNumber(level) {
  return LEVEL_MAP[level] ?? 2;
}

// ── Demographic alignment ─────────────────────────────────────────────

/**
 * Score how well tract demographics align with a category's preferences.
 *
 * Components:
 * - Income alignment: compares median_household_income to sensitivity thresholds
 * - Population density: raw population as a proxy for local demand base
 * - Family orientation: family_household_pct vs familyHouseholdSensitivity
 *
 * @param {object} demographics - From demographics stage outputs.demographics
 * @param {CategoryProfile} profile
 * @returns {number} 0–100
 */
export function scoreDemographicAlignment(demographics, profile) {
  if (!demographics) return null;

  let total = 0;
  let weights = 0;

  // Income alignment (weight: 3)
  const income = demographics.median_household_income;
  if (income != null) {
    const sensitivity = levelToNumber(profile.incomeSensitivity);
    // Thresholds: low-sensitivity categories are fine at $40k+; high need $75k+
    const thresholds = { 1: 40000, 2: 55000, 3: 75000 };
    const needed = thresholds[sensitivity];
    const incomeScore = income >= needed * 1.3
      ? 100
      : income >= needed
        ? 70 + 30 * ((income - needed) / (needed * 0.3))
        : Math.max(0, 70 * (income / needed));
    total += Math.round(incomeScore) * 3;
    weights += 3;
  }

  // Population (weight: 2)
  const pop = demographics.total_population;
  if (pop != null) {
    // 0–2000: weak, 2000–5000: adequate, 5000–15000: good, 15000+: excellent
    const popScore = pop >= 15000 ? 100 : pop >= 5000 ? 70 + 30 * ((pop - 5000) / 10000) : pop >= 2000 ? 40 + 30 * ((pop - 2000) / 3000) : Math.max(0, 40 * (pop / 2000));
    total += Math.round(popScore) * 2;
    weights += 2;
  }

  // Family orientation (weight: 1)
  const familyPct = demographics.family_household_pct;
  if (familyPct != null) {
    const sensitivity = levelToNumber(profile.familyHouseholdSensitivity);
    // Low sensitivity: any family pct is fine (base 70). High: needs >55%
    const baseScore = sensitivity === 1 ? 70 : sensitivity === 2 ? 50 : 30;
    const familyScore = Math.min(100, baseScore + (familyPct / 100) * (100 - baseScore));
    total += Math.round(familyScore);
    weights += 1;
  }

  return weights > 0 ? Math.round(total / weights) : null;
}

// ── Local demand from POIs ────────────────────────────────────────────

/**
 * Score local demand based on nearby POI count and diversity.
 *
 * More POIs = more foot traffic drivers = higher demand.
 * Thresholds: 0–5 poor, 5–15 adequate, 15–30 good, 30+ excellent.
 *
 * @param {object} demandOutputs - From demand-generators stage outputs
 * @returns {number|null} 0–100
 */
export function scoreLocalDemand(demandOutputs) {
  if (!demandOutputs) return null;

  const total = demandOutputs.total_pois ?? 0;
  const cats = demandOutputs.category_summary ? Object.keys(demandOutputs.category_summary).length : 0;

  // POI count score (weight: 3)
  let poiScore;
  if (total >= 30) poiScore = 100;
  else if (total >= 15) poiScore = 70 + 30 * ((total - 15) / 15);
  else if (total >= 5) poiScore = 40 + 30 * ((total - 5) / 10);
  else poiScore = total * 8; // 0 → 0, 5 → 40

  // Category diversity score (weight: 1)
  let diversityScore;
  if (cats >= 6) diversityScore = 100;
  else if (cats >= 3) diversityScore = 60 + 40 * ((cats - 3) / 3);
  else diversityScore = cats * 30;

  return Math.round((poiScore * 3 + diversityScore) / 4);
}

// ── Competition scoring ───────────────────────────────────────────────

/**
 * Score competition for a specific category based on nearby POIs in the same
 * or similar categories.
 *
 * Higher score = less competition = better (for categories with low tolerance).
 * Categories with high competition tolerance get a floor.
 *
 * @param {object} demandOutputs - From demand-generators stage outputs
 * @param {CategoryProfile} profile
 * @param {string} categorySlug
 * @returns {number|null} 0–100
 */
export function scoreCompetition(demandOutputs, profile, categorySlug) {
  if (!demandOutputs?.category_summary) return null;

  const cats = demandOutputs.category_summary;
  const tolerance = levelToNumber(profile.competitionTolerance);

  // Count competing POIs: same-category entries
  // Map category slugs to POI category names (approximate)
  const slugToPoiCat = {
    quick_service_restaurant: "fast_food",
    fast_casual_restaurant: "restaurant",
    full_service_restaurant: "restaurant",
    coffee_shop: "cafe",
    bar_taproom: "bar",
    grocery_anchor: "supermarket",
    specialty_grocery: "marketplace",
    fitness_center: "fitness_centre",
    medical_clinic: "clinic",
    dental_practice: "dentist",
    veterinary_clinic: "veterinary",
    bank_branch: "bank",
    pharmacy: "pharmacy",
  };

  const poiCat = slugToPoiCat[categorySlug];
  let competitorCount = 0;
  if (poiCat && cats[poiCat]) {
    competitorCount = cats[poiCat].count || 0;
  }

  // Base score: fewer competitors = higher score
  let baseScore;
  if (competitorCount === 0) baseScore = 100;
  else if (competitorCount <= 2) baseScore = 75;
  else if (competitorCount <= 5) baseScore = 50;
  else baseScore = Math.max(10, 50 - (competitorCount - 5) * 5);

  // Adjust for tolerance: high-tolerance categories are less penalized
  // Tolerance 3 (high): floor at 50. Tolerance 1 (low): no floor.
  const floor = tolerance === 3 ? 50 : tolerance === 2 ? 30 : 0;
  return Math.max(floor, Math.round(baseScore));
}

// ── Tenant mix gap scoring ────────────────────────────────────────────

/**
 * Score how well a category fills a gap in the existing tenant mix.
 *
 * If the property already has tenants in this sector, the gap is smaller.
 * If no tenants exist in this sector, the gap (and opportunity) is larger.
 *
 * @param {object[]} existingTenants - Tenants on the property
 * @param {string} categorySector - The sector of the candidate category
 * @returns {number} 0–100
 */
export function scoreTenantMixGap(existingTenants, categorySector) {
  if (!existingTenants || existingTenants.length === 0) {
    return 70; // Empty property: moderate gap for anything
  }

  // Count how many existing tenants share the same sector
  // Tenants may have category_slug or category_id — use what's available
  const sameSector = existingTenants.filter((t) => {
    const slug = t.category_slug || t.tenant_categories?.slug || "";
    const sector = t.sector || t.tenant_categories?.sector || "";
    return sector === categorySector || slug.includes(categorySector);
  }).length;

  if (sameSector === 0) return 90; // No coverage in this sector — strong gap
  if (sameSector === 1) return 60; // Some coverage — moderate gap
  if (sameSector === 2) return 35; // Well-covered
  return 15; // Oversaturated
}

// ── Cotenancy synergy scoring ─────────────────────────────────────────

/**
 * Score cotenancy synergy: how well existing tenants complement the candidate.
 *
 * @param {object[]} existingTenants
 * @param {CategoryProfile} profile
 * @returns {number} 0–100
 */
export function scoreCotenancySynergy(existingTenants, profile) {
  if (!existingTenants || existingTenants.length === 0) return 50; // Neutral

  const prefs = profile.cotenancyPreferences || [];
  if (prefs.length === 0) return 60; // No preferences — mildly positive

  let matched = 0;
  for (const pref of prefs) {
    const found = existingTenants.some((t) => {
      const slug = t.category_slug || t.tenant_categories?.slug || "";
      const sector = t.sector || t.tenant_categories?.sector || "";
      return slug === pref || sector === pref;
    });
    if (found) matched++;
  }

  const ratio = matched / prefs.length;
  return Math.round(40 + ratio * 60); // 40 (no matches) to 100 (all matched)
}

// ── Data quality scoring ──────────────────────────────────────────────

/**
 * Score data quality based on pipeline stage completion.
 *
 * @param {object[]} stageResults - analysis_stage_results
 * @returns {number} 0–100
 */
export function scoreDataQuality(stageResults) {
  if (!stageResults || stageResults.length === 0) return 0;

  const ok = stageResults.filter((s) => s.status === "ok").length;
  const total = stageResults.length;

  return Math.round((ok / total) * 100);
}

// ── Composite evidence builder ────────────────────────────────────────

/**
 * Build a complete EvidenceInputs object for scoring a category.
 *
 * @param {object} params
 * @param {CategoryProfile} params.categoryProfile
 * @param {string} params.categorySlug
 * @param {Record<string, object>} params.stageOutputs - Keyed by stage name
 * @param {object[]} params.stageResults - analysis_stage_results
 * @param {object[]} params.existingTenants
 * @returns {import("../../src/domain/scoring/index.js").EvidenceInputs}
 */
export function buildEvidenceInputs({
  categoryProfile,
  categorySlug,
  stageOutputs,
  stageResults,
  existingTenants,
}) {
  const demographics = stageOutputs["demographics"]?.demographics || null;
  const demandOutputs = stageOutputs["demand-generators"] || null;

  return {
    localDemandScore: scoreLocalDemand(demandOutputs) ?? undefined,
    demographicAlignmentScore: scoreDemographicAlignment(demographics, categoryProfile) ?? undefined,
    trafficAlignmentScore: undefined, // No traffic data yet
    daypartAlignmentScore: undefined, // No daypart data yet
    competitionScore: scoreCompetition(demandOutputs, categoryProfile, categorySlug) ?? undefined,
    tenantMixGapScore: scoreTenantMixGap(existingTenants, categoryProfile.sector || ""),
    cotenancySynergyScore: scoreCotenancySynergy(existingTenants, categoryProfile),
    marketGrowthScore: undefined, // No growth data yet
    dataQualityScore: scoreDataQuality(stageResults),
  };
}
