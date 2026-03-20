const STORAGE_KEY = "flowmap.savedLocations";

function readSavedLocations() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSavedLocations(locations) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
}

export const savedLocationsStore = {
  list() {
    return readSavedLocations()
      .slice()
      .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
  },

  create(location) {
    const locations = readSavedLocations();
    const nextLocation = {
      ...location,
      id: crypto.randomUUID(),
      created_date: new Date().toISOString(),
    };

    locations.push(nextLocation);
    writeSavedLocations(locations);
    return nextLocation;
  },

  remove(id) {
    const locations = readSavedLocations().filter((location) => location.id !== id);
    writeSavedLocations(locations);
  },

  clear() {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
