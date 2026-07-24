import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, FlaskConical, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listProperties, listAnalyses } from "@/lib/api-client";

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">
            {loading ? "–" : value}
          </p>
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
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {a.properties?.name || a.properties?.address || "Unnamed property"}
            </p>
            <p className="text-xs text-muted-foreground">
              {a.depth} · {a.status}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}

export default function WorkspaceOverview() {
  const navigate = useNavigate();

  const { data: propertiesData, isLoading: propsLoading } = useQuery({
    queryKey: ["workspace-properties"],
    queryFn: () => listProperties({ limit: 1 }),
    staleTime: 30_000,
  });

  const { data: analysesData, isLoading: analysesLoading } = useQuery({
    queryKey: ["workspace-analyses-recent"],
    queryFn: () => listAnalyses({ limit: 5 }),
    staleTime: 30_000,
  });

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={Building2}
          label="Properties"
          value={propertiesData?.properties?.length ?? 0}
          loading={propsLoading}
        />
        <StatCard
          icon={FlaskConical}
          label="Recent analyses"
          value={analysesData?.analyses?.length ?? 0}
          loading={analysesLoading}
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
            analyses={analysesData?.analyses}
            isLoading={analysesLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
