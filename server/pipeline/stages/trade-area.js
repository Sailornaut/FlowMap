// @ts-check
/**
 * Stage 3: Trade Area
 *
 * Generates drive-time isochrone polygons via Mapbox Isochrone API.
 * Records source observations for provenance.
 *
 * Requires valid coordinates from geo-enrichment stage.
 * Produces GeoJSON trade area polygons at configurable drive-time intervals.
 */

export const STAGE_NAME = "trade-area";
export const STAGE_VERSION = "1.0.0";

/** Default drive-time minutes for isochrones. */
const DEFAULT_DRIVE_TIMES = [5, 10, 15];

/**
 * @typedef {Object} IsochroneService
 * @property {(lat: number, lng: number, minutes: number) => Promise<object | null>} getIsochrone
 *   Returns a GeoJSON Feature or null on failure.
 */

/** @type {import('../runner.js').StageDefinition} */
const stage = {
  name: STAGE_NAME,
  version: STAGE_VERSION,
  async run(ctx) {
    const { property, services, config } = ctx;
    const observations = [];

    // Get coordinates — prefer geo-enrichment output, fall back to property
    const geoOutputs = ctx.stageOutputs["geo-enrichment"];
    const lat = geoOutputs?.lat ?? property.lat;
    const lng = geoOutputs?.lng ?? property.lng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        outputs: {
          error: "No valid coordinates available — geo-enrichment stage must run first",
          trade_areas: [],
        },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const isochroneService = services?.isochrone;
    if (!isochroneService) {
      return {
        outputs: {
          error: "Isochrone service not configured",
          trade_areas: [],
          coordinates: { lat, lng },
        },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const driveTimes = config?.driveTimes || DEFAULT_DRIVE_TIMES;
    const tradeAreas = [];
    let totalCost = 0;
    let successCount = 0;

    for (const minutes of driveTimes) {
      try {
        const geojson = await isochroneService.getIsochrone(lat, lng, minutes);
        if (geojson) {
          tradeAreas.push({
            method: "drive_time",
            minutes,
            geometry: geojson,
          });

          observations.push({
            source_name: "mapbox_isochrone",
            source_kind: "api",
            source_url_or_id: `mapbox:isochrone:${lat},${lng}:${minutes}min`,
            retrieved_at: new Date().toISOString(),
            raw_value: geojson,
            normalized_value: { method: "drive_time", minutes },
            unit: "geojson_polygon",
            confidence: "high",
            reliability_tier: 2,
          });

          successCount++;
          totalCost += 0.01; // Mapbox isochrone pricing
        }
      } catch (err) {
        // Isolated failure — record but continue
        tradeAreas.push({
          method: "drive_time",
          minutes,
          geometry: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let confidence;
    if (successCount === driveTimes.length) confidence = "high";
    else if (successCount > 0) confidence = "moderate";
    else confidence = "insufficient";

    return {
      outputs: {
        coordinates: { lat, lng },
        trade_areas: tradeAreas,
        drive_times_requested: driveTimes,
        drive_times_succeeded: successCount,
      },
      observations,
      confidence,
      completeness: driveTimes.length > 0 ? successCount / driveTimes.length : 0,
      cost: totalCost,
    };
  },
};

export default stage;
