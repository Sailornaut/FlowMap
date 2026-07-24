import { describe, expect, it } from "vitest";
import {
  SCORING_VERSION,
  DEFAULT_WEIGHTS,
  COMPONENT_KEYS,
  checkDisqualifiers,
  computeUnitSizeFit,
  computePhysicalFit,
  scoreCandidate,
  rankCandidates,
} from "../scoring/index.js";
import { getCategory } from "../taxonomy/index.js";

// Helper: build a category profile from the taxonomy
function profileFor(slug) {
  return getCategory(slug)?.profile;
}

// Helper: build a basic vacancy
function vacancy(overrides = {}) {
  return {
    sqft: 1500,
    placement: "inline",
    condition: "second_gen",
    venting_possible: "yes",
    grease_trap: "yes",
    drive_through: "no",
    patio_possible: "yes",
    asking_rent_psf: 25,
    ...overrides,
  };
}

// Helper: full evidence set
function fullEvidence(overrides = {}) {
  return {
    localDemandScore: 70,
    demographicAlignmentScore: 65,
    trafficAlignmentScore: 60,
    daypartAlignmentScore: 75,
    competitionScore: 55,
    tenantMixGapScore: 80,
    cotenancySynergyScore: 60,
    marketGrowthScore: 50,
    dataQualityScore: 70,
    ...overrides,
  };
}

describe("scoring module basics", () => {
  it("declares a version", () => {
    expect(SCORING_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has 15 component keys", () => {
    expect(COMPONENT_KEYS).toHaveLength(15);
  });

  it("default weights sum to approximately 1.0", () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });
});

describe("checkDisqualifiers", () => {
  it("disqualifies a restaurant in a no-venting space", () => {
    const profile = profileFor("quick_service_restaurant");
    const v = vacancy({ venting_possible: "no" });
    const result = checkDisqualifiers(profile, v);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain("Venting");
  });

  it("does NOT disqualify when venting is available", () => {
    const profile = profileFor("quick_service_restaurant");
    const v = vacancy({ venting_possible: "yes" });
    expect(checkDisqualifiers(profile, v)).toEqual([]);
  });

  it("does NOT disqualify when venting is unknown", () => {
    const profile = profileFor("quick_service_restaurant");
    const v = vacancy({ venting_possible: "unknown" });
    expect(checkDisqualifiers(profile, v)).toEqual([]);
  });

  it("does not disqualify a category with no physical requirements", () => {
    const profile = profileFor("insurance_tax_office");
    const v = vacancy({ venting_possible: "no" });
    expect(checkDisqualifiers(profile, v)).toEqual([]);
  });
});

describe("computeUnitSizeFit", () => {
  it("scores 100 when sqft is within range", () => {
    const profile = profileFor("coffee_shop"); // 800–2200
    const result = computeUnitSizeFit(profile, { sqft: 1500 });
    expect(result.normalized).toBe(100);
  });

  it("degrades when sqft is outside range", () => {
    const profile = profileFor("coffee_shop");
    const result = computeUnitSizeFit(profile, { sqft: 4000 });
    expect(result.normalized).toBeLessThan(100);
    expect(result.normalized).toBeGreaterThanOrEqual(0);
  });

  it("returns 50 (neutral) when sqft is unknown", () => {
    const profile = profileFor("coffee_shop");
    const result = computeUnitSizeFit(profile, {});
    expect(result.normalized).toBe(50);
  });
});

describe("computePhysicalFit", () => {
  it("scores 100 when all requirements are met", () => {
    const profile = profileFor("quick_service_restaurant");
    const v = vacancy({ venting_possible: "yes", grease_trap: "yes" });
    const result = computePhysicalFit(profile, v);
    expect(result.normalized).toBe(100);
  });

  it("penalizes unknown constraints partially", () => {
    const profile = profileFor("quick_service_restaurant");
    const v = vacancy({ venting_possible: "unknown", grease_trap: "unknown" });
    const result = computePhysicalFit(profile, v);
    expect(result.normalized).toBe(50);
    expect(result.unknowns.length).toBeGreaterThan(0);
  });
});

describe("scoreCandidate", () => {
  it("is deterministic — same inputs produce same output", () => {
    const params = {
      categoryProfile: profileFor("coffee_shop"),
      vacancy: vacancy(),
      evidence: fullEvidence(),
    };
    const r1 = scoreCandidate(params);
    const r2 = scoreCandidate(params);
    expect(r1.overall).toBe(r2.overall);
    expect(r1.components.length).toBe(r2.components.length);
  });

  it("returns overall 0 for disqualified candidates", () => {
    const result = scoreCandidate({
      categoryProfile: profileFor("quick_service_restaurant"),
      vacancy: vacancy({ venting_possible: "no" }),
      evidence: fullEvidence(),
    });
    expect(result.overall).toBe(0);
    expect(result.disqualifiers.length).toBeGreaterThan(0);
  });

  it("returns overall 0–100 for non-disqualified candidates", () => {
    const result = scoreCandidate({
      categoryProfile: profileFor("coffee_shop"),
      vacancy: vacancy(),
      evidence: fullEvidence(),
    });
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.disqualifiers).toEqual([]);
    expect(result.components.length).toBe(15);
  });

  it("has lower completeness with missing evidence", () => {
    const full = scoreCandidate({
      categoryProfile: profileFor("coffee_shop"),
      vacancy: vacancy(),
      evidence: fullEvidence(),
    });
    const partial = scoreCandidate({
      categoryProfile: profileFor("coffee_shop"),
      vacancy: vacancy(),
      evidence: {},
    });
    expect(partial.completeness).toBeLessThan(full.completeness);
  });

  it("missing evidence cannot improve confidence", () => {
    const result = scoreCandidate({
      categoryProfile: profileFor("coffee_shop"),
      vacancy: vacancy(),
      evidence: {},
    });
    // With no evidence, confidence should not be "high"
    expect(result.confidence).not.toBe("high");
  });
});

describe("rankCandidates", () => {
  it("sorts by overall score descending", () => {
    const coffee = scoreCandidate({
      categoryProfile: profileFor("coffee_shop"),
      vacancy: vacancy(),
      evidence: fullEvidence({ tenantMixGapScore: 90, localDemandScore: 85 }),
    });
    const insurance = scoreCandidate({
      categoryProfile: profileFor("insurance_tax_office"),
      vacancy: vacancy(),
      evidence: fullEvidence({ tenantMixGapScore: 30, localDemandScore: 25 }),
    });

    const ranked = rankCandidates([insurance, coffee]);
    expect(ranked[0].overall).toBeGreaterThanOrEqual(ranked[1].overall);
  });
});
