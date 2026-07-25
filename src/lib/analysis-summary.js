// @ts-check
/**
 * Deterministic analysis summary builder.
 *
 * Generates analyst-facing findings from persisted stage outputs.
 * Every statement is traceable to a specific stage output — no fabrication.
 *
 * The summary answers four questions:
 *   1. What does the evidence suggest?
 *   2. What are the strongest positives?
 *   3. What are the main risks or limitations?
 *   4. What should the analyst investigate next?
 */

/**
 * Build a structured summary from analysis stage results.
 *
 * @param {object} analysis - The full analysis object from GET /api/analyses/:id
 * @returns {{ headline: string, positives: string[], risks: string[], nextSteps: string[], methodology: string[] }}
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
      if (income >= 75000) {
        positives.push(`Median household income: $${income.toLocaleString()} — above national median.`);
      } else if (income >= 50000) {
        positives.push(`Median household income: $${income.toLocaleString()}.`);
      } else {
        risks.push(`Below-average median household income ($${income.toLocaleString()}).`);
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

    // Highlight key anchors
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

  // ── Overall headline ─────────────────────────────────────────────
  let headline;
  if (failCount === stages.length) {
    headline = "Analysis failed — no usable data was collected.";
  } else if (failCount > 0) {
    headline = `Partial analysis: ${okCount} of ${stages.length} stages completed. Review results with caution.`;
  } else if (risks.length === 0 && positives.length > 0) {
    headline = "Evidence is generally favorable. See details below.";
  } else if (risks.length > positives.length) {
    headline = "Several risk factors identified. Detailed review recommended.";
  } else {
    headline = `Analysis complete with ${positives.length} positive indicators and ${risks.length} risk factors.`;
  }

  // ── Default next steps ───────────────────────────────────────────
  if (nextSteps.length === 0 && okCount === stages.length) {
    nextSteps.push("Review detailed stage outputs for site-specific context.");
    nextSteps.push("Consider on-site visit to validate remote findings.");
  }

  return { headline, positives, risks, nextSteps, methodology };
}
