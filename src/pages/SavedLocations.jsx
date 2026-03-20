import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Trash2, Search, Users, Clock, TrendingUp, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import TrafficScoreGauge from "@/components/analysis/TrafficScoreGauge";
import HourlyChart from "@/components/analysis/HourlyChart";
import WeeklyChart from "@/components/analysis/WeeklyChart";
import DemographicsChart from "@/components/analysis/DemographicsChart";
import NearbyPOIList from "@/components/analysis/NearbyPOIList";

const suitabilityColors = {
  excellent: "bg-green-500/10 text-green-600 border-green-500/20",
  good: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  moderate: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function SavedLocations() {
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const queryClient = useQueryClient();

  const { containerRef, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: () => queryClient.invalidateQueries({ queryKey: ["saved-locations"] }),
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["saved-locations"],
    queryFn: () => base44.entities.SavedLocation.list("-created_date", 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SavedLocation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-locations"] });
      toast.success("Location deleted");
    },
  });

  const filtered = locations.filter(
    (l) =>
      l.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.address?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-4 md:p-8 pb-24 md:pb-8 max-w-4xl mx-auto space-y-5 overflow-auto h-full">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex justify-center transition-all"
          style={{ height: isRefreshing ? 40 : pullDistance }}
        >
          <div className={`w-6 h-6 border-2 border-primary border-t-transparent rounded-full mt-2 ${isRefreshing ? "animate-spin" : ""}`} />
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">Saved Locations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {locations.length} location{locations.length !== 1 ? "s" : ""} saved
        </p>
      </div>

      {locations.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No saved locations</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Analyze locations and save them to compare and review later.
            </p>
            <Link to="/" className="text-sm font-medium text-primary hover:underline mt-1">
              Analyze a location →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter saved locations..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {filtered.map((loc, i) => (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedLocation(loc)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-lg font-bold text-primary">{loc.traffic_score}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{loc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{loc.address}</p>
                        <div className="flex gap-2 mt-1.5">
                          <Badge variant="outline" className={suitabilityColors[loc.business_suitability] || ""}>
                            {loc.business_suitability}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {loc.estimated_daily_foot_traffic?.toLocaleString()}/day
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(loc.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedLocation && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedLocation.name}</DialogTitle>
                <p className="text-xs text-muted-foreground">{selectedLocation.address}</p>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex justify-center">
                  <TrafficScoreGauge score={selectedLocation.traffic_score} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Daily Traffic</p>
                    <p className="text-sm font-bold">{selectedLocation.estimated_daily_foot_traffic?.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Suitability</p>
                    <p className="text-sm font-bold capitalize">{selectedLocation.business_suitability}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">POIs</p>
                    <p className="text-sm font-bold">{selectedLocation.nearby_pois?.length || 0}</p>
                  </div>
                </div>
                {selectedLocation.peak_hours && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Hourly Traffic</h4>
                    <HourlyChart data={selectedLocation.peak_hours} />
                  </div>
                )}
                {selectedLocation.daily_pattern && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Weekly Pattern</h4>
                    <WeeklyChart data={selectedLocation.daily_pattern} />
                  </div>
                )}
                {selectedLocation.demographics && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Demographics</h4>
                    <DemographicsChart data={selectedLocation.demographics} />
                  </div>
                )}
                {selectedLocation.nearby_pois && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Nearby POIs</h4>
                    <NearbyPOIList pois={selectedLocation.nearby_pois} />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}