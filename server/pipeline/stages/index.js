// @ts-check
/**
 * Stage registry — ordered list of all pipeline stages.
 *
 * Import order defines execution order. Each stage is a module exporting
 * a StageDefinition (name, version, run, optional depths).
 *
 * Stages not yet implemented are listed as comments for roadmap visibility.
 */

import propertyValidation from "./property-validation.js";
import geoEnrichment from "./geo-enrichment.js";
import tradeArea from "./trade-area.js";
import demographics from "./demographics.js";
// import trafficPatterns from "./traffic-patterns.js";       // Stage 5: DOT AADT (planned)
import demandGenerators from "./demand-generators.js";
import vacancyScoring from "./vacancy-scoring.js";
// import competition from "./competition.js";               // Stage 7: same-category saturation (planned)
// import tenantClassification from "./tenant-classification.js"; // Stage 8 (planned)
// import gapAnalysis from "./gap-analysis.js";              // Stage 9 (planned)
// import vacancyCompatibility from "./vacancy-compatibility.js"; // Stage 10 (planned)
// import candidateScoring from "./candidate-scoring.js";    // Stage 11 (planned)
// import synergy from "./synergy.js";                       // Stage 12 (planned)
// import risk from "./risk.js";                             // Stage 13 (planned)
// import rentComps from "./rent-comps.js";                  // Stage 14 (planned)
// import narrative from "./narrative.js";                   // Stage 15: LLM (planned)
// import analystReview from "./analyst-review.js";          // Stage 16: human gate (planned)
// import reportGeneration from "./report-generation.js";    // Stage 17 (planned)

/**
 * All implemented stages in execution order.
 * @type {import('../runner.js').StageDefinition[]}
 */
export const ALL_STAGES = [
  propertyValidation,
  geoEnrichment,
  tradeArea,
  demographics,
  demandGenerators,
  vacancyScoring,
];

/**
 * Get stages by name.
 * @param {string[]} names
 * @returns {import('../runner.js').StageDefinition[]}
 */
export function getStagesByName(names) {
  return names
    .map((n) => ALL_STAGES.find((s) => s.name === n))
    .filter(Boolean);
}
