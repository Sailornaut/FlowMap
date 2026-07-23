// @ts-check
/**
 * Taxonomy access + integrity helpers. Pure functions only — no I/O.
 * The DB `tenant_categories` / `category_profiles` tables are seeded from this
 * module; runtime code should prefer these helpers for in-process lookups.
 */
import {
  CATEGORIES,
  SECTORS,
  PHYSICAL_REQUIREMENTS,
  TAXONOMY_VERSION,
} from "./categories.js";

export { CATEGORIES, SECTORS, PHYSICAL_REQUIREMENTS, TAXONOMY_VERSION };

const bySlug = new Map(CATEGORIES.map((category) => [category.slug, category]));
const sectorSlugs = new Set(SECTORS.map((sector) => sector.slug));
const requirementTokens = new Set(PHYSICAL_REQUIREMENTS);

const LEVELS = new Set(["low", "medium", "high"]);
const DAYPARTS = new Set(["morning", "midday", "afternoon", "evening", "weekend"]);
const ORIENTATIONS = new Set(["destination", "convenience", "mixed"]);
const VISIT_FREQUENCIES = new Set(["daily", "weekly", "monthly", "occasional"]);

/**
 * @param {string} slug
 * @returns {import("./categories.js").Category | undefined}
 */
export function getCategory(slug) {
  return bySlug.get(slug);
}

/** @param {string} sectorSlug */
export function getCategoriesBySector(sectorSlug) {
  return CATEGORIES.filter((category) => category.sector === sectorSlug);
}

/**
 * Structural integrity check for the taxonomy definition. Returns a list of
 * human-readable problems; an empty list means the taxonomy is valid. Run in
 * tests and by the DB seed script before writing anything.
 * @returns {string[]}
 */
export function validateTaxonomy() {
  const problems = [];
  const seen = new Set();

  for (const category of CATEGORIES) {
    const where = `category "${category.slug}"`;

    if (seen.has(category.slug)) {
      problems.push(`duplicate slug: ${category.slug}`);
    }
    seen.add(category.slug);

    if (!sectorSlugs.has(category.sector)) {
      problems.push(`${where}: unknown sector "${category.sector}"`);
    }

    const p = category.profile;
    if (!p) {
      problems.push(`${where}: missing profile`);
      continue;
    }

    const [minSqft, maxSqft] = p.typicalSqftRange || [];
    if (!(Number.isFinite(minSqft) && Number.isFinite(maxSqft) && minSqft > 0 && maxSqft >= minSqft)) {
      problems.push(`${where}: invalid typicalSqftRange`);
    }

    if (!Array.isArray(p.preferredDayparts) || p.preferredDayparts.length === 0) {
      problems.push(`${where}: preferredDayparts must be a non-empty array`);
    } else {
      for (const daypart of p.preferredDayparts) {
        if (!DAYPARTS.has(daypart)) problems.push(`${where}: unknown daypart "${daypart}"`);
      }
    }

    if (!ORIENTATIONS.has(p.orientation)) {
      problems.push(`${where}: unknown orientation "${p.orientation}"`);
    }
    if (!VISIT_FREQUENCIES.has(p.visitFrequency)) {
      problems.push(`${where}: unknown visitFrequency "${p.visitFrequency}"`);
    }

    for (const [key, value] of Object.entries({
      parkingDemand: p.parkingDemand,
      visibilitySensitivity: p.visibilitySensitivity,
      incomeSensitivity: p.incomeSensitivity,
      daytimePopulationSensitivity: p.daytimePopulationSensitivity,
      residentialDensitySensitivity: p.residentialDensitySensitivity,
      familyHouseholdSensitivity: p.familyHouseholdSensitivity,
      competitionTolerance: p.competitionTolerance,
      rentTolerance: p.rentTolerance,
    })) {
      if (!LEVELS.has(value)) problems.push(`${where}: ${key} must be low|medium|high (got "${value}")`);
    }

    for (const preferred of p.cotenancyPreferences || []) {
      if (!bySlug.has(preferred) && !sectorSlugs.has(preferred)) {
        problems.push(`${where}: cotenancy preference "${preferred}" resolves to no category or sector`);
      }
    }

    for (const requirement of p.physicalRequirements || []) {
      if (!requirementTokens.has(requirement)) {
        problems.push(`${where}: unknown physical requirement "${requirement}"`);
      }
    }
  }

  return problems;
}

/**
 * True when a unit's square footage falls within (or near) a category's
 * typical range. `tolerance` widens the band — e.g. 0.15 accepts a unit 15%
 * below the minimum or above the maximum, reflecting that ranges are typical,
 * not absolute.
 * @param {string} categorySlug
 * @param {number} unitSqft
 * @param {{tolerance?: number}} [options]
 */
export function isSqftCompatible(categorySlug, unitSqft, { tolerance = 0.15 } = {}) {
  const category = bySlug.get(categorySlug);
  if (!category || !Number.isFinite(unitSqft) || unitSqft <= 0) return false;

  const [min, max] = category.profile.typicalSqftRange;
  return unitSqft >= min * (1 - tolerance) && unitSqft <= max * (1 + tolerance);
}
