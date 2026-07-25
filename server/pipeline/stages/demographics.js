// @ts-check
/**
 * Stage 4: Demographics
 *
 * Fetches demographic data from Census/ACS for the trade area.
 * Census/ACS is free and authoritative (reliability tier 1).
 *
 * Requires trade-area stage output (to know the geographic scope).
 * Falls back to point-based lookup (by tract) if no trade area available.
 *
 * Produces structured demographic summary with full provenance.
 */

export const STAGE_NAME = "demographics";
export const STAGE_VERSION = "1.0.0";

/**
 * ACS variables we request. These are standard 5-year ACS table codes.
 */
const ACS_VARIABLES = {
  total_population: "B01001_001E",
  median_household_income: "B19013_001E",
  median_age: "B01002_001E",
  total_households: "B11001_001E",
  family_households: "B11001_002E",
  owner_occupied_housing: "B25003_002E",
  renter_occupied_housing: "B25003_003E",
  total_housing_units: "B25001_001E",
};

/**
 * @typedef {Object} CensusService
 * @property {(lat: number, lng: number) => Promise<{state_fips: string, county_fips: string, tract: string, block_group: string} | null>} getTract
 * @property {(state_fips: string, county_fips: string, tract: string, variables: string[]) => Promise<Record<string, number | null> | null>} getACSData
 */

/** @type {import('../runner.js').StageDefinition} */
const stage = {
  name: STAGE_NAME,
  version: STAGE_VERSION,
  depths: ["standard", "full"], // skipped in teaser
  async run(ctx) {
    const { property, services } = ctx;
    const observations = [];

    // Get coordinates
    const geoOutputs = ctx.stageOutputs["geo-enrichment"];
    const lat = geoOutputs?.lat ?? property.lat;
    const lng = geoOutputs?.lng ?? property.lng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        outputs: { error: "No valid coordinates for demographic lookup", demographics: null },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const census = services?.census;
    if (!census) {
      return {
        outputs: { error: "Census service not configured", demographics: null },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    try {
      // Step 1: Get census tract for the property location
      const tract = await census.getTract(lat, lng);
      if (!tract) {
        return {
          outputs: {
            error: "Could not determine census tract for coordinates",
            demographics: null,
          },
          observations,
          confidence: "insufficient",
          completeness: 0,
          cost: 0,
        };
      }

      observations.push({
        source_name: "census_geocoder",
        source_kind: "api",
        source_url_or_id: `census:tract:${tract.state_fips}${tract.county_fips}${tract.tract}`,
        retrieved_at: new Date().toISOString(),
        raw_value: tract,
        normalized_value: { tract_fips: `${tract.state_fips}${tract.county_fips}${tract.tract}` },
        unit: "census_tract",
        confidence: "high",
        reliability_tier: 1, // Census is authoritative
      });

      // Step 2: Get ACS data for the tract
      const variableCodes = Object.values(ACS_VARIABLES);
      const acsData = await census.getACSData(
        tract.state_fips,
        tract.county_fips,
        tract.tract,
        variableCodes
      );

      if (!acsData) {
        return {
          outputs: {
            tract_fips: `${tract.state_fips}${tract.county_fips}${tract.tract}`,
            error: "ACS data unavailable for this tract",
            demographics: null,
          },
          observations,
          confidence: "preliminary",
          completeness: 0.2,
          cost: 0,
        };
      }

      // Extract provenance metadata before mapping
      const acsYear = acsData._acs_year || "unknown";
      const acsDataset = acsData._acs_dataset || "acs/acs5";

      // Map variable codes back to readable names
      const demographics = {};
      let presentCount = 0;
      for (const [name, code] of Object.entries(ACS_VARIABLES)) {
        const value = acsData[code];
        demographics[name] = value ?? null;
        if (value !== null && value !== undefined) presentCount++;
      }

      // Compute derived metrics
      if (demographics.family_households && demographics.total_households) {
        demographics.family_household_pct = Math.round(
          (demographics.family_households / demographics.total_households) * 100
        );
      }
      if (demographics.renter_occupied_housing && demographics.total_housing_units) {
        demographics.renter_pct = Math.round(
          (demographics.renter_occupied_housing / demographics.total_housing_units) * 100
        );
      }

      observations.push({
        source_name: "census_acs_5yr",
        source_kind: "api",
        source_url_or_id: `census:acs5:${acsYear}:${tract.state_fips}${tract.county_fips}${tract.tract}`,
        retrieved_at: new Date().toISOString(),
        raw_value: acsData,
        normalized_value: demographics,
        unit: "demographic_summary",
        confidence: "high",
        reliability_tier: 1,
      });

      const completeness = presentCount / Object.keys(ACS_VARIABLES).length;

      return {
        outputs: {
          tract_fips: `${tract.state_fips}${tract.county_fips}${tract.tract}`,
          demographics,
          geographic_scope: "tract",
          acs_year: acsYear,
          acs_dataset: acsDataset,
          data_year: `ACS 5-year ${acsYear}`,
        },
        observations,
        confidence: completeness >= 0.7 ? "high" : completeness >= 0.4 ? "moderate" : "preliminary",
        completeness,
        cost: 0, // Census API is free
      };
    } catch (err) {
      return {
        outputs: {
          error: err instanceof Error ? err.message : String(err),
          demographics: null,
        },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }
  },
};

export default stage;
