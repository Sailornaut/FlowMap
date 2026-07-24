// @ts-check
/**
 * Stage 6: Demand Generators
 *
 * Retrieves nearby points of interest (POIs) that generate foot traffic
 * near the property. Uses a pluggable places service (OSM/Overture,
 * Google Places, Foursquare).
 *
 * Requires valid coordinates from geo-enrichment.
 * Produces categorized POI summary with distance and source provenance.
 *
 * This stage does NOT fabricate POI data — it records exactly what the
 * service returns.
 */

export const STAGE_NAME = "demand-generators";
export const STAGE_VERSION = "1.0.0";

/** Search radius in meters. */
const DEFAULT_RADIUS_M = 1600; // ~1 mile

/** POI categories relevant to CRE demand analysis. */
const DEMAND_CATEGORIES = [
  "school",
  "university",
  "hospital",
  "office_building",
  "government",
  "transit_station",
  "gym",
  "church",
  "park",
  "apartment_complex",
  "hotel",
];

/**
 * @typedef {Object} PlacesService
 * @property {(lat: number, lng: number, radiusM: number, categories?: string[]) => Promise<POIResult[]>} searchNearby
 * @property {string} providerName   e.g. "osm", "google_places", "foursquare"
 */

/**
 * @typedef {Object} POIResult
 * @property {string} name
 * @property {string} category
 * @property {number} lat
 * @property {number} lng
 * @property {number} distance_m
 * @property {string} [source_id]
 */

/** @type {import('../runner.js').StageDefinition} */
const stage = {
  name: STAGE_NAME,
  version: STAGE_VERSION,
  depths: ["standard", "full"],
  async run(ctx) {
    const { property, services, config } = ctx;
    const observations = [];

    const geoOutputs = ctx.stageOutputs["geo-enrichment"];
    const lat = geoOutputs?.lat ?? property.lat;
    const lng = geoOutputs?.lng ?? property.lng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        outputs: { error: "No valid coordinates for POI search", pois: [] },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const places = services?.places;
    if (!places) {
      return {
        outputs: { error: "Places service not configured", pois: [] },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const radiusM = config?.poiRadiusM || DEFAULT_RADIUS_M;

    try {
      const pois = await places.searchNearby(lat, lng, radiusM, DEMAND_CATEGORIES);

      // Group by category
      const byCat = {};
      for (const poi of pois) {
        const cat = poi.category || "other";
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(poi);
      }

      // Summary: count per category, closest per category
      const categorySummary = {};
      for (const [cat, items] of Object.entries(byCat)) {
        const sorted = items.sort((a, b) => a.distance_m - b.distance_m);
        categorySummary[cat] = {
          count: items.length,
          closest_name: sorted[0].name,
          closest_distance_m: sorted[0].distance_m,
        };
      }

      observations.push({
        source_name: places.providerName,
        source_kind: "api",
        source_url_or_id: `${places.providerName}:nearby:${lat},${lng}:${radiusM}m`,
        retrieved_at: new Date().toISOString(),
        raw_value: { total_pois: pois.length, categories: Object.keys(byCat) },
        normalized_value: categorySummary,
        unit: "poi_summary",
        confidence: pois.length > 0 ? "moderate" : "preliminary",
        reliability_tier: places.providerName === "osm_overpass" ? 3 : 2,
      });

      const completeness = pois.length > 0 ? Math.min(1, pois.length / 10) : 0;

      return {
        outputs: {
          provider: places.providerName,
          search_radius_m: radiusM,
          total_pois: pois.length,
          category_summary: categorySummary,
          pois: pois.slice(0, 50), // Cap raw list for storage
        },
        observations,
        confidence: pois.length >= 5 ? "moderate" : pois.length > 0 ? "preliminary" : "insufficient",
        completeness,
        cost: places.providerName === "osm_overpass" ? 0 : 0.01 * Math.ceil(pois.length / 20),
      };
    } catch (err) {
      return {
        outputs: {
          error: err instanceof Error ? err.message : String(err),
          pois: [],
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
