const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const BASE_URL = "https://api.mapbox.com/search/geocode/v6";

function ensureToken() {
  if (!MAPBOX_TOKEN) {
    throw new Error("VITE_MAPBOX_ACCESS_TOKEN is not configured.");
  }
}

function normalizeFeature(feature) {
  const coordinates = feature?.geometry?.coordinates || [0, 0];
  const properties = feature?.properties || {};
  const context = feature?.properties?.context || {};
  const contextText = Object.values(context)
    .map((entry) => entry?.name)
    .filter(Boolean)
    .join(", ");

  return {
    id: feature.id,
    name: properties.name || feature.properties?.full_address || feature.text || "Selected location",
    address: properties.full_address || feature.place_name || properties.name || "Unknown address",
    latitude: coordinates[1],
    longitude: coordinates[0],
    placeType: feature.properties?.feature_type || feature.place_type?.[0] || "place",
    context: contextText,
    raw: feature,
  };
}

export async function searchLocations(query) {
  ensureToken();

  const url = new URL(`${BASE_URL}/forward`);
  url.searchParams.set("q", query);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Mapbox search failed.");
  }

  const data = await response.json();
  return (data.features || []).map(normalizeFeature);
}

export async function geocodeLocation(query) {
  const results = await searchLocations(query);
  return results[0] || null;
}

export async function reverseGeocodeLocation(latitude, longitude) {
  ensureToken();

  const url = new URL(`${BASE_URL}/reverse`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Mapbox reverse geocoding failed.");
  }

  const data = await response.json();
  const feature = data.features?.[0];
  return feature ? normalizeFeature(feature) : null;
}
