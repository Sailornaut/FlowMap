import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAnalysis, executeAnalysis } from "@/lib/api-client";

const STATUS_ICON = {
  ok: CheckCircle2,
  failed: XCircle,
  skipped: Clock,
};

const CONFIDENCE_COLORS = {
  high: "text-green-600",
  moderate: "text-yellow-600",
  preliminary: "text-orange-500",
  insufficient: "text-red-500",
};

function StageRow({ stage }) {
  const Icon = STATUS_ICON[stage.status] || AlertTriangle;
  const iconColor =
    stage.status === "ok"
      ? "text-green-500"
      : stage.status === "failed"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between px-3 py-3 rounded-lg border border-border">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{stage.stage_name}</p>
          {stage.error && (
            <p className="text-xs text-destructive mt-0.5 truncate">
              {stage.error}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        {stage.confidence && (
          <span className={CONFIDENCE_COLORS[stage.confidence] || ""}>
            {stage.confidence}
          </span>
        )}
        {stage.duration_ms != null && (
          <span>{stage.duration_ms}ms</span>
        )}
        {stage.cost_usd != null && Number(stage.cost_usd) > 0 && (
          <span>${Number(stage.cost_usd).toFixed(4)}</span>
        )}
      </div>
    </div>
  );
}

export default function AnalysisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ["workspace-analysis", id],
    queryFn: () => getAnalysis(id),
    staleTime: 10_000,
  });

  const executeMutation = useMutation({
    mutationFn: () => executeAnalysis(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-analysis", id] });
      toast.success(`Pipeline ${result.status}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse mb-6" />
        <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      </div>
    );
  }

  const stages = analysis.analysis_stage_results || [];
  const manifest = analysis.manifest;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (analysis.property_id) {
                navigate(`/workspace/properties/${analysis.property_id}`);
              } else {
                navigate("/workspace/analyses");
              }
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {analysis.properties?.name || "Analysis"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={
                  analysis.status === "complete"
                    ? "default"
                    : analysis.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {analysis.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {analysis.depth}
              </span>
            </div>
          </div>
        </div>

        {analysis.status === "queued" && (
          <Button
            disabled={executeMutation.isPending}
            onClick={() => executeMutation.mutate()}
          >
            <Play className="w-4 h-4 mr-1.5" />
            {executeMutation.isPending ? "Running…" : "Execute pipeline"}
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p
              className={`text-sm font-medium mt-0.5 ${
                CONFIDENCE_COLORS[manifest?.overall_confidence] || ""
              }`}
            >
              {manifest?.overall_confidence || "–"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Stages</p>
            <p className="text-sm font-medium mt-0.5">{stages.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-sm font-medium mt-0.5">
              {analysis.total_cost_usd != null
                ? `$${Number(analysis.total_cost_usd).toFixed(4)}`
                : "–"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium mt-0.5">
              {new Date(analysis.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stage results */}
      {stages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stage results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stages
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              .map((s) => (
                <StageRow key={s.id} stage={s} />
              ))}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {analysis.error && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-destructive whitespace-pre-wrap font-mono bg-destructive/5 rounded p-3">
              {analysis.error}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
