// @ts-check
import { describe, expect, it } from "vitest";
import propertyValidation from "../stages/property-validation.js";
import geoEnrichment from "../stages/geo-enrichment.js";
import tradeArea from "../stages/trade-area.js";
import demographics from "../stages/demographics.js";
import demandGenerators from "../stages/demand-generators.js";
import { ALL_STAGES } from "../stages/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseCtx(overrides = {}) {
  return {
    property: {
      name: "Test Center",
      address: "123 Main St",
      city: "Anytown",
      state: "IA",
      postal_code: "50001",
      lat: 41.58,
      lng: -93.62,
      property_type: "shopping_center",
      total_gla_sqft: 50000,
      parking_spaces: 200,
      center_subtype: "neighborhood",
    },
    tenants: [
      { name: "Tenant A", category_slug: "coffee_shop", sqft: 1200 },
    ],
    vacancies: [
      {
        unit_label: "B-1",
        sqft: 1500,
        asking_rent_psf: 20,
        rent_basis: "nnn",
        condition: "second_gen",
        placement: "inline",
        venting_possible: "yes",
        grease_trap: "yes",
        drive_through: "no",
        patio_possible: "no",
      },
    ],
    analysisRun: { id: "run-test" },
    stageOutputs: {},
    services: {},
    config: {},
    ...overrides,
  };
}

// ─── Stage registry ──────────────────────────────────────────────────────────

describe("stage registry", () => {
  it("exports all implemented stages in order", () => {
    expect(ALL_STAGES.length).toBeGreaterThanOrEqual(5);
    expect(ALL_STAGES[0].name).toBe("property-validation");
    expect(ALL_STAGES[1].name).toBe("geo-enrichment");
    expect(ALL_STAGES[2].name).toBe("trade-area");
    expect(ALL_STAGES[3].name).toBe("demographics");
    expect(ALL_STAGES[4].name).toBe("demand-generators");
  });

  it("every stage has name, version, and run", () => {
    for (const stage of ALL_STAGES) {
      expect(typeof stage.name).toBe("string");
      expect(stage.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(typeof stage.run).toBe("function");
    }
  });
});

// ─── property-validation ─────────────────────────────────────────────────────

describe("property-validation stage", () => {
  it("passes with complete data", async () => {
    const ctx = baseCtx();
    const result = await propertyValidation.run(ctx);
    expect(result.outputs.valid).toBe(true);
    expect(result.outputs.errors).toHaveLength(0);
    expect(result.confidence).toBe("high");
    expect(result.cost).toBe(0);
    expect(result.observations).toHaveLength(0);
  });

  it("fails when required property fields missing", async () => {
    const ctx = baseCtx({
      property: { lat: 41.58, lng: -93.62 },
    });
    const result = await propertyValidation.run(ctx);
    expect(result.outputs.valid).toBe(false);
    expect(result.outputs.errors.length).toBeGreaterThan(0);
    expect(result.confidence).not.toBe("high");
  });

  it("warns when recommended fields missing", async () => {
    const ctx = baseCtx({
      property: {
        name: "Test",
        address: "123 Main",
        city: "Town",
        state: "IA",
        property_type: "retail",
        // missing lat, lng, total_gla_sqft, parking_spaces, center_subtype
      },
    });
    const result = await propertyValidation.run(ctx);
    expect(result.outputs.warnings.length).toBeGreaterThan(0);
  });

  it("warns when no vacancies defined", async () => {
    const ctx = baseCtx({ vacancies: [] });
    const result = await propertyValidation.run(ctx);
    expect(
      result.outputs.warnings.some((w) => w.includes("No vacancies"))
    ).toBe(true);
  });

  it("tracks per-vacancy completeness", async () => {
    const ctx = baseCtx({
      vacancies: [
        { unit_label: "A" },
        {
          unit_label: "B",
          sqft: 1000,
          asking_rent_psf: 15,
          rent_basis: "nnn",
          condition: "shell",
          placement: "inline",
          venting_possible: "yes",
          grease_trap: "yes",
          drive_through: "no",
          patio_possible: "no",
        },
      ],
    });
    const result = await propertyValidation.run(ctx);
    expect(result.outputs.vacancy_results).toHaveLength(2);
    expect(result.outputs.vacancy_results[1].recommended_completeness).toBe(1);
    expect(
      result.outputs.vacancy_results[0].recommended_completeness
    ).toBeLessThan(1);
  });

  it("detects invalid geocode", async () => {
    const ctx = baseCtx({
      property: {
        ...baseCtx().property,
        lat: null,
        lng: null,
      },
    });
    const result = await propertyValidation.run(ctx);
    expect(result.outputs.geocode_valid).toBe(false);
  });

  it("flags out-of-bounds coordinates", async () => {
    const ctx = baseCtx({
      property: {
        ...baseCtx().property,
        lat: 60, // above US bounds
        lng: -93,
      },
    });
    const result = await propertyValidation.run(ctx);
    expect(
      result.outputs.warnings.some((w) => w.includes("outside continental"))
    ).toBe(true);
  });
});

// ─── geo-enrichment ──────────────────────────────────────────────────────────

describe("geo-enrichment stage", () => {
  it("confirms existing coordinates without API call", async () => {
    const ctx = baseCtx();
    const result = await geoEnrichment.run(ctx);
    expect(result.outputs.geocode_source).toBe("existing");
    expect(result.outputs.confirmed).toBe(true);
    expect(result.cost).toBe(0);
    expect(result.confidence).toBe("high");
  });

  it("returns insufficient when no coords and no service", async () => {
    const ctx = baseCtx({
      property: { ...baseCtx().property, lat: null, lng: null },
    });
    const result = await geoEnrichment.run(ctx);
    expect(result.outputs.geocode_source).toBe("unavailable");
    expect(result.confidence).toBe("insufficient");
  });

  it("geocodes via service when coords missing", async () => {
    const mockGeocoder = {
      geocode: async () => ({
        lat: 41.58,
        lng: -93.62,
        place_name: "123 Main St, Anytown, IA",
        relevance: 0.95,
      }),
    };
    const ctx = baseCtx({
      property: { ...baseCtx().property, lat: null, lng: null },
      services: { geocoding: mockGeocoder },
    });
    const result = await geoEnrichment.run(ctx);
    expect(result.outputs.geocode_source).toBe("mapbox");
    expect(result.outputs.lat).toBe(41.58);
    expect(result.outputs.confirmed).toBe(true);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].source_name).toBe("mapbox_geocoding");
    expect(result.observations[0].reliability_tier).toBe(2);
  });

  it("handles geocode returning no results", async () => {
    const mockGeocoder = {
      geocode: async () => null,
    };
    const ctx = baseCtx({
      property: { ...baseCtx().property, lat: null, lng: null },
      services: { geocoding: mockGeocoder },
    });
    const result = await geoEnrichment.run(ctx);
    expect(result.outputs.geocode_source).toBe("failed");
    expect(result.confidence).toBe("insufficient");
  });

  it("handles geocode service error gracefully", async () => {
    const mockGeocoder = {
      geocode: async () => {
        throw new Error("API timeout");
      },
    };
    const ctx = baseCtx({
      property: { ...baseCtx().property, lat: null, lng: null },
      services: { geocoding: mockGeocoder },
    });
    const result = await geoEnrichment.run(ctx);
    expect(result.outputs.geocode_source).toBe("error");
    expect(result.outputs.error).toContain("API timeout");
    expect(result.confidence).toBe("insufficient");
  });
});

// ─── trade-area ──────────────────────────────────────────────────────────────

describe("trade-area stage", () => {
  it("returns insufficient without coordinates", async () => {
    const ctx = baseCtx({
      property: { ...baseCtx().property, lat: null, lng: null },
    });
    const result = await tradeArea.run(ctx);
    expect(result.confidence).toBe("insufficient");
    expect(result.outputs.trade_areas).toHaveLength(0);
  });

  it("returns insufficient without isochrone service", async () => {
    const ctx = baseCtx();
    const result = await tradeArea.run(ctx);
    expect(result.confidence).toBe("insufficient");
    expect(result.outputs.error).toContain("not configured");
  });

  it("generates trade areas with service", async () => {
    const mockIsochrone = {
      getIsochrone: async (lat, lng, minutes) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[[lng - 0.01, lat - 0.01], [lng + 0.01, lat - 0.01], [lng + 0.01, lat + 0.01], [lng - 0.01, lat + 0.01], [lng - 0.01, lat - 0.01]]],
        },
        properties: { contour: minutes },
      }),
    };
    const ctx = baseCtx({ services: { isochrone: mockIsochrone } });
    const result = await tradeArea.run(ctx);
    expect(result.outputs.trade_areas).toHaveLength(3);
    expect(result.outputs.drive_times_succeeded).toBe(3);
    expect(result.confidence).toBe("high");
    expect(result.observations).toHaveLength(3);
    expect(result.cost).toBeGreaterThan(0);
  });

  it("handles partial isochrone failure gracefully", async () => {
    let callCount = 0;
    const mockIsochrone = {
      getIsochrone: async (lat, lng, minutes) => {
        callCount++;
        if (callCount === 2) throw new Error("API error");
        return { type: "Feature", geometry: { type: "Polygon", coordinates: [] } };
      },
    };
    const ctx = baseCtx({ services: { isochrone: mockIsochrone } });
    const result = await tradeArea.run(ctx);
    expect(result.outputs.drive_times_succeeded).toBe(2);
    expect(result.confidence).toBe("moderate");
  });
});

// ─── demographics ────────────────────────────────────────────────────────────

describe("demographics stage", () => {
  it("returns insufficient without coordinates", async () => {
    const ctx = baseCtx({
      property: { ...baseCtx().property, lat: null, lng: null },
    });
    const result = await demographics.run(ctx);
    expect(result.confidence).toBe("insufficient");
  });

  it("returns insufficient without census service", async () => {
    const ctx = baseCtx();
    const result = await demographics.run(ctx);
    expect(result.confidence).toBe("insufficient");
  });

  it("fetches demographics via census service", async () => {
    const mockCensus = {
      getTract: async () => ({
        state_fips: "19",
        county_fips: "153",
        tract: "001100",
        block_group: "1",
      }),
      getACSData: async () => ({
        B01001_001E: 45000,
        B19013_001E: 65000,
        B01002_001E: 36,
        B11001_001E: 18000,
        B11001_002E: 12000,
        B25003_002E: 12000,
        B25003_003E: 5000,
        B25001_001E: 17000,
      }),
    };
    const ctx = baseCtx({ services: { census: mockCensus } });
    const result = await demographics.run(ctx);
    expect(result.outputs.demographics.total_population).toBe(45000);
    expect(result.outputs.demographics.median_household_income).toBe(65000);
    expect(result.outputs.demographics.family_household_pct).toBe(67);
    expect(result.outputs.tract_fips).toBe("19153001100");
    expect(result.confidence).toBe("high");
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0].reliability_tier).toBe(1);
    expect(result.cost).toBe(0);
  });

  it("handles tract lookup failure", async () => {
    const mockCensus = {
      getTract: async () => null,
      getACSData: async () => null,
    };
    const ctx = baseCtx({ services: { census: mockCensus } });
    const result = await demographics.run(ctx);
    expect(result.confidence).toBe("insufficient");
    expect(result.outputs.demographics).toBeNull();
  });

  it("handles ACS data unavailable for tract", async () => {
    const mockCensus = {
      getTract: async () => ({
        state_fips: "19", county_fips: "153", tract: "999900", block_group: "1",
      }),
      getACSData: async () => null,
    };
    const ctx = baseCtx({ services: { census: mockCensus } });
    const result = await demographics.run(ctx);
    expect(result.confidence).toBe("preliminary");
    expect(result.outputs.demographics).toBeNull();
  });
});

// ─── demand-generators ───────────────────────────────────────────────────────

describe("demand-generators stage", () => {
  it("returns insufficient without coordinates", async () => {
    const ctx = baseCtx({
      property: { ...baseCtx().property, lat: null, lng: null },
    });
    const result = await demandGenerators.run(ctx);
    expect(result.confidence).toBe("insufficient");
    expect(result.outputs.pois).toHaveLength(0);
  });

  it("returns insufficient without places service", async () => {
    const ctx = baseCtx();
    const result = await demandGenerators.run(ctx);
    expect(result.confidence).toBe("insufficient");
  });

  it("fetches POIs via places service", async () => {
    const mockPlaces = {
      providerName: "osm_overpass",
      searchNearby: async () => [
        { name: "Lincoln High School", category: "school", lat: 41.58, lng: -93.63, distance_m: 400 },
        { name: "Mercy Hospital", category: "hospital", lat: 41.59, lng: -93.62, distance_m: 800 },
        { name: "City Park", category: "park", lat: 41.57, lng: -93.61, distance_m: 300 },
        { name: "First Baptist", category: "church", lat: 41.58, lng: -93.61, distance_m: 500 },
        { name: "Gold's Gym", category: "gym", lat: 41.58, lng: -93.63, distance_m: 600 },
      ],
    };
    const ctx = baseCtx({ services: { places: mockPlaces } });
    const result = await demandGenerators.run(ctx);
    expect(result.outputs.total_pois).toBe(5);
    expect(result.outputs.provider).toBe("osm_overpass");
    expect(Object.keys(result.outputs.category_summary).length).toBe(5);
    expect(result.outputs.category_summary.school.count).toBe(1);
    expect(result.confidence).toBe("moderate");
    expect(result.observations).toHaveLength(1);
    expect(result.cost).toBe(0); // OSM is free
  });

  it("handles service error gracefully", async () => {
    const mockPlaces = {
      providerName: "google_places",
      searchNearby: async () => {
        throw new Error("Quota exceeded");
      },
    };
    const ctx = baseCtx({ services: { places: mockPlaces } });
    const result = await demandGenerators.run(ctx);
    expect(result.confidence).toBe("insufficient");
    expect(result.outputs.error).toContain("Quota exceeded");
  });

  it("handles zero POI results", async () => {
    const mockPlaces = {
      providerName: "osm_overpass",
      searchNearby: async () => [],
    };
    const ctx = baseCtx({ services: { places: mockPlaces } });
    const result = await demandGenerators.run(ctx);
    expect(result.confidence).toBe("insufficient");
    expect(result.outputs.total_pois).toBe(0);
  });
});
