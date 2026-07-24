// @ts-check
/**
 * Mapbox service clients: geocoding and isochrone.
 *
 * Implements the service interfaces expected by the pipeline stages:
 *   - GeocodingService (geo-enrichment stage)
 *   - IsochroneService (trade-area stage)
 *
 * Reads the token from process.env.VITE_MAPBOX_ACCESS_TOKEN (shared with
 * the client-side Vite config). Returns null from factory functions if the
 * token is not configured — stages degrade gracefully.
 */

const GEOCODING_BASE = "https://api.mapbox.com/search/geocode/v6/forward";
const ISOCHRONE_BASE = "https://api.mapbox.com/isochrone/v1/mapbox/driving";

/**
 * Create a geocoding service that calls the Mapbox Geocoding v6 API.
 *
 * @returns {import('../pipeline/stages/geo-enrichment.js').GeocodingService | null}
 */
export function createGeocodingService() {
  const token = process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  return {
    async geocode(address) {
      const url = new URL(GEOCODING_BASE);
      url.searchParams.set("q", address);
      url.searchParams.set("access_token", token);
      url.searchParams.set("limit", "1");
      url.searchParams.set("types", "address,place");

      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Mapbox geocoding failed (${res.status}): ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return null;

      const [lng, lat] = feature.geometry.coordinates;
      return {
        lat,
        lng,
        place_name: feature.properties?.full_address || feature.properties?.name || address,
        relevance: feature.properties?.match_code?.confidence === "exact" ? 1.0
          : feature.properties?.match_code?.confidence === "high" ? 0.9
          : feature.properties?.match_code?.confidence === "medium" ? 0.7
          : 0.5,
      };
    },
  };
}

/**
 * Create an isochrone service that calls the Mapbox Isochrone API.
 *
 * @returns {import('../pipeline/stages/trade-area.js').IsochroneService | null}
 */
export function createIsochroneService() {
  const token = process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  return {
    async getIsochrone(lat, lng, minutes) {
      // Mapbox Isochrone API: /isochrone/v1/{profile}/{coordinates}
      const url = new URL(`${ISOCHRONE_BASE}/${lng},${lat}`);
      url.searchParams.set("contours_minutes", String(minutes));
      url.searchParams.set("polygons", "true");
      url.searchParams.set("access_token", token);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Mapbox isochrone failed (${res.status}): ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      // Returns a FeatureCollection with one Feature per contour
      const feature = data.features?.[0];
      return feature || null;
    },
  };
}
