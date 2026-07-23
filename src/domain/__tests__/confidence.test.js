import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_LEVELS,
  CONFIDENCE_MODEL_VERSION,
  combineConfidence,
  computeConfidence,
} from "../confidence/index.js";

const fresh = {
  sourceReliabilityTier: 1,
  recencyMonths: 2,
  corroboratingSources: 3,
  geographicPrecision: "exact",
  completeness: 1,
  directlyMeasured: true,
};

describe("computeConfidence", () => {
  it("is deterministic", () => {
    expect(computeConfidence(fresh)).toEqual(computeConfidence(fresh));
  });

  it("rates fresh, authoritative, corroborated, measured data HIGH", () => {
    const result = computeConfidence(fresh);
    expect(result.level).toBe(CONFIDENCE_LEVELS.HIGH);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.modelVersion).toBe(CONFIDENCE_MODEL_VERSION);
  });

  it("caps at INSUFFICIENT when required inputs are mostly missing, regardless of source quality", () => {
    const result = computeConfidence({ ...fresh, completeness: 0.2 });
    expect(result.level).toBe(CONFIDENCE_LEVELS.INSUFFICIENT);
  });

  it("caps at INSUFFICIENT for unverified (tier 4) sources", () => {
    const result = computeConfidence({ ...fresh, sourceReliabilityTier: 4 });
    expect(result.level).toBe(CONFIDENCE_LEVELS.INSUFFICIENT);
  });

  it("downgrades modeled estimates vs measured facts", () => {
    const measured = computeConfidence(fresh);
    const modeled = computeConfidence({ ...fresh, directlyMeasured: false });
    expect(modeled.score).toBeLessThan(measured.score);
    expect(modeled.factors).toContain("modeled estimate");
  });

  it("downgrades stale data", () => {
    const stale = computeConfidence({ ...fresh, recencyMonths: 48 });
    expect(stale.score).toBeLessThan(computeConfidence(fresh).score);
    expect(stale.factors).toContain("data more than 3 years old");
  });

  it("never returns HIGH for tier-3 scraped sources", () => {
    const result = computeConfidence({ ...fresh, sourceReliabilityTier: 3 });
    expect([CONFIDENCE_LEVELS.MODERATE, CONFIDENCE_LEVELS.PRELIMINARY]).toContain(result.level);
  });

  it("single-source facts are flagged in factors", () => {
    const result = computeConfidence({ ...fresh, corroboratingSources: 1 });
    expect(result.factors).toContain("single-source fact");
  });
});

describe("combineConfidence", () => {
  it("returns INSUFFICIENT for an empty set", () => {
    expect(combineConfidence([]).level).toBe(CONFIDENCE_LEVELS.INSUFFICIENT);
  });

  it("is as weak as its weakest link", () => {
    const strong = computeConfidence(fresh);
    const weak = computeConfidence({ ...fresh, sourceReliabilityTier: 4 });
    expect(combineConfidence([strong, weak]).level).toBe(CONFIDENCE_LEVELS.INSUFFICIENT);
  });

  it("keeps the level of a uniformly strong set", () => {
    const strong = computeConfidence(fresh);
    expect(combineConfidence([strong, strong]).level).toBe(CONFIDENCE_LEVELS.HIGH);
  });
});
