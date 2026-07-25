import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock, FlaskConical, Plus, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProperties, listAnalyses, getFollowUpSummary } from "@/lib/api-client";

const STATUS_BADGE = {
  complete: "default",
  partial: "secondary",
  failed: "destructive",
  running: "secondary",
  queued: "outline",
};

function StatCard({ icon: Icon, label, value, sub, loading }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{loading ? "–" : value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentAnalyses({ analyses, isLoading }) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!analyses?.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No analyses yet. Create a property and run your first analysis.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {analyses.slice(0, 5).map((a) => (
        <button
          key={a.id}
          onClick={() => navigate(`/workspace/analyses/${a.id}`)}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {a.properties?.name || a.properties?.address || "Unnamed property"}
            </p>
            <p className="text-xs text-muted-foreground">
              {a.depth} · {new Date(a.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <Badge variant={STATUS_BADGE[a.status] || "outline"} className="capitalize text-xs">
              {a.status}
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}

export default function WorkspaceOverview() {
  const navigate = useNavigate();

  const { data: propertiesData, isLoading: propsLoading } = useQuery({
    queryKey: ["workspace-properties"],
    queryFn: () => listProperties(),
    staleTime: 30_000,
  });

  const { data: analysesData, isLoading: analysesLoading } = useQuery({
    queryKey: ["workspace-analyses-recent"],
    queryFn: () => listAnalyses({ limit: 10 }),
    staleTime: 30_000,
  });

  const { data: followUpSummary, isLoading: fuLoading } = useQuery({
    queryKey: ["follow-up-summary"],
    queryFn: getFollowUpSummary,
    staleTime: 30_000,
  });

  const analyses = analysesData?.analyses || [];
  const completedCount = analyses.filter((a) => a.status === "complete").length;
  const activeCount = analyses.filter((a) => a.status === "running" || a.status === "queued").length;
  const overdueCount = followUpSummary?.overdue ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Commercial real-estate intelligence
          </p>
        </div>
        <Button onClick={() => navigate("/workspace/properties/new")}>
          <Plus className="w-4 h-4 mr-1.5" />
          New property
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard
          icon={Building2}
          label="Properties"
          value={propertiesData?.properties?.length ?? 0}
          loading={propsLoading}
        />
        <StatCard
          icon={FlaskConical}
          label="Analyses"
          value={analyses.length}
          loading={analysesLoading}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completedCount}
          loading={analysesLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Active"
          value={activeCount}
          sub={activeCount > 0 ? "running now" : undefined}
          loading={analysesLoading}
        />
        <StatCard
          icon={CalendarClock}
          label="Follow-ups Due"
          value={overdueCount}
          sub={overdueCount > 0 ? "overdue" : undefined}
          loading={fuLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent analyses</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/workspace/analyses")}
          >
            View all
          </Button>
        </CardHeader>
        <CardContent>
          <RecentAnalyses
            analyses={analyses}
            isLoading={analysesLoading}
          />
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate("/workspace/properties")}
          className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
        >
          <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Browse properties</p>
            <p className="text-xs text-muted-foreground">View and manage all properties</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/workspace/analyses")}
          className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
        >
          <FlaskConical className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">All analyses</p>
            <p className="text-xs text-muted-foreground">Review past analysis runs</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/workspace/follow-ups")}
          className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
        >
          <CalendarClock className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Follow-ups</p>
            <p className="text-xs text-muted-foreground">Track milestones and outcomes</p>
          </div>
        </button>
      </div>
    </div>
  );
}
