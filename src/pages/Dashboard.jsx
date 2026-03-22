import { useQuery, useQueryClient } from "@tanstack/react-query";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, Users, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { savedLocationsStore } from "@/lib/saved-locations";
import CheckoutStatusBanner from "@/components/billing/CheckoutStatusBanner";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["saved-locations"],
    queryFn: () => savedLocationsStore.list(),
  });

  const { containerRef, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: () => queryClient.invalidateQueries({ queryKey: ["saved-locations"] }),
  });

  const avgScore = locations.length
    ? Math.round(locations.reduce((sum, location) => sum + (location.traffic_score || 0), 0) / locations.length)
    : 0;

  const avgTraffic = locations.length
    ? Math.round(
        locations.reduce((sum, location) => sum + (location.estimated_daily_foot_traffic || 0), 0) / locations.length
      )
    : 0;

  const comparisonData = locations.slice(0, 8).map((location) => ({
    name: location.name?.length > 15 ? `${location.name.slice(0, 15)}...` : location.name,
    score: location.traffic_score || 0,
    traffic: location.estimated_daily_foot_traffic || 0,
  }));

  const suitabilityColors = {
    excellent: "bg-green-500/10 text-green-600 border-green-500/20",
    good: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    moderate: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    low: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-4 md:p-8 pb-24 md:pb-8 max-w-6xl mx-auto space-y-6 overflow-auto h-full">
      {(pullDistance > 0 || isRefreshing) && (
        <div className="flex justify-center transition-all" style={{ height: isRefreshing ? 40 : pullDistance }}>
          <div
            className={`w-6 h-6 border-2 border-primary border-t-transparent rounded-full mt-2 ${
              isRefreshing ? "animate-spin" : ""
            }`}
          />
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your analyzed locations</p>
      </div>

      <CheckoutStatusBanner />

      {locations.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No saved locations yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Search and analyze locations to see your dashboard populate with traffic insights.
            </p>
            <Link to="/app" className="text-sm font-medium text-primary hover:underline mt-1">
              Analyze a location →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: MapPin, label: "Locations", value: locations.length },
              { icon: BarChart3, label: "Avg Score", value: `${avgScore}/100` },
              { icon: Users, label: "Avg Daily Traffic", value: avgTraffic.toLocaleString() },
              {
                icon: TrendingUp,
                label: "Best Score",
                value: `${Math.max(...locations.map((location) => location.traffic_score || 0))}/100`,
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <stat.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <p className="text-xl font-bold mt-0.5">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {comparisonData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Location Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="score" name="Traffic Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Locations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...locations]
                .sort((a, b) => (b.traffic_score || 0) - (a.traffic_score || 0))
                .slice(0, 5)
                .map((location, index) => (
                  <motion.div
                    key={location.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-xs font-bold text-muted-foreground w-5">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{location.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{location.address}</p>
                    </div>
                    <Badge variant="outline" className={suitabilityColors[location.business_suitability] || ""}>
                      {location.traffic_score}/100
                    </Badge>
                  </motion.div>
                ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
