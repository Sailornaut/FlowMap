import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import LocationMap from "@/components/analysis/LocationMap";
import AnalysisPanel from "@/components/analysis/AnalysisPanel";
import { analyzeLocation as runLocalAnalysis } from "@/lib/analysis-service";
import { savedLocationsStore } from "@/lib/local-data";

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

    try {
      const result = await runLocalAnalysis(locationQuery);
      setAnalysisData(result);
      setMarker({ lat: result.latitude, lng: result.longitude, name: result.name });
    } catch (error) {
      console.error(error);
      toast.error("Could not analyze that location.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMapClick = (latlng) => {
    const nextQuery = `Location at coordinates ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    setQuery(nextQuery);
    analyzeLocation(nextQuery);
  };

  const handleSave = async () => {
    if (!analysisData) return;

    setIsSaving(true);

    try {
      savedLocationsStore.create(analysisData);
      toast.success("Location saved successfully.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    analyzeLocation(query);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search an address, neighborhood, or city..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10 bg-background"
            />
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
                  Click on the map or search to analyze
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
                  <p className="text-sm font-semibold">Analyzing Location</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Generating a local traffic estimate...</p>
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
