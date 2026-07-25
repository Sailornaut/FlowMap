// @ts-check
/**
 * Census/ACS service client.
 *
 * Implements the CensusService interface expected by the demographics stage:
 *   - getTract(lat, lng) — returns FIPS codes via Census Geocoder (free, no key)
 *   - getACSData(state, county, tract, variables) — returns ACS 5-year data
 *
 * The ACS data API requires a free API key since mid-2025.
 * Sign up at https://api.census.gov/data/key_signup.html
 * Set CENSUS_API_KEY in your env file.
 *
 * Without a key, getTract still works but getACSData will fail.
 * The demographics stage degrades gracefully to "insufficient" confidence.
 */

const GEOCODER_BASE = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const ACS_BASE = "https://api.census.gov/data";

// ACS 5-year datasets to try, in preference order.
// Census retires older years; we fall through to the next.
const ACS_YEARS = ["2023", "2022", "2021"];
const ACS_SUFFIX = "acs/acs5";

/**
 * @returns {import('../pipeline/stages/demographics.js').CensusService | null}
 */
export function createCensusService() {
  const apiKey = process.env.CENSUS_API_KEY || "";

  return {
    async getTract(lat, lng) {
      const url = new URL(GEOCODER_BASE);
      url.searchParams.set("x", String(lng));
      url.searchParams.set("y", String(lat));
      url.searchParams.set("benchmark", "Public_AR_Current");
      url.searchParams.set("vintage", "Current_Current");
      url.searchParams.set("format", "json");

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Census geocoder failed (${res.status})`);
      }

      const data = await res.json();
      const geographies = data?.result?.geographies;

      // The response includes "Census Tracts" (or "2020 Census Blocks" etc.)
      const tracts = geographies?.["Census Tracts"] || geographies?.["2020 Census Blocks"];
      const tract = tracts?.[0];

      if (!tract) return null;

      return {
        state_fips: tract.STATE,
        county_fips: tract.COUNTY,
        tract: tract.TRACT,
        block_group: tract.BLKGRP || null,
      };
    },

    async getACSData(state_fips, county_fips, tract, variables) {
      const varList = variables.join(",");

      // Try each ACS year until one responds with valid JSON.
      // Census retires older years and the exact cutover date is unpredictable.
      let lastError;
      for (const year of ACS_YEARS) {
        const params = new URLSearchParams();
        params.set("get", varList);
        params.set("for", `tract:${tract}`);
        params.set("in", `state:${state_fips} county:${county_fips}`);
        if (apiKey) params.set("key", apiKey);

        const url = `${ACS_BASE}/${year}/${ACS_SUFFIX}?${params.toString()}`;
        const res = await fetch(url);

        // Non-JSON responses (HTML error pages) mean the dataset year is
        // unavailable or the key is missing/invalid.
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
          lastError = new Error(`Census ACS ${year} returned non-JSON (${contentType.split(";")[0]}). Is CENSUS_API_KEY set?`);
          continue;
        }

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          lastError = new Error(`Census ACS ${year} failed (${res.status}): ${body.slice(0, 200)}`);
          continue;
        }

        const rows = await res.json();
        // Response is [[header1, header2, ...], [value1, value2, ...]]
        if (!rows || rows.length < 2) {
          lastError = new Error(`Census ACS ${year} returned empty result`);
          continue;
        }

        const headers = rows[0];
        const values = rows[1];

        /** @type {Record<string, number | null>} */
        const result = {};
        for (let i = 0; i < headers.length; i++) {
          const key = headers[i];
          // Skip geographic identifier columns
          if (["state", "county", "tract"].includes(key)) continue;
          const val = values[i];
          result[key] = val !== null && val !== "" && val !== "-666666666"
            ? Number(val)
            : null;
        }

        // Attach metadata for provenance — which dataset year actually responded
        result._acs_year = year;
        result._acs_dataset = `${ACS_SUFFIX}`;

        return result;
      }

      throw lastError || new Error("Census ACS: no dataset year responded");
    },
  };
}
