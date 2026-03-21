import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Crosshair, MapPinned, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import LocationMap from "@/components/analysis/LocationMap";
import AnalysisPanel from "@/components/analysis/AnalysisPanel";
import { savedLocationsStore } from "@/lib/saved-locations";
import { geocodeLocation, reverseGeocodeLocation, searchLocations } from "@/lib/mapbox";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/AuthContext";

export default function Analyze() {
  const { currentUser, refreshProfile } = useAuth();
  const [query, setQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [marker, setMarker] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || selectedLocation?.address === query) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await searchLocations(query.trim());
        setSuggestions(results);
      } catch (error) {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query, selectedLocation]);

  const analyzeResolvedLocation = async (location) => {
    setIsAnalyzing(true);
    setAnalysisData(null);
    setSelectedLocation(location);
    setMarker({ lat: location.latitude, lng: location.longitude, name: location.name });

    try {
      const response = await apiFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ location }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await refreshProfile?.();
        }
        throw new Error(payload.error || "Analysis failed.");
      }

      setAnalysisData(payload);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not analyze that location.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    try {
      const location = selectedLocation?.address === query ? selectedLocation : await geocodeLocation(query.trim());
      if (!location) {
        toast.error("No matching location found.");
        return;
      }

      setQuery(location.address);
      setSuggestions([]);
      await analyzeResolvedLocation(location);
    } catch (error) {
      toast.error(error.message || "Location lookup failed.");
    }
  };

  const handleSuggestionSelect = async (location) => {
    setQuery(location.address);
    setSuggestions([]);
    setIsFocused(false);
    await analyzeResolvedLocation(location);
  };

  const handleMapClick = async (latlng) => {
    try {
      const location = await reverseGeocodeLocation(latlng.lat, latlng.lng);
      if (!location) {
        toast.error("Could not identify that map location.");
        return;
      }

      setQuery(location.address);
      setSuggestions([]);
      await analyzeResolvedLocation(location);
    } catch (error) {
      toast.error(error.message || "Reverse geocoding failed.");
    }
  };

  const handleSave = async () => {
    if (!analysisData) return;
    setIsSaving(true);

    try {
      await savedLocationsStore.create(analysisData, currentUser.id);
      toast.success("Location saved successfully.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasMapboxToken = Boolean(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3">
        {!hasMapboxToken && (
          <div className="max-w-2xl mx-auto mb-3 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Add `VITE_MAPBOX_ACCESS_TOKEN` and `OPENAI_API_KEY` in `.env.local` to enable live search and analysis.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search an address, neighborhood, or city..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedLocation(null);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => window.setTimeout(() => setIsFocused(false), 150)}
              className="pl-10 bg-background"
            />

            {isFocused && (suggestions.length > 0 || isSearching) && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                {isSearching && (
                  <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching Mapbox...
                  </div>
                )}

                {!isSearching &&
                  suggestions.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => handleSuggestionSelect(location)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <MapPinned className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{location.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{location.address}</p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <Button type="submit" disabled={isAnalyzing || !query.trim()}>
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
          </Button>
        </form>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="h-[40vh] md:h-full md:flex-1 relative">
          <LocationMap
            center={marker ? [marker.lat, marker.lng] : [40.7128, -74.006]}
            marker={marker}
            onMapClick={handleMapClick}
            trafficScore={analysisData?.traffic_score}
          />

          <AnimatePresence>
            {!analysisData && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-lg"
              >
                <Crosshair className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">
                  Search with Mapbox or click the map to analyze a location
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isAnalyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Analyzing with GPT-5-mini</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Combining Mapbox location data with an OpenAI analysis pass...
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {analysisData && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              className="md:w-[440px] lg:w-[500px] border-l border-border bg-background overflow-hidden flex-shrink-0"
            >
              <AnalysisPanel data={analysisData} onSave={handleSave} isSaving={isSaving} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
