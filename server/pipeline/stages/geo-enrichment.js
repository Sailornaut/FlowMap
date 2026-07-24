// @ts-check
/**
 * Stage 2: Geo-Enrichment
 *
 * Confirms or obtains geocoded coordinates via Mapbox Geocoding API
 * (token already provisioned for the app). Records source observations
 * for provenance.
 *
 * If the property already has valid coordinates, this stage confirms them
 * and records the confirmation. If coordinates are missing, it geocodes
 * the address.
 *
 * This stage does NOT fabricate data — it calls a real geocoding service
 * and records the response with full provenance.
 */

export const STAGE_NAME = "geo-enrichment";
export const STAGE_VERSION = "1.0.0";

/**
 * @typedef {Object} GeocodingService
 * @property {(address: string) => Promise<{lat: number, lng: number, place_name: string, relevance: number} | null>} geocode
 */

/**
 * Build an address string from property fields.
 * @param {object} property
 * @returns {string}
 */
function buildAddressString(property) {
  const parts = [
    property.address,
    property.city,
    property.state,
    property.postal_code,
  ].filter(Boolean);
  return parts.join(", ");
}

/** @type {import('../runner.js').StageDefinition} */
const stage = {
  name: STAGE_NAME,
  version: STAGE_VERSION,
  async run(ctx) {
    const { property, services } = ctx;
    const observations = [];
    const outputs = {
      geocode_source: "none",
      lat: property.lat ?? null,
      lng: property.lng ?? null,
      place_name: null,
      relevance: null,
      confirmed: false,
    };

    // Check if validation stage passed
    const validationOutputs = ctx.stageOutputs["property-validation"];
    const hasCoords = Number.isFinite(property.lat) && Number.isFinite(property.lng);

    if (hasCoords) {
      outputs.geocode_source = "existing";
      outputs.confirmed = true;
      outputs.lat = property.lat;
      outputs.lng = property.lng;

      return {
        outputs,
        observations,
        confidence: "high",
        completeness: 1,
        cost: 0,
      };
    }

    // Need to geocode — requires a geocoding service
    const geocoder = services?.geocoding;
    if (!geocoder) {
      return {
        outputs: {
          ...outputs,
          geocode_source: "unavailable",
          error: "Geocoding service not configured",
        },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    const address = buildAddressString(property);
    if (!address || address.trim().length < 5) {
      return {
        outputs: {
          ...outputs,
          geocode_source: "failed",
          error: "Insufficient address information for geocoding",
        },
        observations,
        confidence: "insufficient",
        completeness: 0,
        cost: 0,
      };
    }

    try {
      const result = await geocoder.geocode(address);
      if (!result) {
        return {
          outputs: {
            ...outputs,
            geocode_source: "failed",
            error: "Geocoding returned no results for: " + address,
          },
          observations,
          confidence: "insufficient",
          completeness: 0,
          cost: 0.005, // Mapbox charges per request regardless
        };
      }

      outputs.geocode_source = "mapbox";
      outputs.lat = result.lat;
      outputs.lng = result.lng;
      outputs.place_name = result.place_name;
      outputs.relevance = result.relevance;
      outputs.confirmed = result.relevance >= 0.8;

      observations.push({
        source_name: "mapbox_geocoding",
        source_kind: "api",
        source_url_or_id: `mapbox:geocode:${encodeURIComponent(address)}`,
        retrieved_at: new Date().toISOString(),
        raw_value: { lat: result.lat, lng: result.lng, place_name: result.place_name, relevance: result.relevance },
        normalized_value: { lat: result.lat, lng: result.lng },
        unit: "coordinates",
        confidence: result.relevance >= 0.8 ? "high" : result.relevance >= 0.5 ? "moderate" : "preliminary",
        reliability_tier: 2, // Mapbox is a reliable, authoritative source
      });

      let confidence;
      if (result.relevance >= 0.8) confidence = "high";
      else if (result.relevance >= 0.5) confidence = "moderate";
      else confidence = "preliminary";

      return {
        outputs,
        observations,
        confidence,
        completeness: 1,
        cost: 0.005,
      };
    } catch (err) {
      return {
        outputs: {
          ...outputs,
          geocode_source: "error",
          error: err instanceof Error ? err.message : String(err),
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
