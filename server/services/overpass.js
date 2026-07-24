// @ts-check
/**
 * Overpass (OpenStreetMap) POI service client.
 *
 * Implements the PlacesService interface expected by the demand-generators stage.
 * Uses the public Overpass API — free, no key required.
 *
 * Queries nearby amenities, shops, offices, and leisure features within
 * a given radius and maps them to the demand-generator categories.
 */

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

/**
 * Mapping from demand-generator categories to OSM tag queries.
 * Each entry produces an Overpass filter clause.
 */
const CATEGORY_OSM_MAP = {
  school: '[amenity~"school|kindergarten"]',
  university: '[amenity="university"]',
  hospital: '[amenity~"hospital|clinic"]',
  office_building: '[building="office"]',
  government: '[amenity~"townhall|courthouse|government"]',
  transit_station: '[public_transport="station"]',
  gym: '[leisure~"fitness_centre|sports_centre"]',
  church: '[amenity="place_of_worship"]',
  park: '[leisure="park"]',
  apartment_complex: '[building~"apartments|residential"]',
  hotel: '[tourism~"hotel|motel"]',
};

/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build an Overpass QL query for multiple categories around a point.
 */
function buildOverpassQuery(lat, lng, radiusM, categories) {
  const filters = categories
    .map((cat) => CATEGORY_OSM_MAP[cat])
    .filter(Boolean);

  if (filters.length === 0) return null;

  // Build union of nwr (node/way/relation) queries — compact, no extra whitespace
  const stmts = filters
    .map((f) => `nwr${f}(around:${radiusM},${lat},${lng});`)
    .join("");

  return `[out:json][timeout:25];(${stmts});out center tags 100;`;
}

/**
 * Map an OSM element to a demand-generator category.
 */
function classifyElement(el) {
  const tags = el.tags || {};

  if (tags.amenity === "school" || tags.amenity === "kindergarten") return "school";
  if (tags.amenity === "university") return "university";
  if (tags.amenity === "hospital" || tags.amenity === "clinic") return "hospital";
  if (tags.building === "office") return "office_building";
  if (["townhall", "courthouse", "government"].includes(tags.amenity)) return "government";
  if (tags.public_transport === "station") return "transit_station";
  if (tags.leisure === "fitness_centre" || tags.leisure === "sports_centre") return "gym";
  if (tags.amenity === "place_of_worship") return "church";
  if (tags.leisure === "park") return "park";
  if (tags.building === "apartments" || tags.building === "residential") return "apartment_complex";
  if (tags.tourism === "hotel" || tags.tourism === "motel") return "hotel";

  return "other";
}

/**
 * @returns {import('../pipeline/stages/demand-generators.js').PlacesService}
 */
export function createOverpassService() {
  return {
    providerName: "osm_overpass",

    async searchNearby(lat, lng, radiusM, categories) {
      const query = buildOverpassQuery(lat, lng, radiusM, categories || Object.keys(CATEGORY_OSM_MAP));

      if (!query) return [];

      const body = new URLSearchParams({ data: query });
      const res = await fetch(OVERPASS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "TrafficScout/1.0 (commercial-RE analysis)",
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Overpass API failed (${res.status}): ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const elements = data.elements || [];

      /** @type {import('../pipeline/stages/demand-generators.js').POIResult[]} */
      const results = [];

      for (const el of elements) {
        // Get coordinates — nodes have lat/lng directly; ways/relations have center
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;

        if (!Number.isFinite(elLat) || !Number.isFinite(elLng)) continue;

        const name = el.tags?.name || el.tags?.amenity || el.tags?.leisure || "unnamed";
        const category = classifyElement(el);
        const distance_m = Math.round(haversineM(lat, lng, elLat, elLng));

        results.push({
          name,
          category,
          lat: elLat,
          lng: elLng,
          distance_m,
          source_id: `osm:${el.type}/${el.id}`,
        });
      }

      // Sort by distance
      results.sort((a, b) => a.distance_m - b.distance_m);

      return results;
    },
  };
}
