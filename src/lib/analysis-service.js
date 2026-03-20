const POI_TYPES = ["transit", "restaurant", "retail", "office", "school", "landmark", "park"];
const STREET_NAMES = ["Broadway", "Market Street", "Main Street", "River Road", "Union Ave", "Maple Street"];
const PLACE_TYPES = ["District", "Square", "Station", "Center", "Commons", "Corridor"];

function hashString(value) {
  return [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 2147483647, 7);
}

function seededValue(seed, offset, min, max) {
  const next = Math.abs(Math.sin(seed * (offset + 1)) * 10000) % 1;
  return min + next * (max - min);
}

function titleCaseWords(value) {
  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function deriveLocationName(query, seed) {
  const cleaned = titleCaseWords(query.replace(/^location at coordinates/i, "").trim());
  if (cleaned) {
    return cleaned;
  }

  return `FlowMap ${PLACE_TYPES[seed % PLACE_TYPES.length]}`;
}

function deriveCoordinates(query, seed) {
  const coordMatch = query.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (coordMatch) {
    return {
      latitude: Number(coordMatch[1]),
      longitude: Number(coordMatch[2]),
    };
  }

  return {
    latitude: Number((seededValue(seed, 1, 34.05, 47.65)).toFixed(5)),
    longitude: Number((-seededValue(seed, 2, 73.9, 122.4)).toFixed(5)),
  };
}

function buildHourlyPattern(seed) {
  return Array.from({ length: 18 }, (_, index) => {
    const hour = index + 6;
    const rushBoost = hour >= 8 && hour <= 10 ? 18 : hour >= 17 && hour <= 19 ? 22 : 0;
    const baseline = 35 + Math.round(seededValue(seed, index + 10, 0, 30));
    return {
      hour: `${((hour + 11) % 12) + 1}${hour >= 12 ? "PM" : "AM"}`,
      traffic: baseline + rushBoost,
    };
  });
}

function buildDailyPattern(seed) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => {
    const weekendBoost = index >= 5 ? 10 : 0;
    return {
      day,
      traffic: 55 + Math.round(seededValue(seed, index + 40, 0, 35)) + weekendBoost,
    };
  });
}

function buildDemographics(seed) {
  const commuters = 20 + Math.round(seededValue(seed, 60, 0, 35));
  const residents = 15 + Math.round(seededValue(seed, 61, 0, 30));
  const tourists = 5 + Math.round(seededValue(seed, 62, 0, 20));
  const shoppers = Math.max(5, 100 - commuters - residents - tourists);

  return { commuters, residents, tourists, shoppers };
}

function buildPois(name, seed) {
  return Array.from({ length: 5 }, (_, index) => ({
    name: `${name.split(" ")[0] || "Central"} ${PLACE_TYPES[(seed + index) % PLACE_TYPES.length]}`,
    type: POI_TYPES[(seed + index) % POI_TYPES.length],
    distance: `${Math.round(seededValue(seed, 70 + index, 150, 1200))} ft`,
  }));
}

export async function analyzeLocation(query) {
  const normalizedQuery = query.trim();
  const seed = hashString(normalizedQuery.toLowerCase());
  const name = deriveLocationName(normalizedQuery, seed);
  const { latitude, longitude } = deriveCoordinates(normalizedQuery, seed);
  const peak_hours = buildHourlyPattern(seed);
  const daily_pattern = buildDailyPattern(seed);
  const demographics = buildDemographics(seed);
  const estimated_daily_foot_traffic = Math.round(seededValue(seed, 90, 1800, 12500));
  const traffic_score = Math.min(98, Math.max(32, Math.round(estimated_daily_foot_traffic / 140)));
  const business_suitability =
    traffic_score >= 80 ? "excellent" : traffic_score >= 65 ? "good" : traffic_score >= 50 ? "moderate" : "low";

  return {
    name,
    address: `${100 + (seed % 800)} ${STREET_NAMES[seed % STREET_NAMES.length]}`,
    latitude,
    longitude,
    traffic_score,
    peak_hours,
    daily_pattern,
    nearby_pois: buildPois(name, seed),
    demographics,
    estimated_daily_foot_traffic,
    business_suitability,
    notes: "Generated locally from your search input.",
  };
}
