import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, TrendingUp, Building2, Bookmark, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrafficScoreGauge from "./TrafficScoreGauge";
import HourlyChart from "./HourlyChart";
import WeeklyChart from "./WeeklyChart";
import DemographicsChart from "./DemographicsChart";
import NearbyPOIList from "./NearbyPOIList";
import StatCard from "./StatCard";

export default function AnalysisPanel({ data, onSave, isSaving }) {
  if (!data) return null;

  const peakHour = data.peak_hours?.reduce((max, h) => h.traffic > max.traffic ? h : max, { traffic: 0 });

  return (
    <ScrollArea className="h-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 pb-24 md:pb-6 space-y-4"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold leading-tight">{data.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{data.address}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onSave}
            disabled={isSaving}
            className="shrink-0"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
            <span className="ml-1.5 hidden sm:inline">Save</span>
          </Button>
        </div>

        {/* Score + Stats */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <TrafficScoreGauge score={data.traffic_score} />
          <div className="flex-1 grid grid-cols-2 gap-2 w-full">
            <StatCard
              icon={Users}
              label="Daily Traffic"
              value={data.estimated_daily_foot_traffic?.toLocaleString()}
              delay={0.1}
            />
            <StatCard
              icon={Clock}
              label="Peak Hour"
              value={peakHour?.hour || "—"}
              sub={`${peakHour?.traffic?.toLocaleString()} visitors`}
              delay={0.2}
            />
            <StatCard
              icon={TrendingUp}
              label="Suitability"
              value={data.business_suitability?.charAt(0).toUpperCase() + data.business_suitability?.slice(1)}
              delay={0.3}
            />
            <StatCard
              icon={Building2}
              label="Nearby POIs"
              value={data.nearby_pois?.length || 0}
              delay={0.4}
            />
          </div>
        </div>

        {/* Hourly Traffic */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold">Hourly Traffic Pattern</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <HourlyChart data={data.peak_hours} />
          </CardContent>
        </Card>

        {/* Weekly Traffic */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold">Weekly Pattern</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <WeeklyChart data={data.daily_pattern} />
          </CardContent>
        </Card>

        {/* Demographics + POI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Visitor Demographics</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <DemographicsChart data={data.demographics} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Nearby Points of Interest</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <NearbyPOIList pois={data.nearby_pois} />
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </ScrollArea>
  );
}