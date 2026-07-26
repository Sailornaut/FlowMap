// @ts-check
/**
 * Deterministic analysis summary builder.
 *
 * Generates analyst-facing findings from persisted stage outputs.
 * Every statement is traceable to a specific stage output — no fabrication.
 *
 * The summary answers:
 *   1. What is the overall site assessment?
 *   2. What does the evidence suggest? (executive narrative)
 *   3. What are the strongest positives?
 *   4. What are the main risks or limitations?
 *   5. What should the analyst investigate next?
 *   6. How do metrics compare to benchmarks?
 *   7. What data gaps remain?
 */

// National benchmarks — documented, sourced, static.
// Sources: U.S. Census Bureau ACS 2023, BLS.
const NATIONAL_MEDIAN_INCOME = 80610;
const NATIONAL_MEDIAN_AGE = 38.9;

/**
 * Build a structured summary from analysis stage results.
 *
 * @param {object} analysis - The full analysis object from GET /api/analyses/:id
 * @returns {{ headline: string, siteRating: string, siteScore: number, positives: string[], risks: string[], nextSteps: string[], methodology: string[], metricInterpretations: Array<{metric: string, value: string, interpretation: string}>, dataGaps: string[] }}
 */
export function buildAnalysisSummary(analysis) {
  const stages = analysis.analysis_stage_results || [];
  const stageMap = {};
  for (const s of stages) {
    stageMap[s.stage_name] = s;
  }

  const positives = [];
  const risks = [];
  const nextSteps = [];
  const methodology = [];
  const metricInterpretations = [];
  const dataGaps = [];

  const okCount = stages.filter((s) => s.status === "ok").length;
  const failCount = stages.filter((s) => s.status === "failed").length;

  // ── Property validation ──────────────────────────────────────────
  const validation = stageMap["property-validation"];
  if (validation?.status === "ok") {
    const missing = validation.outputs?.property_fields?.required?.missing || [];
    const recommended = validation.outputs?.property_fields?.recommended?.missing || [];
    if (missing.length === 0) {
      positives.push("All required property fields are present.");
    } else {
      risks.push(`Missing required fields: ${missing.join(", ")}.`);
    }
    if (recommended.length > 0) {
      nextSteps.push(`Consider adding: ${recommended.slice(0, 3).join(", ")}.`);
    }
  }

  // ── Geo-enrichment ───────────────────────────────────────────────
  const geo = stageMap["geo-enrichment"];
  if (geo?.status === "ok" && geo.outputs) {
    if (geo.outputs.confirmed) {
      positives.push("Property coordinates confirmed via geocoding.");
    } else if (geo.outputs.geocode_source === "mapbox") {
      const rel = geo.outputs.relevance;
      if (rel != null && rel < 0.8) {
        risks.push(`Geocoding relevance is low (${rel}) — verify the address is correct.`);
      } else {
        positives.push("Property geocoded successfully.");
      }
    }
    methodology.push(`Geocoding: ${geo.outputs.geocode_source || "unknown"} (lat ${geo.outputs.lat?.toFixed(4)}, lng ${geo.outputs.lng?.toFixed(4)}).`);
  }

  // ── Trade area ───────────────────────────────────────────────────
  const tradeArea = stageMap["trade-area"];
  if (tradeArea?.status === "ok" && tradeArea.outputs?.trade_areas?.length > 0) {
    const areas = tradeArea.outputs.trade_areas;
    const minutes = areas.map((a) => a.minutes).join("/");
    positives.push(`Trade area defined with ${minutes}-minute drive-time isochrones.`);
    methodology.push(`Trade area: Mapbox Isochrone API, driving profile, ${areas.length} intervals (${minutes} min).`);
  } else if (tradeArea?.status === "failed") {
    risks.push("Trade-area generation failed — drive-time analysis unavailable.");
    nextSteps.push("Retry analysis or verify Mapbox token is valid.");
  }

  // ── Demographics ─────────────────────────────────────────────────
  const demo = stageMap["demographics"];
  if (demo?.status === "ok" && demo.outputs?.demographics) {
    const d = demo.outputs.demographics;
    const pop = d.total_population;
    const income = d.median_household_income;
    const age = d.median_age;

    if (pop != null) {
      if (pop >= 5000) {
        positives.push(`Tract population: ${pop.toLocaleString()} — strong base.`);
      } else if (pop >= 2000) {
        positives.push(`Tract population: ${pop.toLocaleString()} — adequate base.`);
      } else {
        risks.push(`Low tract population (${pop.toLocaleString()}) — limited local demand.`);
      }
    }

    if (income != null) {
      const ratio = income / NATIONAL_MEDIAN_INCOME;
      if (income >= 75000) {
        positives.push(`Median household income: $${income.toLocaleString()} — above national median.`);
      } else if (income >= 50000) {
        positives.push(`Median household income: $${income.toLocaleString()}.`);
      } else {
        risks.push(`Below-average median household income ($${income.toLocaleString()}).`);
      }

      // Metric interpretation
      let incomeInterp;
      if (ratio >= 2) incomeInterp = "Significantly above national averages, indicating strong purchasing power for premium retail and services.";
      else if (ratio >= 1.2) incomeInterp = "Above the national median, supporting a broad range of retail categories.";
      else if (ratio >= 0.9) incomeInterp = "Near the national median, supporting value-oriented and convenience retail.";
      else incomeInterp = "Below the national median, which may limit viable tenant categories.";

      metricInterpretations.push({
        metric: "Median Household Income",
        value: `$${income.toLocaleString()} (U.S. median: $${NATIONAL_MEDIAN_INCOME.toLocaleString()})`,
        interpretation: incomeInterp,
      });
    }

    if (age != null) {
      let ageInterp;
      if (age < 30) ageInterp = "Younger population favoring fast-casual dining, fitness, and tech-forward retail.";
      else if (age < 42) ageInterp = "Near the national median age, supporting a broad range of retail and services.";
      else ageInterp = "Mature population favoring healthcare, professional services, and full-service dining.";

      metricInterpretations.push({
        metric: "Median Age",
        value: `${age} (U.S. median: ${NATIONAL_MEDIAN_AGE})`,
        interpretation: ageInterp,
      });
    }

    // Family composition interpretation
    const familyHH = d.family_households;
    const totalHH = d.total_households;
    if (familyHH != null && totalHH != null && totalHH > 0) {
      const pct = ((familyHH / totalHH) * 100).toFixed(0);
      if (familyHH / totalHH >= 0.7) {
        positives.push(`Family households comprise ${pct}% of nearby households, favoring childcare, tutoring, and family dining.`);
      }
      metricInterpretations.push({
        metric: "Family Households",
        value: `${pct}% of total households`,
        interpretation: familyHH / totalHH >= 0.7
          ? "Strongly family-oriented community supporting education, childcare, and family-friendly services."
          : familyHH / totalHH >= 0.5
            ? "Balanced household mix supporting both family-oriented and individual-focused retail."
            : "Individual-focused population favoring convenience services and dining.",
      });
    }

    // Homeownership interpretation
    const ownerOcc = d.owner_occupied;
    const renterOcc = d.renter_occupied;
    if (ownerOcc != null && renterOcc != null) {
      const total = ownerOcc + renterOcc;
      if (total > 0) {
        const ownerPct = ((ownerOcc / total) * 100).toFixed(0);
        if (ownerOcc / total >= 0.7) {
          positives.push(`High homeownership (${ownerPct}%) suggests a stable, long-term customer base.`);
        }
      }
    }

    const year = demo.outputs.acs_year || demo.outputs.data_year || "unknown";
    methodology.push(`Demographics: Census ACS 5-year (${year}), tract-level (${demo.outputs.tract_fips || "?"}).`);
    methodology.push("Note: Demographics are tract-level, not trade-area-weighted. Actual trade-area demographics may differ.");
  } else if (demo?.status === "failed") {
    risks.push("Demographic data unavailable — Census lookup failed.");
    nextSteps.push("Check CENSUS_API_KEY and retry.");
  }

  // ── Demand generators ────────────────────────────────────────────
  const demand = stageMap["demand-generators"];
  if (demand?.status === "ok" && demand.outputs) {
    const total = demand.outputs.total_pois || 0;
    const cats = demand.outputs.category_summary || {};
    const catNames = Object.keys(cats);

    if (total >= 10) {
      positives.push(`${total} nearby demand generators identified across ${catNames.length} categories.`);
    } else if (total > 0) {
      risks.push(`Only ${total} nearby demand generators found — limited foot traffic drivers.`);
    } else {
      risks.push("No nearby demand generators found within search radius.");
    }

    const schools = cats.school;
    const transit = cats.transit_station;
    if (schools?.count > 0) {
      positives.push(`${schools.count} school(s) nearby — nearest ${schools.closest_distance_m}m.`);
    }
    if (transit?.count > 0) {
      positives.push(`Transit station within ${transit.closest_distance_m}m.`);
    }

    methodology.push(`POI search: ${demand.outputs.provider || "unknown"}, ${demand.outputs.search_radius_m || "?"}m radius.`);
  } else if (demand?.status === "failed") {
    risks.push("Demand-generator search failed — POI data unavailable.");
  }

  // ── Always-present data gaps ─────────────────────────────────────
  dataGaps.push("Traffic counts — vehicular and pedestrian volumes");
  dataGaps.push("Lease rates — asking and effective rents");
  dataGaps.push("Parking utilization — observed occupancy");
  dataGaps.push("Existing tenant sales — revenue data");
  dataGaps.push("Historical visitation — cell-phone mobility data");
  dataGaps.push("Competitor revenue — estimated sales volumes");

  // ── Always-present risks ─────────────────────────────────────────
  risks.push("Traffic counts unavailable — scoring defaults traffic components to neutral.");
  risks.push("Lease rates unavailable — rent feasibility cannot be assessed.");
  risks.push("Competitor density is approximate — OpenStreetMap data may be incomplete.");

  // ── Site rating computation ──────────────────────────────────────
  let siteScore = 0;
  let maxScore = 0;

  // Pipeline completion (max 15)
  maxScore += 15;
  if (stages.length > 0) {
    siteScore += Math.round((okCount / stages.length) * 15);
  }

  // Demographics (max 25)
  maxScore += 25;
  const demoData = demo?.outputs?.demographics;
  if (demoData) {
    const inc = demoData.median_household_income;
    if (inc >= 120000) siteScore += 15;
    else if (inc >= 80000) siteScore += 12;
    else if (inc >= 60000) siteScore += 8;
    else if (inc >= 40000) siteScore += 5;

    const p = demoData.total_population;
    if (p >= 10000) siteScore += 10;
    else if (p >= 5000) siteScore += 8;
    else if (p >= 2000) siteScore += 5;
  }

  // Demand generators (max 20)
  maxScore += 20;
  if (demand?.outputs) {
    const t = demand.outputs.total_pois || 0;
    if (t >= 50) siteScore += 14;
    else if (t >= 30) siteScore += 11;
    else if (t >= 15) siteScore += 8;
    else if (t >= 5) siteScore += 4;

    const c = demand.outputs.category_summary ? Object.keys(demand.outputs.category_summary).length : 0;
    if (c >= 7) siteScore += 6;
    else if (c >= 4) siteScore += 4;
    else if (c >= 2) siteScore += 2;
  }

  // Trade area (max 10)
  maxScore += 10;
  if (tradeArea?.outputs?.trade_areas?.length >= 3) siteScore += 10;
  else if (tradeArea?.outputs?.trade_areas?.length > 0) siteScore += 6;

  // Confidence (max 10)
  maxScore += 10;
  const conf = analysis.analysis_manifests?.[0]?.overall_confidence;
  if (conf === "high") siteScore += 10;
  else if (conf === "moderate") siteScore += 7;
  else if (conf === "preliminary") siteScore += 3;

  // Normalize
  const normalized = maxScore > 0 ? Math.round((siteScore / maxScore) * 100) : 0;

  let siteRating;
  if (normalized >= 90) siteRating = "Excellent Opportunity";
  else if (normalized >= 75) siteRating = "Strong Candidate";
  else if (normalized >= 60) siteRating = "Promising with Reservations";
  else if (normalized >= 45) siteRating = "Mixed Opportunity";
  else if (normalized >= 30) siteRating = "Limited Opportunity";
  else siteRating = "Unsuitable";

  // ── Overall headline ─────────────────────────────────────────────
  let headline;
  if (failCount === stages.length) {
    headline = "Analysis failed — no usable data was collected.";
  } else if (failCount > 0) {
    headline = `Partial analysis: ${okCount} of ${stages.length} stages completed. Review results with caution.`;
  } else if (normalized >= 75) {
    headline = "This property demonstrates strong market fundamentals across multiple indicators.";
  } else if (normalized >= 60) {
    headline = "This property shows promising characteristics with some areas requiring further investigation.";
  } else if (normalized >= 45) {
    headline = "Mixed opportunity profile — both favorable and unfavorable indicators identified.";
  } else {
    headline = "Current evidence suggests limited opportunity based on available data.";
  }

  // ── Default next steps ───────────────────────────────────────────
  if (nextSteps.length === 0 && okCount === stages.length) {
    nextSteps.push("Review detailed stage outputs for site-specific context.");
    nextSteps.push("Consider on-site visit to validate remote findings.");
  }

  return {
    headline,
    siteRating,
    siteScore: normalized,
    positives,
    risks,
    nextSteps,
    methodology,
    metricInterpretations,
    dataGaps,
  };
}
