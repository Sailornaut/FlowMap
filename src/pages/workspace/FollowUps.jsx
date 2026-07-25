import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock, Check, Clock, AlertTriangle, Plus, Filter,
} from "lucide-react";
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
import {
  listFollowUps, createFollowUp, updateFollowUp, getFollowUpSummary,
  listProperties,
} from "@/lib/api-client";

const STATUS_ICONS = {
  pending: Clock,
  completed: Check,
  skipped: Filter,
  overdue: AlertTriangle,
};

const STATUS_COLORS = {
  pending: "secondary",
  completed: "default",
  skipped: "outline",
  overdue: "destructive",
};

const MILESTONE_LABELS = {
  "3_month": "3 Month",
  "6_month": "6 Month",
  "12_month": "12 Month",
  "24_month": "24 Month",
  custom: "Custom",
};

export default function FollowUps() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: summaryData } = useQuery({
    queryKey: ["follow-up-summary"],
    queryFn: getFollowUpSummary,
    staleTime: 30_000,
  });

  const queryParams = {};
  if (statusFilter === "overdue") queryParams.overdue = true;
  else if (statusFilter !== "all") queryParams.status = statusFilter;

  const { data, isLoading, error } = useQuery({
    queryKey: ["follow-ups", statusFilter],
    queryFn: () => listFollowUps(queryParams),
    staleTime: 15_000,
  });

  const completeMutation = useMutation({
    mutationFn: ({ id }) => updateFollowUp(id, { status: "completed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-summary"] });
      toast.success("Follow-up marked complete.");
    },
    onError: (err) => toast.error(err.message),
  });

  const skipMutation = useMutation({
    mutationFn: ({ id }) => updateFollowUp(id, { status: "skipped" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-summary"] });
      toast.success("Follow-up skipped.");
    },
    onError: (err) => toast.error(err.message),
  });

  const followUps = data?.follow_ups || [];
  const summary = summaryData || { pending: 0, overdue: 0, completed: 0 };

  const isOverdue = (fu) =>
    fu.status === "pending" && new Date(fu.due_date) < new Date();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Follow-up
            </Button>
          </DialogTrigger>
          <CreateFollowUpDialog
            onCreated={() => {
              setCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
              queryClient.invalidateQueries({ queryKey: ["follow-up-summary"] });
            }}
          />
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Pending"
          count={summary.pending}
          icon={Clock}
          onClick={() => setStatusFilter("pending")}
          active={statusFilter === "pending"}
        />
        <SummaryCard
          label="Overdue"
          count={summary.overdue}
          icon={AlertTriangle}
          onClick={() => setStatusFilter("overdue")}
          active={statusFilter === "overdue"}
          variant="destructive"
        />
        <SummaryCard
          label="Completed"
          count={summary.completed}
          icon={Check}
          onClick={() => setStatusFilter("completed")}
          active={statusFilter === "completed"}
        />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
        <Button
          variant={statusFilter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("pending")}
        >
          Pending
        </Button>
        <Button
          variant={statusFilter === "overdue" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("overdue")}
        >
          Overdue
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("completed")}
        >
          Completed
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
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !error && followUps.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarClock className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No follow-ups</p>
            <p className="text-sm text-muted-foreground">
              Follow-ups are automatically created when an analysis completes, or you can create them manually.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && followUps.length > 0 && (
        <div className="space-y-2">
          {followUps.map((fu) => {
            const overdue = isOverdue(fu);
            return (
              <div
                key={fu.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{fu.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={overdue ? "destructive" : STATUS_COLORS[fu.status]}>
                      {overdue ? "overdue" : fu.status}
                    </Badge>
                    <Badge variant="outline">
                      {MILESTONE_LABELS[fu.milestone] || fu.milestone}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Due: {new Date(fu.due_date).toLocaleDateString()}
                    </span>
                    {fu.properties && (
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => navigate(`/workspace/properties/${fu.property_id}`)}
                      >
                        {fu.properties.name || fu.properties.address}
                      </button>
                    )}
                  </div>
                  {fu.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{fu.notes}</p>
                  )}
                </div>
                {fu.status === "pending" && (
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeMutation.mutate({ id: fu.id })}
                      disabled={completeMutation.isPending}
                    >
                      <Check className="w-3 h-3 mr-1" /> Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => skipMutation.mutate({ id: fu.id })}
                      disabled={skipMutation.isPending}
                    >
                      Skip
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, count, icon: Icon, onClick, active, variant }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${variant === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-semibold mt-1 ${variant === "destructive" && count > 0 ? "text-destructive" : ""}`}>
        {count}
      </p>
    </button>
  );
}

function CreateFollowUpDialog({ onCreated }) {
  const [form, setForm] = useState({
    property_id: "",
    title: "",
    due_date: "",
    milestone: "custom",
    notes: "",
  });

  const { data: propData } = useQuery({
    queryKey: ["workspace-properties-for-followup"],
    queryFn: () => listProperties({ limit: 100 }),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: () => createFollowUp(form),
    onSuccess: () => {
      toast.success("Follow-up created.");
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  const properties = propData?.properties || [];

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Follow-up</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
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
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Check vacancy status"
          />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => createMutation.mutate()}
          disabled={!form.property_id || !form.title || !form.due_date || createMutation.isPending}
        >
          {createMutation.isPending ? "Creating..." : "Create Follow-up"}
        </Button>
      </div>
    </DialogContent>
  );
}
