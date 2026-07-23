// @ts-check
/**
 * TrafficScout confidence framework — pure, deterministic, versioned.
 *
 * Every analysis stage, score, and report figure carries a confidence level
 * computed here. The report renderer uses these levels to label figures and to
 * decide when a section must render its "insufficient data" shape instead of a
 * number (rent analysis in particular).
 */

export const CONFIDENCE_MODEL_VERSION = "1.0.0";

/** Ordered from strongest to weakest. */
export const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MODERATE: "moderate",
  PRELIMINARY: "preliminary",
  INSUFFICIENT: "insufficient",
});

/**
 * Source reliability tiers (mirrors data_sources.reliability_tier):
 * 1 = authoritative (Census/ACS, DOT counts, recorded documents)
 * 2 = reputable third party (major POI providers, listing services)
 * 3 = self-reported / scraped (property websites, directories)
 * 4 = unverified (single informal observation)
 */

/**
 * @typedef {Object} ConfidenceInputs
 * @property {1|2|3|4} sourceReliabilityTier  Best tier among contributing sources.
 * @property {number} recencyMonths           Age of the most recent contributing data.
 * @property {number} corroboratingSources    Independent sources agreeing (>=1).
 * @property {"exact"|"parcel"|"tract"|"region"} geographicPrecision
 * @property {number} completeness            0–1 share of required inputs present.
 * @property {boolean} directlyMeasured       Measured fact vs modeled estimate.
 */

/**
 * @typedef {Object} ConfidenceResult
 * @property {string} level        One of CONFIDENCE_LEVELS values.
 * @property {number} score        0–100 supporting score (for sorting/inspection).
 * @property {string[]} factors    Human-readable reasons behind the level.
 * @property {string} modelVersion
 */

const PRECISION_POINTS = { exact: 20, parcel: 16, tract: 10, region: 4 };
const TIER_POINTS = { 1: 30, 2: 22, 3: 12, 4: 4 };

/**
 * Compute a confidence level from explicit, inspectable inputs.
 * Deterministic: same inputs → same output. No AI involvement.
 *
 * @param {ConfidenceInputs} inputs
 * @returns {ConfidenceResult}
 */
export function computeConfidence(inputs) {
  const factors = [];

  const tier = inputs.sourceReliabilityTier;
  const tierPoints = TIER_POINTS[tier] ?? 0;
  factors.push(
    tier === 1
      ? "authoritative source"
      : tier === 2
        ? "reputable third-party source"
        : tier === 3
          ? "self-reported or scraped source"
          : "unverified source"
  );

  const recency = Math.max(0, Number(inputs.recencyMonths));
  let recencyPoints;
  if (recency <= 6) {
    recencyPoints = 20;
    factors.push("data less than 6 months old");
  } else if (recency <= 18) {
    recencyPoints = 14;
    factors.push("data 6–18 months old");
  } else if (recency <= 36) {
    recencyPoints = 8;
    factors.push("data 1.5–3 years old");
  } else {
    recencyPoints = 2;
    factors.push("data more than 3 years old");
  }

  const corroboration = Math.max(1, Math.floor(inputs.corroboratingSources));
  const corroborationPoints = Math.min(10, (corroboration - 1) * 5);
  if (corroboration >= 3) factors.push("corroborated by 3+ independent sources");
  else if (corroboration === 2) factors.push("corroborated by a second source");
  else factors.push("single-source fact");

  const precisionPoints = PRECISION_POINTS[inputs.geographicPrecision] ?? 0;
  factors.push(`geographic precision: ${inputs.geographicPrecision}`);

  const completeness = clamp01(inputs.completeness);
  const completenessPoints = Math.round(completeness * 10);
  if (completeness < 0.5) factors.push("less than half of required inputs present");

  const measuredPoints = inputs.directlyMeasured ? 10 : 4;
  factors.push(inputs.directlyMeasured ? "directly measured" : "modeled estimate");

  const score =
    tierPoints + recencyPoints + corroborationPoints + precisionPoints + completenessPoints + measuredPoints;

  // Hard floors: some deficiencies cap the level regardless of total score.
  let level;
  if (completeness < 0.35 || tier === 4) {
    level = CONFIDENCE_LEVELS.INSUFFICIENT;
  } else if (score >= 75 && completeness >= 0.8 && tier <= 2) {
    level = CONFIDENCE_LEVELS.HIGH;
  } else if (score >= 55) {
    level = CONFIDENCE_LEVELS.MODERATE;
  } else if (score >= 35) {
    level = CONFIDENCE_LEVELS.PRELIMINARY;
  } else {
    level = CONFIDENCE_LEVELS.INSUFFICIENT;
  }

  return { level, score, factors, modelVersion: CONFIDENCE_MODEL_VERSION };
}

/**
 * Combine multiple confidence results into a conservative aggregate (a chain is
 * as strong as its weakest required link; optional links dilute the average).
 * @param {ConfidenceResult[]} results
 * @returns {ConfidenceResult}
 */
export function combineConfidence(results) {
  if (!results.length) {
    return {
      level: CONFIDENCE_LEVELS.INSUFFICIENT,
      score: 0,
      factors: ["no contributing inputs"],
      modelVersion: CONFIDENCE_MODEL_VERSION,
    };
  }

  /** @type {string[]} */
  const order = [
    CONFIDENCE_LEVELS.INSUFFICIENT,
    CONFIDENCE_LEVELS.PRELIMINARY,
    CONFIDENCE_LEVELS.MODERATE,
    CONFIDENCE_LEVELS.HIGH,
  ];
  const weakest = results.reduce((lowest, result) =>
    order.indexOf(result.level) < order.indexOf(lowest.level) ? result : lowest
  );
  const meanScore = Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length);

  return {
    level: weakest.level,
    score: Math.min(meanScore, weakest.score + 15),
    factors: [`weakest contributing input: ${weakest.level}`, ...weakest.factors.slice(0, 3)],
    modelVersion: CONFIDENCE_MODEL_VERSION,
  };
}

/** @param {number} value */
function clamp01(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
