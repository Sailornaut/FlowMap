import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAnalyses } from "@/lib/api-client";

const STATUS_COLORS = {
  queued: "secondary",
  running: "default",
  complete: "default",
  partial: "outline",
  failed: "destructive",
};

export default function AnalysisList() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace-analyses"],
    queryFn: () => listAnalyses({ limit: 100 }),
    staleTime: 15_000,
  });

  const analyses = data?.analyses || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Analyses</h1>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !error && analyses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FlaskConical className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No analyses yet</p>
            <p className="text-sm text-muted-foreground">
              Go to a property and start a new analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && analyses.length > 0 && (
        <div className="space-y-2">
          {analyses.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/workspace/analyses/${a.id}`)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {a.properties?.name || a.properties?.address || "Unnamed property"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={STATUS_COLORS[a.status] || "secondary"}>
                    {a.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {a.depth}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
