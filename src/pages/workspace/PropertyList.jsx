import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Building2, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProperties } from "@/lib/api-client";

function PropertyCard({ property, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">
            {property.name || "Unnamed property"}
          </p>
          {property.address && (
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{property.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {property.property_type && (
              <Badge variant="secondary" className="text-xs">
                {property.property_type}
              </Badge>
            )}
            {property.total_sqft && (
              <span className="text-xs text-muted-foreground">
                {Number(property.total_sqft).toLocaleString()} sqft
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}

function EmptyState({ onAdd }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">No properties yet</p>
        <p className="text-sm text-muted-foreground mb-4">
          Add your first property to start analyzing.
        </p>
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add property
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PropertyList() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace-properties"],
    queryFn: () => listProperties({ limit: 100 }),
    staleTime: 30_000,
  });

  const properties = data?.properties || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <Button onClick={() => navigate("/workspace/properties/new")}>
          <Plus className="w-4 h-4 mr-1.5" />
          New property
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !error && properties.length === 0 && (
        <EmptyState onAdd={() => navigate("/workspace/properties/new")} />
      )}

      {!isLoading && properties.length > 0 && (
        <div className="space-y-3">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              onClick={() => navigate(`/workspace/properties/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
