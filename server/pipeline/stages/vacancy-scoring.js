// @ts-check
/**
 * Stage: Vacancy Scoring
 *
 * Runs the deterministic scoring engine for each vacancy × category combination.
 * Produces ranked candidate recommendations per vacancy.
 *
 * Requires:
 * - Tenant categories seeded in DB (via seed-taxonomy.js)
 * - Prior stages: property-validation, demographics, demand-generators (for evidence)
 *
 * Persists to Supabase:
 * - business_candidates (one per vacancy × category)
 * - opportunity_scores (one per candidate)
 * - score_components (one per score × component key)
 *
 * This stage does NOT fabricate scores — every component is computed from
 * real pipeline outputs or defaults to neutral (50) with reduced completeness.
 */

import { scoreCandidate, rankCandidates, DEFAULT_WEIGHTS, SCORING_VERSION } from "../../../src/domain/scoring/index.js";
import { CATEGORIES, TAXONOMY_VERSION } from "../../../src/domain/taxonomy/categories.js";
import { isSqftCompatible } from "../../../src/domain/taxonomy/index.js";
import { buildEvidenceInputs } from "../evidence-extractor.js";

export const STAGE_NAME = "vacancy-scoring";
export const STAGE_VERSION = "1.0.0";

/** Maximum categories to score per vacancy (skip clearly incompatible ones). */
const MAX_CANDIDATES_PER_VACANCY = 33; // all categories for now

/** Minimum overall score to include in results (below this = filtered out). */
const MIN_SCORE_THRESHOLD = 0;

/**
 * Derive a verdict from the scoring result.
 * @param {import("../../../src/domain/scoring/index.js").ScoringResult} result
 * @returns {"recommend"|"neutral"|"avoid"|"disqualified"}
 */
function deriveVerdict(result) {
  if (result.disqualifiers.length > 0) return "disqualified";
  if (result.overall >= 65 && result.confidence !== "insufficient") return "recommend";
  if (result.overall <= 30) return "avoid";
  return "neutral";
}

/** @type {import('../../pipeline/runner.js').StageDefinition} */
const stage = {
  name: STAGE_NAME,
  version: STAGE_VERSION,
  depths: ["standard", "full"],

  async run(ctx) {
    const { property, vacancies, analysisRun, stageOutputs, services } = ctx;
    const supabase = services?.supabase;
    const observations = [];

    // Build a pseudo stage-results list from stageOutputs for data quality scoring.
    // Each key in stageOutputs was a successful stage (errors don't accumulate).
    const priorStageNames = Object.keys(stageOutputs);
    const stageResults = priorStageNames.map((name) => ({
      stage_name: name,
      status: stageOutputs[name]?.error ? "failed" : "ok",
    }));

    // ── Validate prerequisites ────────────────────────────────────────
    if (!supabase) {
      return {
        outputs: { error: "Supabase service not available" },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const targetVacancies = vacancies && vacancies.length > 0
      ? vacancies
      : [{ id: null, sqft: null, placement: "unknown", condition: "unknown",
           venting_possible: "unknown", grease_trap: "unknown",
           drive_through: "unknown", patio_possible: "unknown" }];

    // ── Load tenant categories from DB ────────────────────────────────
    const { data: dbCategories, error: catError } = await supabase
      .from("tenant_categories")
      .select("id, slug, sector")
      .eq("active", true);

    if (catError || !dbCategories?.length) {
      return {
        outputs: {
          error: catError?.message || "No tenant categories found. Run seed-taxonomy.js first.",
          candidates: [],
        },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const slugToDbId = new Map(dbCategories.map((c) => [c.slug, c.id]));

    // ── Load active methodology version ───────────────────────────────
    const { data: methodology } = await supabase
      .from("methodology_versions")
      .select("id, version, weights")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    const methodologyId = methodology?.id || null;
    const weights = methodology?.weights || DEFAULT_WEIGHTS;
    const methodologyVersion = methodology?.version || "default";

    // ── Load existing tenants for mix analysis ────────────────────────
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, business_name, category_slug, tenant_categories(slug, sector)")
      .eq("property_id", property.id);

    const existingTenants = tenants || [];

    // ── Score each vacancy × category ─────────────────────────────────
    const allResults = [];
    let totalCandidates = 0;

    for (const vacancy of targetVacancies) {
      const vacancyResults = [];

      for (const category of CATEGORIES) {
        const dbCatId = slugToDbId.get(category.slug);
        if (!dbCatId) continue;

        // Pre-filter: skip if sqft is known and wildly incompatible (>50% tolerance)
        if (vacancy.sqft && !isSqftCompatible(category.slug, vacancy.sqft, { tolerance: 0.50 })) {
          continue;
        }

        const evidence = buildEvidenceInputs({
          categoryProfile: { ...category.profile, sector: category.sector },
          categorySlug: category.slug,
          stageOutputs,
          stageResults,
          existingTenants,
        });

        const result = scoreCandidate({
          categoryProfile: category.profile,
          vacancy: {
            sqft: vacancy.sqft || undefined,
            placement: vacancy.placement || undefined,
            condition: vacancy.condition || undefined,
            venting_possible: vacancy.venting_possible || undefined,
            grease_trap: vacancy.grease_trap || undefined,
            drive_through: vacancy.drive_through || undefined,
            patio_possible: vacancy.patio_possible || undefined,
            asking_rent_psf: vacancy.asking_rent_psf || undefined,
          },
          evidence,
          weights,
          methodologyVersion,
        });

        if (result.overall >= MIN_SCORE_THRESHOLD) {
          vacancyResults.push({
            categorySlug: category.slug,
            categoryName: category.name,
            categorySector: category.sector,
            dbCategoryId: dbCatId,
            vacancyId: vacancy.id,
            result,
            verdict: deriveVerdict(result),
          });
        }
      }

      // Rank by overall score
      const ranked = vacancyResults.sort((a, b) => b.result.overall - a.result.overall);
      ranked.forEach((r, i) => { r.rank = i + 1; });

      allResults.push(...ranked);
      totalCandidates += ranked.length;
    }

    // ── Persist to Supabase ───────────────────────────────────────────
    let persistedCount = 0;

    for (const candidate of allResults) {
      try {
        // Insert business_candidate
        const { data: bc, error: bcError } = await supabase
          .from("business_candidates")
          .insert({
            analysis_run_id: analysisRun.id,
            category_id: candidate.dbCategoryId,
            vacancy_id: candidate.vacancyId || null,
            rank: candidate.rank,
            verdict: candidate.verdict,
          })
          .select("id")
          .single();

        if (bcError) {
          console.error(`Failed to insert candidate ${candidate.categorySlug}:`, bcError.message);
          continue;
        }

        // Insert opportunity_score
        const { data: score, error: scoreError } = await supabase
          .from("opportunity_scores")
          .insert({
            candidate_id: bc.id,
            overall: candidate.result.overall,
            confidence: candidate.result.confidence,
            completeness: candidate.result.completeness,
            methodology_version_id: methodologyId,
            positive_factors: candidate.result.positiveFactors,
            negative_factors: candidate.result.negativeFactors,
            disqualifiers: candidate.result.disqualifiers.length > 0
              ? candidate.result.disqualifiers
              : null,
          })
          .select("id")
          .single();

        if (scoreError) {
          console.error(`Failed to insert score for ${candidate.categorySlug}:`, scoreError.message);
          continue;
        }

        // Insert score_components (batch)
        const componentRows = candidate.result.components
          .filter((c) => c.raw !== -1 || c.explanation) // Only persist meaningful components
          .map((c) => ({
            score_id: score.id,
            component_key: c.key,
            raw: c.raw === -1 ? null : c.raw,
            normalized: c.normalized,
            weight: c.weight,
            explanation: c.explanation || null,
          }));

        if (componentRows.length > 0) {
          const { error: compError } = await supabase
            .from("score_components")
            .insert(componentRows);

          if (compError) {
            console.error(`Failed to insert components for ${candidate.categorySlug}:`, compError.message);
          }
        }

        persistedCount++;
      } catch (err) {
        console.error(`Error persisting candidate ${candidate.categorySlug}:`, err.message);
      }
    }

    // ── Build output summary ──────────────────────────────────────────
    const topCandidates = allResults
      .filter((c) => c.verdict === "recommend")
      .slice(0, 10)
      .map((c) => ({
        category: c.categoryName,
        slug: c.categorySlug,
        sector: c.categorySector,
        rank: c.rank,
        score: c.result.overall,
        confidence: c.result.confidence,
        completeness: c.result.completeness,
        verdict: c.verdict,
        positiveFactors: c.result.positiveFactors.slice(0, 3),
        negativeFactors: c.result.negativeFactors.slice(0, 3),
      }));

    const disqualified = allResults
      .filter((c) => c.verdict === "disqualified")
      .map((c) => ({
        category: c.categoryName,
        slug: c.categorySlug,
        reasons: c.result.disqualifiers,
      }));

    observations.push({
      source_name: "trafficscout_scoring",
      source_kind: "computed",
      source_url_or_id: `scoring:${SCORING_VERSION}:${methodologyVersion}:${analysisRun.id}`,
      retrieved_at: new Date().toISOString(),
      raw_value: {
        total_candidates: totalCandidates,
        persisted: persistedCount,
        recommended: topCandidates.length,
        disqualified: disqualified.length,
      },
      normalized_value: { scoring_version: SCORING_VERSION, methodology_version: methodologyVersion },
      unit: "scoring_summary",
      confidence: totalCandidates > 0 ? "moderate" : "preliminary",
      reliability_tier: 1,
    });

    const completeness = persistedCount > 0 ? Math.min(1, persistedCount / totalCandidates) : 0;

    return {
      outputs: {
        scoring_version: SCORING_VERSION,
        methodology_version: methodologyVersion,
        taxonomy_version: TAXONOMY_VERSION,
        total_candidates: totalCandidates,
        persisted: persistedCount,
        vacancies_scored: targetVacancies.length,
        top_candidates: topCandidates,
        disqualified,
      },
      observations,
      confidence: totalCandidates >= 10 ? "moderate" : totalCandidates > 0 ? "preliminary" : "insufficient",
      completeness,
      cost: 0,
    };
  },
};

export default stage;
