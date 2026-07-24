// @ts-check
/**
 * TrafficScout Opportunity Scoring — pure, deterministic, versioned.
 *
 * Computes the Tenant Opportunity Score for a candidate tenant category
 * in a given vacancy/property context. The engine, not any LLM, determines
 * ranking. Every score is reproducible from the same inputs + methodology version.
 *
 * Score components are named, weighted, and individually inspectable.
 * Disqualifying constraints zero out a candidate regardless of total score.
 */

export const SCORING_VERSION = "1.0.0";

/**
 * @typedef {Object} ScoringComponent
 * @property {string} key           Named component (e.g., "demographic_alignment")
 * @property {number} raw           Raw component value (domain-specific scale)
 * @property {number} normalized    0–100 normalized value
 * @property {number} weight        Weight for this component (from methodology)
 * @property {string} [explanation] Human-readable explanation
 * @property {string[]} [inputRefs] Source observation IDs or stage result paths
 */

/**
 * @typedef {Object} ScoringResult
 * @property {number} overall                 Weighted composite score 0–100
 * @property {ScoringComponent[]} components  Individual component breakdowns
 * @property {string[]} positiveFactors       Top contributing factors
 * @property {string[]} negativeFactors       Detractors
 * @property {string[]} disqualifiers         Hard constraint failures (empty if none)
 * @property {string} confidence              Confidence level of the score
 * @property {number} completeness            0–1 share of inputs available
 * @property {string} methodologyVersion      Version of weights/rules used
 * @property {string} scoringVersion          Version of scoring engine
 */

/**
 * Default component weights. In production these come from methodology_versions.weights.
 * Normalized to sum 1.0.
 */
export const DEFAULT_WEIGHTS = Object.freeze({
  local_demand: 0.10,
  demographic_alignment: 0.10,
  traffic_alignment: 0.08,
  daypart_alignment: 0.06,
  competition: 0.10,
  tenant_mix_gap: 0.10,
  cotenancy_synergy: 0.06,
  unit_size_fit: 0.08,
  physical_fit: 0.08,
  visibility: 0.04,
  access: 0.04,
  parking: 0.04,
  market_growth: 0.04,
  rent_feasibility: 0.04,
  data_quality: 0.04,
});

/** All recognized component keys. */
export const COMPONENT_KEYS = Object.freeze(Object.keys(DEFAULT_WEIGHTS));

/**
 * @typedef {Object} CategoryProfile
 * @property {[number, number]} typicalSqftRange
 * @property {string[]} preferredDayparts
 * @property {string} orientation
 * @property {string} parkingDemand
 * @property {string} visibilitySensitivity
 * @property {string} incomeSensitivity
 * @property {string} daytimePopulationSensitivity
 * @property {string} residentialDensitySensitivity
 * @property {string} familyHouseholdSensitivity
 * @property {string} competitionTolerance
 * @property {string[]} cotenancyPreferences
 * @property {string[]} physicalRequirements
 * @property {string} rentTolerance
 * @property {string} visitFrequency
 */

/**
 * @typedef {Object} VacancyContext
 * @property {number} [sqft]
 * @property {string} [placement]
 * @property {string} [condition]
 * @property {string} [venting_possible]    yes|no|unknown
 * @property {string} [grease_trap]         yes|no|unknown
 * @property {string} [drive_through]       yes|no|possible|unknown
 * @property {string} [patio_possible]      yes|no|unknown
 * @property {number} [asking_rent_psf]
 */

/**
 * @typedef {Object} EvidenceInputs
 * @property {number} [localDemandScore]          0–100 from pipeline
 * @property {number} [demographicAlignmentScore] 0–100
 * @property {number} [trafficAlignmentScore]     0–100
 * @property {number} [daypartAlignmentScore]     0–100
 * @property {number} [competitionScore]          0–100 (higher = less competition = better)
 * @property {number} [tenantMixGapScore]         0–100
 * @property {number} [cotenancySynergyScore]     0–100
 * @property {number} [marketGrowthScore]         0–100
 * @property {number} [dataQualityScore]          0–100
 */

/**
 * Check physical-constraint disqualifiers.
 * Returns an array of disqualifier descriptions (empty = no disqualification).
 *
 * @param {CategoryProfile} profile
 * @param {VacancyContext} vacancy
 * @returns {string[]}
 */
export function checkDisqualifiers(profile, vacancy) {
  const disqualifiers = [];

  for (const req of profile.physicalRequirements || []) {
    if (req === "venting" && vacancy.venting_possible === "no") {
      disqualifiers.push("Venting required but not available");
    }
    if (req === "grease_trap" && vacancy.grease_trap === "no") {
      disqualifiers.push("Grease trap required but not available");
    }
    if (req === "drive_through" && vacancy.drive_through === "no") {
      disqualifiers.push("Drive-through required but not available");
    }
    if (req === "outdoor_seating" && vacancy.patio_possible === "no") {
      disqualifiers.push("Outdoor seating required but not possible");
    }
  }

  return disqualifiers;
}

/**
 * Compute unit-size fit score. 100 = perfect fit; degrades with distance from
 * the category's typical range.
 *
 * @param {CategoryProfile} profile
 * @param {VacancyContext} vacancy
 * @returns {{ normalized: number, explanation: string }}
 */
export function computeUnitSizeFit(profile, vacancy) {
  if (!vacancy.sqft || !profile.typicalSqftRange) {
    return { normalized: 50, explanation: "Unit size unknown — neutral score" };
  }

  const [min, max] = profile.typicalSqftRange;
  const sqft = vacancy.sqft;

  if (sqft >= min && sqft <= max) {
    return { normalized: 100, explanation: `${sqft} sqft within typical ${min}–${max} range` };
  }

  // Proportional degradation outside range
  const distance = sqft < min ? (min - sqft) / min : (sqft - max) / max;
  const score = Math.max(0, Math.round(100 * (1 - distance)));

  const dir = sqft < min ? "below" : "above";
  return {
    normalized: score,
    explanation: `${sqft} sqft ${dir} typical ${min}–${max} range (${Math.round(distance * 100)}% outside)`,
  };
}

/**
 * Compute physical-fit score from vacancy constraints. Unknown values lower
 * confidence but don't penalize the score as harshly as definite "no".
 *
 * @param {CategoryProfile} profile
 * @param {VacancyContext} vacancy
 * @returns {{ normalized: number, explanation: string, unknowns: string[] }}
 */
export function computePhysicalFit(profile, vacancy) {
  const reqs = profile.physicalRequirements || [];
  if (reqs.length === 0) {
    return { normalized: 100, explanation: "No special physical requirements", unknowns: [] };
  }

  let met = 0;
  let total = reqs.length;
  const unknowns = [];

  for (const req of reqs) {
    const field = {
      venting: vacancy.venting_possible,
      grease_trap: vacancy.grease_trap,
      drive_through: vacancy.drive_through,
      outdoor_seating: vacancy.patio_possible,
    }[req];

    if (field === "yes" || field === "possible") {
      met++;
    } else if (field === "unknown" || field === undefined) {
      met += 0.5; // Unknown doesn't penalize fully but lowers score
      unknowns.push(req);
    }
    // "no" adds nothing
  }

  const normalized = Math.round((met / total) * 100);
  return {
    normalized,
    explanation: `${met}/${total} physical requirements met or possible`,
    unknowns,
  };
}

/**
 * Score a candidate tenant category for a specific vacancy/property context.
 *
 * @param {object} params
 * @param {CategoryProfile} params.categoryProfile
 * @param {VacancyContext} params.vacancy
 * @param {EvidenceInputs} params.evidence
 * @param {Record<string, number>} [params.weights] Override weights (default: DEFAULT_WEIGHTS)
 * @param {string} [params.methodologyVersion]
 * @returns {ScoringResult}
 */
export function scoreCandidate({ categoryProfile, vacancy, evidence, weights, methodologyVersion }) {
  const w = weights || DEFAULT_WEIGHTS;
  const mv = methodologyVersion || "default";

  // Check disqualifiers first
  const disqualifiers = checkDisqualifiers(categoryProfile, vacancy);
  if (disqualifiers.length > 0) {
    return {
      overall: 0,
      components: [],
      positiveFactors: [],
      negativeFactors: disqualifiers,
      disqualifiers,
      confidence: "high", // We're confident it's disqualified
      completeness: 1,
      methodologyVersion: mv,
      scoringVersion: SCORING_VERSION,
    };
  }

  // Compute each component
  const unitSize = computeUnitSizeFit(categoryProfile, vacancy);
  const physicalFit = computePhysicalFit(categoryProfile, vacancy);

  /** @type {ScoringComponent[]} */
  const components = [
    { key: "local_demand", raw: evidence.localDemandScore ?? -1, normalized: evidence.localDemandScore ?? 50, weight: w.local_demand || 0 },
    { key: "demographic_alignment", raw: evidence.demographicAlignmentScore ?? -1, normalized: evidence.demographicAlignmentScore ?? 50, weight: w.demographic_alignment || 0 },
    { key: "traffic_alignment", raw: evidence.trafficAlignmentScore ?? -1, normalized: evidence.trafficAlignmentScore ?? 50, weight: w.traffic_alignment || 0 },
    { key: "daypart_alignment", raw: evidence.daypartAlignmentScore ?? -1, normalized: evidence.daypartAlignmentScore ?? 50, weight: w.daypart_alignment || 0 },
    { key: "competition", raw: evidence.competitionScore ?? -1, normalized: evidence.competitionScore ?? 50, weight: w.competition || 0 },
    { key: "tenant_mix_gap", raw: evidence.tenantMixGapScore ?? -1, normalized: evidence.tenantMixGapScore ?? 50, weight: w.tenant_mix_gap || 0 },
    { key: "cotenancy_synergy", raw: evidence.cotenancySynergyScore ?? -1, normalized: evidence.cotenancySynergyScore ?? 50, weight: w.cotenancy_synergy || 0 },
    { key: "unit_size_fit", raw: vacancy.sqft ?? -1, normalized: unitSize.normalized, weight: w.unit_size_fit || 0, explanation: unitSize.explanation },
    { key: "physical_fit", raw: physicalFit.normalized, normalized: physicalFit.normalized, weight: w.physical_fit || 0, explanation: physicalFit.explanation },
    { key: "visibility", raw: -1, normalized: 50, weight: w.visibility || 0, explanation: "Default — awaiting pipeline data" },
    { key: "access", raw: -1, normalized: 50, weight: w.access || 0, explanation: "Default — awaiting pipeline data" },
    { key: "parking", raw: -1, normalized: 50, weight: w.parking || 0, explanation: "Default — awaiting pipeline data" },
    { key: "market_growth", raw: evidence.marketGrowthScore ?? -1, normalized: evidence.marketGrowthScore ?? 50, weight: w.market_growth || 0 },
    { key: "rent_feasibility", raw: -1, normalized: 50, weight: w.rent_feasibility || 0, explanation: "Default — awaiting rent comp data" },
    { key: "data_quality", raw: evidence.dataQualityScore ?? -1, normalized: evidence.dataQualityScore ?? 50, weight: w.data_quality || 0 },
  ];

  // Weighted composite
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const overall = totalWeight > 0
    ? Math.round(components.reduce((sum, c) => sum + c.normalized * c.weight, 0) / totalWeight)
    : 0;

  // Determine completeness: how many components have real data (raw !== -1)
  const withData = components.filter((c) => c.raw !== -1).length;
  const completeness = withData / components.length;

  // Identify positive and negative factors
  const positiveFactors = components
    .filter((c) => c.normalized >= 70 && c.raw !== -1)
    .sort((a, b) => b.normalized - a.normalized)
    .slice(0, 5)
    .map((c) => c.explanation || `${c.key}: ${c.normalized}/100`);

  const negativeFactors = components
    .filter((c) => c.normalized < 40 && c.raw !== -1)
    .sort((a, b) => a.normalized - b.normalized)
    .slice(0, 5)
    .map((c) => c.explanation || `${c.key}: ${c.normalized}/100`);

  // Confidence from completeness
  let confidence;
  if (completeness >= 0.8) confidence = "high";
  else if (completeness >= 0.5) confidence = "moderate";
  else if (completeness >= 0.3) confidence = "preliminary";
  else confidence = "insufficient";

  return {
    overall,
    components,
    positiveFactors,
    negativeFactors,
    disqualifiers: [],
    confidence,
    completeness,
    methodologyVersion: mv,
    scoringVersion: SCORING_VERSION,
  };
}

/**
 * Rank multiple candidates by overall score (descending).
 * @param {ScoringResult[]} results
 * @returns {ScoringResult[]}
 */
export function rankCandidates(results) {
  return [...results].sort((a, b) => b.overall - a.overall);
}
