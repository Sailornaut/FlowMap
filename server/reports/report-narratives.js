// @ts-check
/**
 * Deterministic report narrative engine.
 *
 * Generates CRE-analyst-quality text from pipeline data.
 * Every sentence is derived from deterministic evidence — never fabricated.
 *
 * This module is the bridge between raw pipeline outputs and
 * human-readable analysis narrative. It answers:
 *   - What does the site rating mean?
 *   - Why was each category recommended?
 *   - How do local metrics compare to benchmarks?
 *   - What remains uncertain?
 *   - What data would increase confidence?
 */

import { COMPONENT_KEYS, DEFAULT_WEIGHTS } from "../../src/domain/scoring/index.js";

// ── Benchmarks (documented, sourced, static) ────────────────────────
// These are published reference values, not fabricated.
// Sources: U.S. Census Bureau ACS 2023, BLS, USDA.

export const NATIONAL_BENCHMARKS = Object.freeze({
  median_household_income: { value: 80610, label: "U.S. Median", source: "Census ACS 2023" },
  median_age: { value: 38.9, label: "U.S. Median", source: "Census ACS 2023" },
  total_population_tract_median: { value: 4000, label: "Typical Census Tract", source: "Census Bureau" },
});

// State-level median household income (Census ACS 2023, rounded)
export const STATE_INCOME_BENCHMARKS = Object.freeze({
  AL: 59610, AK: 86370, AZ: 72580, AR: 56340, CA: 91550,
  CO: 87470, CT: 90730, DE: 79550, FL: 67920, GA: 66560,
  HI: 94460, ID: 70440, IL: 78320, IN: 67170, IA: 72320,
  KS: 69950, KY: 57600, LA: 55970, ME: 69540, MD: 98460,
  MA: 96500, MI: 66980, MN: 84320, MS: 50560, MO: 65920,
  MT: 66340, NE: 73640, NV: 69360, NH: 90940, NJ: 97130,
  NM: 58440, NY: 78940, NC: 64400, ND: 73590, OH: 64020,
  OK: 59710, OR: 76360, PA: 73170, RI: 78870, SC: 63620,
  SD: 66920, TN: 63120, TX: 73030, UT: 86830, VT: 72430,
  VA: 87250, WA: 91310, WV: 52520, WI: 72460, WY: 72490,
  DC: 106070,
});

// ── Site Rating ─────────────────────────────────────────────────────

/**
 * Compute an overall site rating from deterministic evidence.
 *
 * Inputs:
 * - overallConfidence from manifest
 * - stage completion ratio
 * - demographic indicators (income, population)
 * - demand generator count
 * - top candidate score
 *
 * Rating scale (all thresholds documented):
 *   90+ → "Excellent Opportunity"
 *   75–89 → "Strong Candidate"
 *   60–74 → "Promising with Reservations"
 *   45–59 → "Mixed Opportunity"
 *   30–44 → "Limited Opportunity"
 *   <30  → "Unsuitable"
 *
 * @param {object} params
 * @returns {{ rating: string, score: number, factors: string[] }}
 */
export function computeSiteRating({
  stageOutputs,
  candidates,
  manifest,
  stageResults,
}) {
  let score = 0;
  let maxScore = 0;
  const factors = [];

  // 1. Pipeline completion (max 15 points)
  maxScore += 15;
  const stages = stageResults || [];
  const okCount = stages.filter((s) => s.status === "ok").length;
  const stageRatio = stages.length > 0 ? okCount / stages.length : 0;
  const pipelinePoints = Math.round(stageRatio * 15);
  score += pipelinePoints;
  if (stageRatio >= 1) factors.push("All pipeline stages completed successfully");
  else if (stageRatio >= 0.8) factors.push(`${okCount} of ${stages.length} pipeline stages completed`);

  // 2. Demographic strength (max 25 points)
  maxScore += 25;
  const demo = stageOutputs?.demographics?.demographics;
  if (demo) {
    const income = demo.median_household_income;
    const pop = demo.total_population;
    let demoPoints = 0;

    if (income != null) {
      if (income >= 120000) demoPoints += 15;
      else if (income >= 80000) demoPoints += 12;
      else if (income >= 60000) demoPoints += 8;
      else if (income >= 40000) demoPoints += 5;
      else demoPoints += 2;
    }

    if (pop != null) {
      if (pop >= 10000) demoPoints += 10;
      else if (pop >= 5000) demoPoints += 8;
      else if (pop >= 2000) demoPoints += 5;
      else demoPoints += 2;
    }

    score += Math.min(25, demoPoints);
    if (income >= 80000) factors.push("Above-average household income");
    if (pop >= 5000) factors.push("Strong local population base");
  }

  // 3. Demand generator density (max 20 points)
  maxScore += 20;
  const dg = stageOutputs?.["demand-generators"];
  if (dg) {
    const total = dg.total_pois || 0;
    const cats = dg.category_summary ? Object.keys(dg.category_summary).length : 0;

    let dgPoints = 0;
    if (total >= 50) dgPoints += 14;
    else if (total >= 30) dgPoints += 11;
    else if (total >= 15) dgPoints += 8;
    else if (total >= 5) dgPoints += 4;

    if (cats >= 7) dgPoints += 6;
    else if (cats >= 4) dgPoints += 4;
    else if (cats >= 2) dgPoints += 2;

    score += Math.min(20, dgPoints);
    if (total >= 30) factors.push("Dense demand-generator environment");
    if (cats >= 6) factors.push("Diverse mix of nearby traffic drivers");
  }

  // 4. Trade area quality (max 10 points)
  maxScore += 10;
  const ta = stageOutputs?.["trade-area"];
  if (ta?.isochrones?.length >= 3) {
    score += 10;
    factors.push("Complete drive-time trade area defined");
  } else if (ta?.isochrones?.length > 0) {
    score += 6;
  }

  // 5. Top candidate quality (max 20 points)
  maxScore += 20;
  const recommended = (candidates || []).filter((c) => c.verdict === "recommend");
  if (recommended.length > 0) {
    const topScore = recommended[0]?.opportunity_scores?.overall ?? 0;
    if (topScore >= 80) { score += 20; factors.push("Strong top-candidate scores"); }
    else if (topScore >= 65) { score += 15; factors.push("Solid top-candidate scores"); }
    else if (topScore >= 50) score += 10;
    else score += 5;

    if (recommended.length >= 10) factors.push(`${recommended.length} viable tenant categories identified`);
  }

  // 6. Data quality / confidence (max 10 points)
  maxScore += 10;
  const conf = manifest?.overall_confidence;
  if (conf === "high") { score += 10; factors.push("High overall data confidence"); }
  else if (conf === "moderate") score += 7;
  else if (conf === "preliminary") score += 3;

  // Normalize to 0–100
  const normalized = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  let rating;
  if (normalized >= 90) rating = "Excellent Opportunity";
  else if (normalized >= 75) rating = "Strong Candidate";
  else if (normalized >= 60) rating = "Promising with Reservations";
  else if (normalized >= 45) rating = "Mixed Opportunity";
  else if (normalized >= 30) rating = "Limited Opportunity";
  else rating = "Unsuitable";

  return { rating, score: normalized, factors };
}

// ── Executive Summary Narrative ─────────────────────────────────────

/**
 * Generate a one-paragraph executive summary from evidence.
 *
 * @param {object} params
 * @returns {string}
 */
export function generateExecutiveNarrative({
  stageOutputs,
  candidates,
  siteRating,
  stageResults,
}) {
  const parts = [];
  const demo = stageOutputs?.demographics?.demographics;
  const dg = stageOutputs?.["demand-generators"];
  const ta = stageOutputs?.["trade-area"];
  const recommended = (candidates || []).filter((c) => c.verdict === "recommend");
  const stages = stageResults || [];
  const okCount = stages.filter((s) => s.status === "ok").length;

  // Opening sentence based on overall assessment
  if (siteRating.score >= 75) {
    parts.push("This property demonstrates strong market fundamentals across multiple indicators.");
  } else if (siteRating.score >= 60) {
    parts.push("This property shows promising market characteristics with some areas requiring further investigation.");
  } else if (siteRating.score >= 45) {
    parts.push("This property presents a mixed opportunity profile with both favorable and unfavorable indicators.");
  } else {
    parts.push("Current evidence suggests limited opportunity at this location based on available data.");
  }

  // Income context
  if (demo?.median_household_income != null) {
    const income = demo.median_household_income;
    const natl = NATIONAL_BENCHMARKS.median_household_income.value;
    if (income >= natl * 2) {
      parts.push(`Household income ($${income.toLocaleString()}) is significantly above national averages, indicating strong purchasing power for premium retail and services.`);
    } else if (income >= natl * 1.2) {
      parts.push(`Above-average household income ($${income.toLocaleString()}) supports a range of retail and service categories.`);
    } else if (income >= natl * 0.8) {
      parts.push(`Household income ($${income.toLocaleString()}) is near the national median, supporting value-oriented and convenience retail.`);
    } else {
      parts.push(`Below-average household income ($${income.toLocaleString()}) may limit the tenant categories viable at this location.`);
    }
  }

  // Population and demand context
  if (demo?.total_population != null && dg?.total_pois != null) {
    const pop = demo.total_population;
    const pois = dg.total_pois;
    if (pop >= 5000 && pois >= 30) {
      parts.push(`A strong residential base (${pop.toLocaleString()} tract population) combined with ${pois} nearby demand generators creates a favorable traffic environment.`);
    } else if (pop >= 5000) {
      parts.push(`The tract population of ${pop.toLocaleString()} provides a solid local customer base.`);
    } else if (pois >= 30) {
      parts.push(`While tract population is modest (${pop.toLocaleString()}), the presence of ${pois} nearby demand generators suggests adequate foot traffic.`);
    }
  }

  // Recommendations summary
  if (recommended.length > 0) {
    const topNames = recommended.slice(0, 3).map((c) => c.tenant_categories?.name).filter(Boolean);
    if (topNames.length > 0) {
      parts.push(`Current evidence suggests strong potential for ${topNames.join(", ")}${recommended.length > 3 ? `, and ${recommended.length - 3} additional categories` : ""}.`);
    }
  }

  // Uncertainty acknowledgment
  const missingData = identifyDataGaps(stageOutputs, stageResults);
  if (missingData.length > 0) {
    const topGaps = missingData.slice(0, 2).map((g) => g.label.toLowerCase());
    parts.push(`Remaining uncertainty is primarily due to ${topGaps.join(" and ")}.`);
  }

  return parts.join(" ");
}

// ── Candidate Evidence Explanation ──────────────────────────────────

/**
 * Pretty-print a component key.
 * @param {string} key
 * @returns {string}
 */
function formatComponentKey(key) {
  const labels = {
    local_demand: "Local Demand",
    demographic_alignment: "Demographic Fit",
    traffic_alignment: "Traffic Patterns",
    daypart_alignment: "Daypart Match",
    competition: "Competition",
    tenant_mix_gap: "Tenant Mix Gap",
    cotenancy_synergy: "Cotenancy Synergy",
    unit_size_fit: "Unit Size Fit",
    physical_fit: "Physical Fit",
    visibility: "Visibility",
    access: "Accessibility",
    parking: "Parking",
    market_growth: "Market Growth",
    rent_feasibility: "Rent Feasibility",
    data_quality: "Data Quality",
  };
  return labels[key] || key.replace(/_/g, " ");
}

/**
 * Generate supporting-evidence and concern bullets for a candidate.
 * Maps directly from score components — never invents reasons.
 *
 * @param {object} candidate - business_candidate with nested opportunity_scores.score_components
 * @param {object} [stageOutputs] - for additional context
 * @returns {{ supporting: string[], concerns: string[], breakdown: Array<{label: string, score: number, maxScore: number, explanation: string|null}> }}
 */
export function explainCandidate(candidate, stageOutputs) {
  const scores = candidate.opportunity_scores;
  if (!scores) return { supporting: [], concerns: [], breakdown: [] };

  const components = scores.score_components || [];
  const supporting = [];
  const concerns = [];

  // Build breakdown from components
  const breakdown = components
    .filter((c) => c.component_key)
    .map((c) => {
      const weight = c.weight ?? DEFAULT_WEIGHTS[c.component_key] ?? 0;
      const maxPoints = Math.round(weight * 100);
      const earnedPoints = Math.round((c.normalized / 100) * maxPoints);
      return {
        label: formatComponentKey(c.component_key),
        score: earnedPoints,
        maxScore: maxPoints,
        normalized: c.normalized,
        weight,
        explanation: c.explanation || null,
        key: c.component_key,
      };
    })
    .sort((a, b) => b.maxScore - a.maxScore); // Sort by weight importance

  // Generate evidence bullets from real component data
  for (const comp of breakdown) {
    if (comp.normalized >= 70 && comp.key !== "data_quality") {
      const bullet = generateEvidenceBullet(comp, "positive", stageOutputs);
      if (bullet) supporting.push(bullet);
    } else if (comp.normalized < 40 && comp.key !== "data_quality") {
      const bullet = generateEvidenceBullet(comp, "negative", stageOutputs);
      if (bullet) concerns.push(bullet);
    }
  }

  // Add concerns for defaulted components (awaiting data)
  const defaulted = components.filter(
    (c) => c.explanation?.startsWith("Default") && c.component_key !== "data_quality"
  );
  if (defaulted.length > 0) {
    concerns.push(`${defaulted.length} scoring component${defaulted.length > 1 ? "s" : ""} awaiting additional data (scored at neutral)`);
  }

  return { supporting, concerns, breakdown };
}

/**
 * Generate a human-readable evidence bullet from a scoring component.
 *
 * @param {object} comp - Breakdown component
 * @param {"positive"|"negative"} polarity
 * @param {object} [stageOutputs]
 * @returns {string|null}
 */
function generateEvidenceBullet(comp, polarity, stageOutputs) {
  const demo = stageOutputs?.demographics?.demographics;
  const dg = stageOutputs?.["demand-generators"];

  // Use explanation if available and meaningful
  if (comp.explanation && !comp.explanation.startsWith("Default")) {
    return comp.explanation;
  }

  // Generate context-aware bullets based on component type
  switch (comp.key) {
    case "local_demand":
      if (polarity === "positive") {
        const total = dg?.total_pois || 0;
        return total > 0
          ? `Strong local demand supported by ${total} nearby traffic generators`
          : "Local demand indicators favorable";
      }
      return "Limited nearby demand generators";

    case "demographic_alignment":
      if (polarity === "positive") {
        const income = demo?.median_household_income;
        return income
          ? `Household income ($${income.toLocaleString()}) supports this category's target market`
          : "Demographic profile aligns with category requirements";
      }
      return "Demographic profile does not strongly align with this category";

    case "competition":
      if (polarity === "positive") return "Limited direct competition identified in the trade area";
      return "Competitive density may limit market share";

    case "tenant_mix_gap":
      if (polarity === "positive") return "Fills an unserved category gap in the current tenant mix";
      return "Category already represented in the tenant mix";

    case "cotenancy_synergy":
      if (polarity === "positive") return "Complementary tenants present for cross-shopping traffic";
      return "Limited cotenancy synergy with current tenants";

    case "unit_size_fit":
      return comp.explanation || (polarity === "positive" ? "Unit size within typical range" : "Unit size outside typical range");

    case "physical_fit":
      return comp.explanation || (polarity === "positive" ? "Physical requirements satisfied" : "Physical requirements may not be met");

    case "visibility":
      return polarity === "positive" ? "Adequate visibility for this category" : "Visibility may be insufficient for this category";

    case "parking":
      return polarity === "positive" ? "Parking adequate for expected demand" : "Parking may be insufficient for expected demand";

    default:
      return `${comp.label}: ${comp.normalized}/100`;
  }
}

// ── Metric Interpretation ───────────────────────────────────────────

/**
 * Generate "so what?" interpretations for demographic metrics.
 *
 * @param {object} demographics
 * @param {string} [propertyState] - Two-letter state code
 * @returns {Array<{metric: string, value: string, interpretation: string, benchmarks: Array<{label: string, value: string}>}>}
 */
export function interpretDemographics(demographics, propertyState) {
  if (!demographics) return [];
  const items = [];

  // Median household income
  const income = demographics.median_household_income;
  if (income != null) {
    const natl = NATIONAL_BENCHMARKS.median_household_income.value;
    const benchmarks = [
      { label: "U.S. Median", value: `$${natl.toLocaleString()}` },
    ];

    const stateIncome = propertyState ? STATE_INCOME_BENCHMARKS[propertyState.toUpperCase()] : null;
    if (stateIncome) {
      benchmarks.push({ label: `${propertyState.toUpperCase()} Median`, value: `$${stateIncome.toLocaleString()}` });
    }

    let interpretation;
    const ratio = income / natl;
    if (ratio >= 2.5) interpretation = "Significantly above national averages. This level of household income supports premium retail, specialty dining, and professional services.";
    else if (ratio >= 1.5) interpretation = "Well above national averages, indicating strong purchasing power for discretionary retail and services.";
    else if (ratio >= 1.1) interpretation = "Above the national median. Supports a broad range of retail categories including moderate-upscale options.";
    else if (ratio >= 0.9) interpretation = "Near the national median. Supports value-oriented and convenience-focused retail.";
    else if (ratio >= 0.7) interpretation = "Below the national median. May favor discount retail, dollar stores, and essential services.";
    else interpretation = "Significantly below the national median. Retail viability may be limited to essential services.";

    items.push({
      metric: "Median Household Income",
      value: `$${income.toLocaleString()}`,
      interpretation,
      benchmarks,
    });
  }

  // Total population
  const pop = demographics.total_population;
  if (pop != null) {
    const typicalTract = NATIONAL_BENCHMARKS.total_population_tract_median.value;
    let interpretation;
    if (pop >= 15000) interpretation = "Very high tract population, indicating a dense customer base within walking and short-drive distance.";
    else if (pop >= 8000) interpretation = "Above-average tract population, providing a strong local customer base for neighborhood-serving retail.";
    else if (pop >= 4000) interpretation = "Moderate tract population. Sufficient for convenience retail; destination uses may need to draw from a wider trade area.";
    else if (pop >= 2000) interpretation = "Below-average tract population. Retail success will depend on drawing customers from beyond the immediate area.";
    else interpretation = "Low tract population. Location likely requires strong destination draw or pass-by traffic to support retail.";

    items.push({
      metric: "Tract Population",
      value: pop.toLocaleString(),
      interpretation,
      benchmarks: [{ label: "Typical Census Tract", value: typicalTract.toLocaleString() }],
    });
  }

  // Median age
  const age = demographics.median_age;
  if (age != null) {
    const natlAge = NATIONAL_BENCHMARKS.median_age.value;
    let interpretation;
    if (age < 30) interpretation = "Younger-than-average population. Favors fast-casual dining, fitness, entertainment, and tech-forward retail.";
    else if (age < 35) interpretation = "Young adult population. Supports a mix of dining, fitness, and convenience-oriented services.";
    else if (age < 42) interpretation = "Near the national median age. Supports a broad range of retail and service categories.";
    else if (age < 55) interpretation = "Mature population. May favor healthcare, professional services, and full-service dining.";
    else interpretation = "Older population. Favors healthcare, pharmacy, and essential services.";

    items.push({
      metric: "Median Age",
      value: age.toString(),
      interpretation,
      benchmarks: [{ label: "U.S. Median", value: natlAge.toString() }],
    });
  }

  // Household composition
  const familyHH = demographics.family_households;
  const totalHH = demographics.total_households;
  if (familyHH != null && totalHH != null && totalHH > 0) {
    const pct = (familyHH / totalHH) * 100;
    let interpretation;
    if (pct >= 75) interpretation = `Family households comprise ${pct.toFixed(0)}% of nearby households, strongly favoring childcare, tutoring, family dining, and convenience retail.`;
    else if (pct >= 60) interpretation = `Family households at ${pct.toFixed(0)}% indicate a family-oriented community. Supports education, youth activities, and family-friendly services.`;
    else if (pct >= 40) interpretation = `Balanced household mix (${pct.toFixed(0)}% family). Supports both family-oriented and individual-focused retail.`;
    else interpretation = `Non-family households dominate (${pct.toFixed(0)}% family), favoring convenience services, dining, and entertainment over family-oriented uses.`;

    items.push({
      metric: "Family Households",
      value: `${pct.toFixed(0)}%`,
      interpretation,
      benchmarks: [],
    });
  }

  // Homeownership
  const ownerOcc = demographics.owner_occupied;
  const renterOcc = demographics.renter_occupied;
  if (ownerOcc != null && renterOcc != null) {
    const total = ownerOcc + renterOcc;
    if (total > 0) {
      const ownerPct = (ownerOcc / total) * 100;
      let interpretation;
      if (ownerPct >= 80) interpretation = `Very high homeownership (${ownerPct.toFixed(0)}%) suggests a stable, long-term customer base with higher discretionary spending.`;
      else if (ownerPct >= 65) interpretation = `Above-average homeownership (${ownerPct.toFixed(0)}%) indicates residential stability and consistent local demand.`;
      else if (ownerPct >= 45) interpretation = `Mixed tenure (${ownerPct.toFixed(0)}% owner-occupied) suggests moderate population turnover.`;
      else interpretation = `Renter-dominated area (${ownerPct.toFixed(0)}% owner-occupied) may experience higher population turnover, favoring convenience-oriented tenants.`;

      items.push({
        metric: "Homeownership Rate",
        value: `${ownerPct.toFixed(0)}%`,
        interpretation,
        benchmarks: [{ label: "U.S. Average", value: "66%" }],
      });
    }
  }

  return items;
}

// ── Confidence Explanation ──────────────────────────────────────────

/**
 * Generate a structured confidence explanation.
 *
 * @param {object} manifest
 * @param {object[]} stageResults
 * @returns {{ level: string, reasons: string[] }}
 */
export function explainConfidence(manifest, stageResults) {
  const level = manifest?.overall_confidence || "unknown";
  const reasons = [];

  const stages = stageResults || [];
  const okStages = stages.filter((s) => s.status === "ok");
  const failedStages = stages.filter((s) => s.status === "failed");

  if (okStages.length === stages.length && stages.length > 0) {
    reasons.push("All primary data sources succeeded.");
  } else if (failedStages.length > 0) {
    reasons.push(`${failedStages.length} pipeline stage${failedStages.length > 1 ? "s" : ""} failed: ${failedStages.map((s) => s.stage_name.replace(/-/g, " ")).join(", ")}.`);
  }

  // Per-stage confidence notes
  for (const stage of okStages) {
    const name = stage.stage_name.replace(/-/g, " ");
    if (stage.confidence === "high") {
      reasons.push(`${capitalize(name)} confidence is high.`);
    } else if (stage.confidence === "moderate") {
      const note = stage.stage_name === "demand-generators"
        ? `${capitalize(name)} is moderate because OpenStreetMap completeness varies by locality.`
        : `${capitalize(name)} is moderate.`;
      reasons.push(note);
    } else if (stage.confidence === "preliminary") {
      reasons.push(`${capitalize(name)} is preliminary — limited data available.`);
    }
  }

  // Overall assessment
  if (level === "moderate") {
    reasons.push("Overall confidence remains moderate until competitive market analysis and traffic counts are available.");
  } else if (level === "preliminary") {
    reasons.push("Overall confidence is preliminary. Additional data sources would significantly improve reliability.");
  } else if (level === "high") {
    reasons.push("High confidence indicates strong corroboration across multiple authoritative sources.");
  }

  return { level, reasons };
}

// ── Risk Analysis ───────────────────────────────────────────────────

/**
 * Generate honest limitations analysis.
 * Never pretend missing information doesn't matter.
 *
 * @param {object} stageOutputs
 * @param {object[]} stageResults
 * @param {object[]} [candidates]
 * @returns {Array<{risk: string, impact: string, mitigation: string}>}
 */
export function analyzeRisks(stageOutputs, stageResults, candidates) {
  const risks = [];

  // Always-present limitations
  risks.push({
    risk: "Traffic counts unavailable",
    impact: "Cannot quantify actual vehicular or pedestrian traffic past the site. Scoring defaults traffic components to neutral.",
    mitigation: "Commission a traffic study or obtain DOT counts for adjacent roadways.",
  });

  risks.push({
    risk: "Lease rates unavailable",
    impact: "Rent feasibility cannot be assessed. Categories with low rent tolerance may or may not be viable.",
    mitigation: "Obtain asking rents from the listing broker or comparable properties in the submarket.",
  });

  risks.push({
    risk: "Competitor density analysis is approximate",
    impact: "OpenStreetMap POI data may undercount or misclassify nearby competitors. Actual competitive landscape may differ.",
    mitigation: "Conduct a field survey of competing businesses within the trade area.",
  });

  // Demographics tract-level limitation
  const demo = stageOutputs?.demographics;
  if (demo?.demographics) {
    risks.push({
      risk: "Demographics are tract-level, not trade-area-weighted",
      impact: "Census tract boundaries may not align with the actual trade area. Demographic profile may differ for customers arriving from adjacent tracts.",
      mitigation: "Consider ring-study or drive-time-weighted demographics for a more precise profile.",
    });
  }

  // Demand generators from OSM
  const dg = stageOutputs?.["demand-generators"];
  if (dg?.provider === "osm_overpass") {
    risks.push({
      risk: "Demand generators sourced from OpenStreetMap",
      impact: "OSM coverage varies by region. Some businesses may be missing, recently closed, or misclassified.",
      mitigation: "Validate key demand generators with a site visit or commercial data provider.",
    });
  }

  // No vacancy data
  const hasVacancies = stageOutputs?.["vacancy-scoring"]?.vacancies_scored > 0;
  if (!hasVacancies) {
    risks.push({
      risk: "No vacancy-specific data entered",
      impact: "Scoring used a generic vacancy profile. Physical-fit and unit-size scores are based on defaults, not actual conditions.",
      mitigation: "Enter vacancy details (sqft, venting, drive-through, condition) for more targeted scoring.",
    });
  }

  // No tenant data
  const scoringOutputs = stageOutputs?.["vacancy-scoring"];
  if (scoringOutputs) {
    const topCandidates = scoringOutputs.top_candidates || [];
    const lowCompleteness = topCandidates.filter((c) => c.completeness < 0.5);
    if (lowCompleteness.length > 0) {
      risks.push({
        risk: "Low data completeness for scored categories",
        impact: `${lowCompleteness.length} recommended categories have less than 50% of scoring components backed by real data. Remaining components default to neutral.`,
        mitigation: "Add property-specific data (traffic counts, rents, tenant details) to increase scoring precision.",
      });
    }
  }

  // Failed stages
  const failedStages = (stageResults || []).filter((s) => s.status === "failed");
  for (const stage of failedStages) {
    risks.push({
      risk: `${capitalize(stage.stage_name.replace(/-/g, " "))} stage failed`,
      impact: stage.error || "Data from this stage is unavailable, reducing overall analysis confidence.",
      mitigation: "Verify API credentials and retry the analysis.",
    });
  }

  return risks;
}

// ── Data Gaps ───────────────────────────────────────────────────────

/**
 * Identify data that would increase confidence.
 * Present as opportunities, not failures.
 *
 * @param {object} stageOutputs
 * @param {object[]} stageResults
 * @returns {Array<{label: string, description: string, impact: string}>}
 */
export function identifyDataGaps(stageOutputs, stageResults) {
  const gaps = [];

  // Always-missing at this pipeline stage
  gaps.push({
    label: "Traffic Counts",
    description: "Vehicular and pedestrian counts for adjacent roadways and intersections.",
    impact: "Would enable traffic-alignment scoring and validate the site's accessibility.",
  });

  gaps.push({
    label: "Lease Rates",
    description: "Asking and effective rents for the subject property and comparable spaces.",
    impact: "Would enable rent-feasibility scoring and filter categories that cannot support local rents.",
  });

  gaps.push({
    label: "Parking Utilization",
    description: "Observed parking occupancy during peak and off-peak periods.",
    impact: "Would validate whether parking supply meets demand for high-parking categories.",
  });

  gaps.push({
    label: "Existing Tenant Sales",
    description: "Revenue data from current tenants at the property.",
    impact: "Would provide direct evidence of the site's revenue-generating capacity.",
  });

  gaps.push({
    label: "Historical Visitation",
    description: "Cell-phone mobility or footfall data showing visitation trends over time.",
    impact: "Would reveal seasonal patterns, growth trends, and peak hours.",
  });

  gaps.push({
    label: "Competitor Revenue Estimates",
    description: "Estimated sales volumes for nearby competing businesses.",
    impact: "Would quantify market saturation and identify underserved demand.",
  });

  // Conditional gaps
  const dg = stageOutputs?.["demand-generators"];
  if (!dg || dg.total_pois === 0) {
    gaps.push({
      label: "Points of Interest Validation",
      description: "Field-verified inventory of nearby businesses and traffic generators.",
      impact: "OSM data may be incomplete. Field verification would confirm the demand environment.",
    });
  }

  return gaps;
}

// ── Opportunity Summary ─────────────────────────────────────────────

/**
 * Build a concise opportunity summary for top candidates.
 * Each recommendation cites deterministic evidence.
 *
 * @param {object[]} candidates
 * @param {object} stageOutputs
 * @returns {Array<{category: string, sector: string, score: number, reasons: string[]}>}
 */
export function buildOpportunitySummary(candidates, stageOutputs) {
  const recommended = (candidates || [])
    .filter((c) => c.verdict === "recommend")
    .slice(0, 10);

  return recommended.map((c) => {
    const { supporting } = explainCandidate(c, stageOutputs);
    return {
      category: c.tenant_categories?.name || "Unknown",
      sector: c.tenant_categories?.sector?.replace(/_/g, " ") || "Unknown",
      score: c.opportunity_scores?.overall ?? 0,
      reasons: supporting.slice(0, 4),
    };
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
