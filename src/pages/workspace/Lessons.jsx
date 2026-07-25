import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Link2, Trash2 } from "lucide-react";
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
  listLessons, createLesson, updateLesson,
  addLessonReferences, removeLessonReference,
} from "@/lib/api-client";

const TYPE_LABELS = {
  methodology: "Methodology",
  data_quality: "Data Quality",
  market_insight: "Market Insight",
  process: "Process",
  other: "Other",
};

const SEVERITY_COLORS = {
  critical: "destructive",
  important: "default",
  minor: "secondary",
};

const SUBJECT_TYPE_LABELS = {
  analysis_run: "Analysis",
  report_project: "Report",
  property: "Property",
  vacancy: "Vacancy",
  observed_outcome: "Outcome",
  follow_up: "Follow-up",
};

export default function Lessons() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const queryParams = {};
  if (typeFilter !== "all") queryParams.lesson_type = typeFilter;

  const { data, isLoading, error } = useQuery({
    queryKey: ["lessons", typeFilter],
    queryFn: () => listLessons(queryParams),
    staleTime: 15_000,
  });

  const lessons = data?.lessons || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Lessons Learned</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Lesson
            </Button>
          </DialogTrigger>
          <CreateLessonDialog
            onCreated={() => {
              setCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ["lessons"] });
            }}
          />
        </Dialog>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={typeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTypeFilter("all")}
        >
          All
        </Button>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <Button
            key={key}
            variant={typeFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter(key)}
          >
            {label}
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
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !error && lessons.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No lessons recorded</p>
            <p className="text-sm text-muted-foreground">
              Capture insights from analyses, outcomes, and market observations.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && lessons.length > 0 && (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const expanded = expandedId === lesson.id;
            const refs = lesson.lesson_references || [];
            return (
              <div
                key={lesson.id}
                className="rounded-lg border border-border overflow-hidden"
              >
                <button
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : lesson.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{lesson.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={SEVERITY_COLORS[lesson.severity]}>
                          {lesson.severity}
                        </Badge>
                        <Badge variant="outline">
                          {TYPE_LABELS[lesson.lesson_type] || lesson.lesson_type}
                        </Badge>
                        {refs.length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> {refs.length} ref{refs.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(lesson.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-border/50 bg-muted/20">
                    <p className="text-sm mt-3 whitespace-pre-wrap">{lesson.body}</p>

                    {refs.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">References:</p>
                        <div className="flex flex-wrap gap-1">
                          {refs.map((ref) => (
                            <Badge key={ref.id} variant="outline" className="text-xs">
                              {SUBJECT_TYPE_LABELS[ref.subject_type] || ref.subject_type}
                              <span className="ml-1 font-mono text-[10px]">
                                {ref.subject_id.slice(0, 8)}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <AddReferenceInline
                      lessonId={lesson.id}
                      onAdded={() => queryClient.invalidateQueries({ queryKey: ["lessons"] })}
                    />
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

function AddReferenceInline({ lessonId, onAdded }) {
  const [adding, setAdding] = useState(false);
  const [subjectType, setSubjectType] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      addLessonReferences(lessonId, [{ subject_type: subjectType, subject_id: subjectId }]),
    onSuccess: () => {
      toast.success("Reference added.");
      setAdding(false);
      setSubjectType("");
      setSubjectId("");
      onAdded();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!adding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => setAdding(true)}
      >
        <Link2 className="w-3 h-3 mr-1" /> Add Reference
      </Button>
    );
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <Label className="text-xs">Type</Label>
        <Select value={subjectType} onValueChange={setSubjectType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SUBJECT_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1">
        <Label className="text-xs">ID</Label>
        <Input
          className="h-8 text-xs"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder="UUID"
        />
      </div>
      <Button
        size="sm"
        className="h-8"
        onClick={() => addMutation.mutate()}
        disabled={!subjectType || !subjectId || addMutation.isPending}
      >
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => setAdding(false)}
      >
        Cancel
      </Button>
    </div>
  );
}

function CreateLessonDialog({ onCreated }) {
  const [form, setForm] = useState({
    title: "",
    body: "",
    lesson_type: "",
    severity: "minor",
  });

  const createMutation = useMutation({
    mutationFn: () => createLesson(form),
    onSuccess: () => {
      toast.success("Lesson created.");
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Lesson</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div>
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Census data unreliable for small geographies"
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select
            value={form.lesson_type}
            onValueChange={(v) => setForm((f) => ({ ...f, lesson_type: v }))}
          >
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Severity</Label>
          <Select
            value={form.severity}
            onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="important">Important</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Body</Label>
          <Textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={5}
            placeholder="Describe the lesson, context, and recommended action..."
          />
        </div>
        <Button
          className="w-full"
          onClick={() => createMutation.mutate()}
          disabled={!form.title || !form.body || !form.lesson_type || createMutation.isPending}
        >
          {createMutation.isPending ? "Creating..." : "Create Lesson"}
        </Button>
      </div>
    </DialogContent>
  );
}
