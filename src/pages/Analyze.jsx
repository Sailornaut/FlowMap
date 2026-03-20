import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, MapPin, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import LocationMap from "@/components/analysis/LocationMap";
import AnalysisPanel from "@/components/analysis/AnalysisPanel";

export default function Analyze() {
  const [query, setQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [marker, setMarker] = useState(null);

  const analyzeLocation = async (locationQuery) => {
    if (!locationQuery.trim()) return;
    setIsAnalyzing(true);
    setAnalysisData(null);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a foot traffic analysis expert. Analyze the following location for potential business placement: "${locationQuery}".

Provide realistic, data-driven estimates based on the type of area (urban downtown, suburban, commercial district, etc.), known nearby landmarks, transit access, and general area characteristics.

Return comprehensive foot traffic data including:
- A name for the location
- Full address
- Latitude and longitude coordinates
- Overall foot traffic score (0-100)
- Hourly traffic estimates for a typical weekday (6 AM to 11 PM), with hour labels like "6AM", "7AM", etc.
- Daily traffic pattern for each day of the week (Mon through Sun)
- Nearby points of interest (at least 5) with name, type (transit/restaurant/retail/office/school/landmark/park), and distance
- Demographic breakdown (commuters %, residents %, tourists %, shoppers %) that sums to 100
- Estimated daily foot traffic count
- Business suitability rating: excellent, good, moderate, or low`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          traffic_score: { type: "number" },
          peak_hours: {
            type: "array",
            items: {
              type: "object",
              properties: {
                hour: { type: "string" },
                traffic: { type: "number" }
              }
            }
          },
          daily_pattern: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "string" },
                traffic: { type: "number" }
              }
            }
          },
          nearby_pois: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string" },
                distance: { type: "string" }
              }
            }
          },
          demographics: {
            type: "object",
            properties: {
              commuters: { type: "number" },
              residents: { type: "number" },
              tourists: { type: "number" },
              shoppers: { type: "number" }
            }
          },
          estimated_daily_foot_traffic: { type: "number" },
          business_suitability: { type: "string" }
        }
      }
    });

    setAnalysisData(result);
    setMarker({ lat: result.latitude, lng: result.longitude, name: result.name });
    setIsAnalyzing(false);
  };

  const handleMapClick = (latlng) => {
    const q = `Location at coordinates ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    setQuery(q);
    analyzeLocation(q);
  };

  const handleSave = async () => {
    if (!analysisData) return;
    setIsSaving(true);
    await base44.entities.SavedLocation.create(analysisData);
    toast.success("Location saved successfully!");
    setIsSaving(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    analyzeLocation(query);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search bar */}
      <div className="bg-card border-b border-border px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search an address, neighborhood, or city..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <Button type="submit" disabled={isAnalyzing || !query.trim()}>
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Analyze"
            )}
          </Button>
        </form>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="h-[40vh] md:h-full md:flex-1 relative">
          <LocationMap
            center={marker ? [marker.lat, marker.lng] : [40.7128, -74.006]}
            marker={marker}
            onMapClick={handleMapClick}
            trafficScore={analysisData?.traffic_score}
          />
          {/* Overlay instruction */}
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
                  Click on the map or search to analyze
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Loading overlay */}
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
                  <p className="text-sm font-semibold">Analyzing Location</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gathering traffic data & nearby points of interest...
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Analysis panel */}
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