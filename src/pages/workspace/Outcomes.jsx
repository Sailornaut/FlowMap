import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Plus, Eye, FileQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listOutcomes, createOutcome, listProperties } from "@/lib/api-client";

const OUTCOME_LABELS = {
  lease_signed: "Lease Signed",
  tenant_opened: "Tenant Opened",
  vacancy_persisted: "Vacancy Persisted",
  property_sold: "Property Sold",
  renovation: "Renovation",
  other: "Other",
};

const ACCURACY_COLORS = {
  correct: "default",
  partially_correct: "secondary",
  incorrect: "destructive",
  not_applicable: "outline",
};

const EVIDENCE_ICONS = {
  observation: Eye,
  assumption: FileQuestion,
};

export default function Outcomes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState("all");

  const queryParams = {};
  if (evidenceFilter !== "all") queryParams.evidence_type = evidenceFilter;

  const { data, isLoading, error } = useQuery({
    queryKey: ["outcomes", evidenceFilter],
    queryFn: () => listOutcomes(queryParams),
    staleTime: 15_000,
  });

  const outcomes = data?.outcomes || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Observed Outcomes</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Record Outcome
            </Button>
          </DialogTrigger>
          <CreateOutcomeDialog
            onCreated={() => {
              setCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ["outcomes"] });
            }}
          />
        </Dialog>
      </div>

      {/* Evidence type filter (7.6) */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Evidence type:</span>
        {["all", "observation", "assumption"].map((t) => (
          <Button
            key={t}
            variant={evidenceFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setEvidenceFilter(t)}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

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

      {!isLoading && !error && outcomes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No outcomes recorded</p>
            <p className="text-sm text-muted-foreground">
              Record what actually happened at each property to track prediction accuracy.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && outcomes.length > 0 && (
        <div className="space-y-2">
          {outcomes.map((o) => {
            const EvidenceIcon = EVIDENCE_ICONS[o.evidence_type] || Eye;
            return (
              <div
                key={o.id}
                className="px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {OUTCOME_LABELS[o.outcome_type] || o.outcome_type}
                      </Badge>
                      {o.prediction_accuracy && (
                        <Badge variant={ACCURACY_COLORS[o.prediction_accuracy]}>
                          {o.prediction_accuracy.replace("_", " ")}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <EvidenceIcon className="w-3 h-3" />
                        {o.evidence_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {o.properties && (
                        <button
                          className="text-primary hover:underline"
                          onClick={() => navigate(`/workspace/properties/${o.property_id}`)}
                        >
                          {o.properties.name || o.properties.address}
                        </button>
                      )}
                      {o.tenant_name && <span>Tenant: {o.tenant_name}</span>}
                      {o.tenant_categories && (
                        <span>Category: {o.tenant_categories.name}</span>
                      )}
                      {o.actual_rent_psf != null && (
                        <span>${Number(o.actual_rent_psf).toFixed(2)}/sqft {o.rent_basis}</span>
                      )}
                      {o.lease_date && (
                        <span>Leased: {new Date(o.lease_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    {o.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{o.notes}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {new Date(o.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateOutcomeDialog({ onCreated }) {
  const [form, setForm] = useState({
    property_id: "",
    outcome_type: "",
    tenant_name: "",
    actual_rent_psf: "",
    rent_basis: "",
    lease_date: "",
    prediction_accuracy: "",
    evidence_type: "observation",
    notes: "",
  });

  const { data: propData } = useQuery({
    queryKey: ["workspace-properties-for-outcome"],
    queryFn: () => listProperties({ limit: 100 }),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      if (!payload.actual_rent_psf) delete payload.actual_rent_psf;
      else payload.actual_rent_psf = Number(payload.actual_rent_psf);
      if (!payload.rent_basis) delete payload.rent_basis;
      if (!payload.lease_date) delete payload.lease_date;
      if (!payload.prediction_accuracy) delete payload.prediction_accuracy;
      if (!payload.tenant_name) delete payload.tenant_name;
      if (!payload.notes) delete payload.notes;
      return createOutcome(payload);
    },
    onSuccess: () => {
      toast.success("Outcome recorded.");
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  const properties = propData?.properties || [];

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Record Outcome</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto">
        <div>
          <Label>Property</Label>
          <Select
            value={form.property_id}
            onValueChange={(v) => setForm((f) => ({ ...f, property_id: v }))}
          >
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name || p.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Outcome Type</Label>
          <Select
            value={form.outcome_type}
            onValueChange={(v) => setForm((f) => ({ ...f, outcome_type: v }))}
          >
            <SelectTrigger><SelectValue placeholder="What happened?" /></SelectTrigger>
            <SelectContent>
              {Object.entries(OUTCOME_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Evidence Type</Label>
          <Select
            value={form.evidence_type}
            onValueChange={(v) => setForm((f) => ({ ...f, evidence_type: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="observation">Observation (verified fact)</SelectItem>
              <SelectItem value="assumption">Assumption (unverified)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tenant Name (if applicable)</Label>
          <Input
            value={form.tenant_name}
            onChange={(e) => setForm((f) => ({ ...f, tenant_name: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Actual Rent ($/sqft)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.actual_rent_psf}
              onChange={(e) => setForm((f) => ({ ...f, actual_rent_psf: e.target.value }))}
            />
          </div>
          <div>
            <Label>Rent Basis</Label>
            <Select
              value={form.rent_basis}
              onValueChange={(v) => setForm((f) => ({ ...f, rent_basis: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nnn">NNN</SelectItem>
                <SelectItem value="gross">Gross</SelectItem>
                <SelectItem value="modified_gross">Modified Gross</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Lease Date</Label>
            <Input
              type="date"
              value={form.lease_date}
              onChange={(e) => setForm((f) => ({ ...f, lease_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Prediction Accuracy</Label>
            <Select
              value={form.prediction_accuracy}
              onValueChange={(v) => setForm((f) => ({ ...f, prediction_accuracy: v }))}
            >
              <SelectTrigger><SelectValue placeholder="How accurate?" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="correct">Correct</SelectItem>
                <SelectItem value="partially_correct">Partially Correct</SelectItem>
                <SelectItem value="incorrect">Incorrect</SelectItem>
                <SelectItem value="not_applicable">N/A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => createMutation.mutate()}
          disabled={!form.property_id || !form.outcome_type || createMutation.isPending}
        >
          {createMutation.isPending ? "Recording..." : "Record Outcome"}
        </Button>
      </div>
    </DialogContent>
  );
}
