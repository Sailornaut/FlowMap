// @ts-check
/**
 * Live service integration tests.
 *
 * Run locally (NOT in CI/sandbox) to verify live API connectivity:
 *   node --input-type=module < server/__tests__/live-services.test.js
 *
 * Or with dotenv preloaded:
 *   node -e "require('dotenv').config({path:'trafficscout-api.env'})" && node --input-type=module < server/__tests__/live-services.test.js
 *
 * Requires: trafficscout-api.env with VITE_MAPBOX_ACCESS_TOKEN
 * Census and Overpass are free/keyless.
 */

import dotenv from "dotenv";
dotenv.config({ path: "trafficscout-api.env" });
dotenv.config({ path: ".env.local" });
dotenv.config();

import { createGeocodingService, createIsochroneService } from "../services/mapbox.js";
import { createCensusService } from "../services/census.js";
import { createOverpassService } from "../services/overpass.js";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log("  ✓", msg); }
  else { failed++; console.error("  ✗", msg); }
}

// Test address: a well-known strip center
const TEST_ADDRESS = "8530 SW Barbur Blvd, Portland, OR 97219";

console.log("=== Mapbox Geocoding ===");
const geocoder = createGeocodingService();
assert(geocoder !== null, "geocoder created (token present)");

let lat, lng;
if (geocoder) {
  try {
    const result = await geocoder.geocode(TEST_ADDRESS);
    assert(result !== null, "geocoding returned a result");
    assert(Number.isFinite(result?.lat), `lat is finite: ${result?.lat}`);
    assert(Number.isFinite(result?.lng), `lng is finite: ${result?.lng}`);
    assert(result?.relevance > 0, `relevance > 0: ${result?.relevance}`);
    console.log("  place_name:", result?.place_name);
    lat = result?.lat;
    lng = result?.lng;
  } catch (err) {
    failed++;
    console.error("  ✗ geocoding threw:", err.message);
  }
}

console.log("\n=== Mapbox Isochrone ===");
const isochrone = createIsochroneService();
assert(isochrone !== null, "isochrone service created");

if (isochrone && lat && lng) {
  try {
    const feature = await isochrone.getIsochrone(lat, lng, 5);
    assert(feature !== null, "5-min isochrone returned a feature");
    assert(feature?.geometry?.type === "Polygon" || feature?.geometry?.type === "MultiPolygon",
      `geometry type: ${feature?.geometry?.type}`);
    const verts = feature?.geometry?.coordinates?.[0]?.length || 0;
    assert(verts > 3, `polygon has ${verts} vertices`);
  } catch (err) {
    failed++;
    console.error("  ✗ isochrone threw:", err.message);
  }
}

console.log("\n=== Census Geocoder + ACS ===");
const census = createCensusService();
assert(census !== null, "census service created");

if (census && lat && lng) {
  try {
    const tract = await census.getTract(lat, lng);
    assert(tract !== null, "census tract resolved");
    assert(tract?.state_fips?.length === 2, `state_fips: ${tract?.state_fips}`);
    assert(tract?.county_fips?.length === 3, `county_fips: ${tract?.county_fips}`);
    assert(tract?.tract?.length >= 4, `tract: ${tract?.tract}`);
    console.log("  FIPS:", tract?.state_fips + tract?.county_fips + tract?.tract);

    if (tract) {
      const vars = ["B01001_001E", "B19013_001E", "B01002_001E"];
      const acs = await census.getACSData(tract.state_fips, tract.county_fips, tract.tract, vars);
      assert(acs !== null, "ACS data returned");
      assert("B01001_001E" in (acs || {}), "total population present");
      console.log("  population:", acs?.["B01001_001E"]);
      console.log("  median income:", acs?.["B19013_001E"]);
      console.log("  median age:", acs?.["B01002_001E"]);
    }
  } catch (err) {
    failed++;
    console.error("  ✗ census threw:", err.message);
  }
}

console.log("\n=== Overpass POI ===");
const places = createOverpassService();
assert(places !== null, "overpass service created");
assert(places?.providerName === "osm_overpass", "provider is osm_overpass");

if (places && lat && lng) {
  try {
    const pois = await places.searchNearby(lat, lng, 1000, ["school", "church", "park", "gym"]);
    assert(Array.isArray(pois), "searchNearby returns array");
    assert(pois.length > 0, `found ${pois.length} POIs within 1km`);
    if (pois.length > 0) {
      assert(typeof pois[0].name === "string", "POI has name");
      assert(typeof pois[0].category === "string", "POI has category");
      assert(Number.isFinite(pois[0].distance_m), "POI has distance_m");
      console.log("  sample:", pois[0].name, `(${pois[0].category}, ${pois[0].distance_m}m)`);
      console.log("  total:", pois.length);
    }
  } catch (err) {
    failed++;
    console.error("  ✗ overpass threw:", err.message);
  }
}

console.log("\n" + "=".repeat(50));
console.log("Results:", passed, "passed,", failed, "failed");
if (failed > 0) process.exit(1);
console.log("✓ All live service integrations verified");
