// @ts-check
/**
 * Rent analysis rules — pure, deterministic safeguards.
 *
 * Two shapes only: `supported` (with range, basis, assumptions, confidence,
 * non-appraisal disclaimer) or `insufficient_data` (explicit statement +
 * what data would be needed). No third shape exists.
 *
 * The LLM never generates rent figures. This module validates analyst-entered
 * comparables and computes an indicated range with adjustments.
 */

export const RENT_MODULE_VERSION = "1.0.0";

export const DISCLAIMER_TEXT =
  "This rent analysis is for informational purposes only. It does not constitute " +
  "an appraisal, broker opinion of value (BOV), or legal advice. TrafficScout is " +
  "not a licensed appraiser. For formal valuation, consult a certified commercial " +
  "real estate appraiser.";

/** Minimum number of comparables required for a supported analysis. */
export const MIN_COMPARABLES = 2;

/** Maximum age in months for a comparable to be considered current. */
export const MAX_COMPARABLE_AGE_MONTHS = 24;

/**
 * @typedef {Object} Comparable
 * @property {number} rent_psf
 * @property {string} rent_basis          nnn|gross|modified_gross|unknown
 * @property {number} [sqft]
 * @property {string} [condition]
 * @property {string} [placement]
 * @property {boolean} [drive_through]
 * @property {string} [lease_date]        ISO date string
 * @property {boolean} [is_asking]        true = asking rent, false = executed lease
 * @property {string} [source_observation_id]
 */

/**
 * @typedef {Object} VacancyForRent
 * @property {number} [sqft]
 * @property {string} [condition]
 * @property {string} [placement]
 * @property {string} [rent_basis]
 */

/**
 * @typedef {Object} RentAnalysisResult
 * @property {"supported"|"insufficient_data"} status
 * @property {number|null} indicated_low_psf
 * @property {number|null} indicated_high_psf
 * @property {string|null} basis
 * @property {object[]} adjustments
 * @property {string[]} assumptions
 * @property {string} confidence
 * @property {string[]} limitations
 * @property {string} disclaimer_version
 * @property {string} module_version
 */

/**
 * Validate that a comparable has the minimum required fields.
 * @param {Comparable} comp
 * @returns {string[]} list of problems (empty = valid)
 */
export function validateComparable(comp) {
  const problems = [];
  if (!Number.isFinite(comp.rent_psf) || comp.rent_psf <= 0) {
    problems.push("rent_psf must be a positive number");
  }
  if (!comp.rent_basis || comp.rent_basis === "unknown") {
    problems.push("rent_basis is required (nnn, gross, or modified_gross)");
  }
  if (!comp.source_observation_id) {
    problems.push("source_observation_id is required — every comparable must have provenance");
  }
  return problems;
}

/**
 * Compute a rent analysis from provided comparables.
 * Returns `insufficient_data` if fewer than MIN_COMPARABLES valid comps.
 *
 * @param {Comparable[]} comparables
 * @param {VacancyForRent} vacancy
 * @returns {RentAnalysisResult}
 */
export function analyzeRent(comparables, vacancy) {
  // Validate all comparables
  const validComps = comparables.filter((c) => validateComparable(c).length === 0);
  const limitations = [];

  if (validComps.length < MIN_COMPARABLES) {
    return {
      status: "insufficient_data",
      indicated_low_psf: null,
      indicated_high_psf: null,
      basis: null,
      adjustments: [],
      assumptions: [
        `At least ${MIN_COMPARABLES} valid comparables are required.`,
        `${validComps.length} valid comparable(s) provided.`,
        "Collect additional lease comparables from nearby properties with similar characteristics.",
      ],
      confidence: "insufficient",
      limitations: ["Insufficient comparable data to support a rent estimate."],
      disclaimer_version: DISCLAIMER_TEXT,
      module_version: RENT_MODULE_VERSION,
    };
  }

  // Check for stale comparables
  const now = Date.now();
  const cutoff = MAX_COMPARABLE_AGE_MONTHS * 30 * 24 * 60 * 60 * 1000;
  const staleComps = validComps.filter((c) => {
    if (!c.lease_date) return false;
    return now - new Date(c.lease_date).getTime() > cutoff;
  });
  if (staleComps.length > 0) {
    limitations.push(`${staleComps.length} comparable(s) older than ${MAX_COMPARABLE_AGE_MONTHS} months`);
  }

  // Check for asking-only rents
  const askingOnly = validComps.filter((c) => c.is_asking);
  if (askingOnly.length === validComps.length) {
    limitations.push("All comparables are asking rents (no executed leases)");
  }

  // Compute basis normalization: try to standardize to vacancy's basis
  const targetBasis = vacancy.rent_basis || validComps[0].rent_basis;
  const adjustments = [];
  const assumptions = [];

  // Extract rents (PSF)
  const rents = validComps.map((c) => c.rent_psf);
  rents.sort((a, b) => a - b);

  // Trim outliers if we have enough comps (remove top/bottom if >= 5)
  let trimmedRents = rents;
  if (rents.length >= 5) {
    trimmedRents = rents.slice(1, -1);
    adjustments.push({
      type: "outlier_trim",
      description: "Removed highest and lowest comparables from range calculation",
    });
  }

  const low = trimmedRents[0];
  const high = trimmedRents[trimmedRents.length - 1];

  assumptions.push(`Range based on ${validComps.length} comparable(s)`);
  assumptions.push(`Basis: ${targetBasis}`);

  if (askingOnly.length > 0 && askingOnly.length < validComps.length) {
    assumptions.push(`Mix of asking rents (${askingOnly.length}) and executed leases (${validComps.length - askingOnly.length})`);
  }

  // Determine confidence
  let confidence = "moderate";
  if (validComps.length >= 5 && limitations.length === 0) {
    confidence = "high";
  } else if (validComps.length < 3 || limitations.length > 1) {
    confidence = "preliminary";
  }

  return {
    status: "supported",
    indicated_low_psf: Math.round(low * 100) / 100,
    indicated_high_psf: Math.round(high * 100) / 100,
    basis: targetBasis,
    adjustments,
    assumptions,
    confidence,
    limitations,
    disclaimer_version: DISCLAIMER_TEXT,
    module_version: RENT_MODULE_VERSION,
  };
}
