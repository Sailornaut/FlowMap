import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  FlaskConical,
  MapPin,
  Play,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProperty,
  listAnalyses,
  listTenants,
  listVacancies,
  createAnalysis,
  executeAnalysis,
} from "@/lib/api-client";

const STATUS_COLORS = {
  queued: "secondary",
  running: "default",
  complete: "default",
  partial: "outline",
  failed: "destructive",
};

function AnalysisRow({ analysis, onExecute, executing }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-3 py-3 rounded-lg border border-border">
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => navigate(`/workspace/analyses/${analysis.id}`)}
      >
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_COLORS[analysis.status] || "secondary"}>
            {analysis.status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {analysis.depth}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(analysis.created_at).toLocaleDateString()}
        </p>
      </button>
      {analysis.status === "queued" && (
        <Button
          size="sm"
          variant="outline"
          disabled={executing}
          onClick={() => onExecute(analysis.id)}
        >
          <Play className="w-3.5 h-3.5 mr-1" />
          Run
        </Button>
      )}
    </div>
  );
}

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newDepth, setNewDepth] = useState("standard");

  const { data: property, isLoading, error } = useQuery({
    queryKey: ["workspace-property", id],
    queryFn: () => getProperty(id),
    staleTime: 30_000,
  });

  const { data: analysesData } = useQuery({
    queryKey: ["workspace-analyses", { property_id: id }],
    queryFn: () => listAnalyses({ property_id: id }),
    staleTime: 15_000,
  });

  const { data: tenantsData } = useQuery({
    queryKey: ["workspace-tenants", id],
    queryFn: () => listTenants(id),
    staleTime: 30_000,
  });

  const { data: vacanciesData } = useQuery({
    queryKey: ["workspace-vacancies", id],
    queryFn: () => listVacancies(id),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => createAnalysis(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-analyses", { property_id: id }] });
      toast.success("Analysis created");
    },
    onError: (err) => toast.error(err.message),
  });

  const executeMutation = useMutation({
    mutationFn: (analysisId) => executeAnalysis(analysisId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-analyses", { property_id: id }] });
      toast.success(`Pipeline ${result.status}: ${result.stages?.length || 0} stages`);
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

  const analyses = analysesData?.analyses || [];
  const tenants = tenantsData?.tenants || [];
  const vacancies = vacanciesData?.vacancies || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/workspace/properties")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {property.name || "Unnamed property"}
          </h1>
          {property.address && (
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {[property.address, property.city, property.state, property.zip]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Property info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {property.property_type && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-sm font-medium mt-0.5">
                {property.property_type.replace(/_/g, " ")}
              </p>
            </CardContent>
          </Card>
        )}
        {property.total_sqft && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total sqft</p>
              <p className="text-sm font-medium mt-0.5">
                {Number(property.total_sqft).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Tenants</p>
            <p className="text-sm font-medium mt-0.5">{tenants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Vacancies</p>
            <p className="text-sm font-medium mt-0.5">{vacancies.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants summary */}
      {tenants.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-3 py-2 rounded border border-border text-sm"
                >
                  <span className="font-medium truncate">{t.name}</span>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    {t.tenant_categories?.name && (
                      <Badge variant="outline" className="text-xs">
                        {t.tenant_categories.name}
                      </Badge>
                    )}
                    {t.sqft && <span>{Number(t.sqft).toLocaleString()} sqft</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Analyses</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={newDepth} onValueChange={setNewDepth}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teaser">Teaser</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  property_id: id,
                  depth: newDepth,
                })
              }
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New analysis
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analyses.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FlaskConical className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No analyses for this property yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {analyses.map((a) => (
                <AnalysisRow
                  key={a.id}
                  analysis={a}
                  onExecute={(aid) => executeMutation.mutate(aid)}
                  executing={executeMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
