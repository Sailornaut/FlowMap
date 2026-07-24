import { describe, expect, it } from "vitest";
import {
  RENT_MODULE_VERSION,
  DISCLAIMER_TEXT,
  MIN_COMPARABLES,
  validateComparable,
  analyzeRent,
} from "../rent/index.js";

const validComp = {
  rent_psf: 25.00,
  rent_basis: "nnn",
  sqft: 1500,
  lease_date: "2026-01-15",
  is_asking: false,
  source_observation_id: "obs-001",
};

const vacancy = { sqft: 1500, rent_basis: "nnn" };

describe("rent module basics", () => {
  it("declares a version", () => {
    expect(RENT_MODULE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has a non-appraisal disclaimer", () => {
    expect(DISCLAIMER_TEXT).toContain("not constitute");
    expect(DISCLAIMER_TEXT).toContain("appraisal");
  });
});

describe("validateComparable", () => {
  it("passes a valid comparable", () => {
    expect(validateComparable(validComp)).toEqual([]);
  });

  it("rejects missing rent_psf", () => {
    const problems = validateComparable({ ...validComp, rent_psf: 0 });
    expect(problems.length).toBeGreaterThan(0);
  });

  it("rejects unknown rent_basis", () => {
    const problems = validateComparable({ ...validComp, rent_basis: "unknown" });
    expect(problems.length).toBeGreaterThan(0);
  });

  it("rejects missing source_observation_id", () => {
    const problems = validateComparable({ ...validComp, source_observation_id: null });
    expect(problems.length).toBeGreaterThan(0);
  });
});

describe("analyzeRent — two shapes only", () => {
  it("returns insufficient_data with fewer than MIN_COMPARABLES", () => {
    const result = analyzeRent([validComp], vacancy);
    expect(result.status).toBe("insufficient_data");
    expect(result.indicated_low_psf).toBeNull();
    expect(result.indicated_high_psf).toBeNull();
    expect(result.disclaimer_version).toBe(DISCLAIMER_TEXT);
  });

  it("returns insufficient_data with zero comparables", () => {
    const result = analyzeRent([], vacancy);
    expect(result.status).toBe("insufficient_data");
  });

  it("returns supported with sufficient valid comparables", () => {
    const comps = [
      { ...validComp, rent_psf: 22.00 },
      { ...validComp, rent_psf: 28.00, source_observation_id: "obs-002" },
      { ...validComp, rent_psf: 25.00, source_observation_id: "obs-003" },
    ];
    const result = analyzeRent(comps, vacancy);
    expect(result.status).toBe("supported");
    expect(result.indicated_low_psf).toBe(22.00);
    expect(result.indicated_high_psf).toBe(28.00);
    expect(result.basis).toBe("nnn");
    expect(result.disclaimer_version).toBe(DISCLAIMER_TEXT);
  });

  it("never returns a third shape", () => {
    // The function can only return "supported" or "insufficient_data"
    const r1 = analyzeRent([], vacancy);
    const r2 = analyzeRent([validComp, { ...validComp, source_observation_id: "obs-002" }], vacancy);
    expect(["supported", "insufficient_data"]).toContain(r1.status);
    expect(["supported", "insufficient_data"]).toContain(r2.status);
  });

  it("range columns are null only when status is insufficient_data", () => {
    const insufficient = analyzeRent([validComp], vacancy);
    expect(insufficient.indicated_low_psf).toBeNull();
    expect(insufficient.indicated_high_psf).toBeNull();

    const supported = analyzeRent(
      [validComp, { ...validComp, rent_psf: 30, source_observation_id: "obs-002" }],
      vacancy
    );
    expect(supported.indicated_low_psf).not.toBeNull();
    expect(supported.indicated_high_psf).not.toBeNull();
  });

  it("flags stale comparables as a limitation", () => {
    const staleComp = { ...validComp, lease_date: "2022-01-01", source_observation_id: "obs-old" };
    const result = analyzeRent([staleComp, validComp], vacancy);
    expect(result.limitations.some((l) => l.includes("older than"))).toBe(true);
  });

  it("flags all-asking as a limitation", () => {
    const asking1 = { ...validComp, is_asking: true };
    const asking2 = { ...validComp, is_asking: true, rent_psf: 30, source_observation_id: "obs-002" };
    const result = analyzeRent([asking1, asking2], vacancy);
    expect(result.limitations.some((l) => l.includes("asking"))).toBe(true);
  });
});
