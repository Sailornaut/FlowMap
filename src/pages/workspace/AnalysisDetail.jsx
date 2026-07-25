import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Play, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, MapPin, Users, Building2, FileText,
  Database, Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAnalysis, executeAnalysis, createAnalysis, generateReport, getReportDownloadUrl } from "@/lib/api-client";
import { buildAnalysisSummary } from "@/lib/analysis-summary";

// ── Constants ────────────────────────────────────────────────────────

const STATUS_ICON = {
  ok: CheckCircle2,
  failed: XCircle,
  skipped: Clock,
};

const STATUS_BADGE_VARIANT = {
  complete: "default",
  partial: "secondary",
  failed: "destructive",
  running: "secondary",
  queued: "secondary",
};

const CONFIDENCE_COLORS = {
  high: "text-green-600",
  moderate: "text-yellow-600",
  preliminary: "text-orange-500",
  insufficient: "text-red-500",
};

const CONFIDENCE_BG = {
  high: "bg-green-50 border-green-200",
  moderate: "bg-yellow-50 border-yellow-200",
  preliminary: "bg-orange-50 border-orange-200",
  insufficient: "bg-red-50 border-red-200",
};

/** Human-readable stage descriptions. */
const STAGE_DESCRIPTIONS = {
  "property-validation": "Checks required fields and data completeness",
  "geo-enrichment": "Geocodes the address and confirms coordinates",
  "trade-area": "Generates drive-time isochrone trade areas",
  "demographics": "Census ACS demographic data for the tract",
  "demand-generators": "Nearby POIs that generate foot traffic",
};

// ── Formatting helpers ───────────────────────────────────────────────

function formatDuration(ms) {
  if (ms == null) return "–";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd) {
  if (usd == null || Number(usd) === 0) return "free";
  return `$${Number(usd).toFixed(4)}`;
}

function formatNumber(n) {
  if (n == null) return "–";
  return Number(n).toLocaleString();
}

function formatCurrency(n) {
  if (n == null) return "–";
  return `$${Number(n).toLocaleString()}`;
}

// ── Expandable stage card ────────────────────────────────────────────

function StageCard({ stage }) {
  const [open, setOpen] = useState(false);
  const Icon = STATUS_ICON[stage.status] || AlertTriangle;
  const iconColor =
    stage.status === "ok" ? "text-green-500"
      : stage.status === "failed" ? "text-red-500"
        : "text-muted-foreground";

  const outputs = stage.outputs || {};
  const hasOutputs = Object.keys(outputs).length > 0 && stage.status === "ok";

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center justify-between px-3 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => hasOutputs && setOpen(!open)}
        disabled={!hasOutputs}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium">{stage.stage_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {STAGE_DESCRIPTIONS[stage.stage_name] || ""}
            </p>
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
          <span>{formatDuration(stage.duration_ms)}</span>
          {stage.cost_usd != null && Number(stage.cost_usd) > 0 && (
            <span>{formatCost(stage.cost_usd)}</span>
          )}
          {hasOutputs && (
            open
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Expanded output details */}
      {open && hasOutputs && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
          <StageOutputRenderer stageName={stage.stage_name} outputs={outputs} />
        </div>
      )}
    </div>
  );
}

// ── Per-stage output renderers ───────────────────────────────────────

function StageOutputRenderer({ stageName, outputs }) {
  switch (stageName) {
    case "property-validation":
      return <PropertyValidationOutput outputs={outputs} />;
    case "geo-enrichment":
      return <GeoEnrichmentOutput outputs={outputs} />;
    case "trade-area":
      return <TradeAreaOutput outputs={outputs} />;
    case "demographics":
      return <DemographicsOutput outputs={outputs} />;
    case "demand-generators":
      return <DemandGeneratorsOutput outputs={outputs} />;
    default:
      return <GenericOutput outputs={outputs} />;
  }
}

function PropertyValidationOutput({ outputs }) {
  const { property_fields, vacancy_fields } = outputs;
  return (
    <div className="space-y-2 text-sm">
      {property_fields && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Property fields</p>
          <div className="flex flex-wrap gap-1.5">
            {property_fields.required?.present?.map((f) => (
              <Badge key={f} variant="secondary" className="text-xs bg-green-50 text-green-700">{f}</Badge>
            ))}
            {property_fields.required?.missing?.map((f) => (
              <Badge key={f} variant="secondary" className="text-xs bg-red-50 text-red-700">{f}</Badge>
            ))}
          </div>
        </div>
      )}
      {outputs.geocoded != null && (
        <p className="text-xs text-muted-foreground">
          Geocoded: {outputs.geocoded ? "yes" : "no"} &middot;
          Boundary: {outputs.hasBoundary ? "yes" : "no"}
        </p>
      )}
    </div>
  );
}

function GeoEnrichmentOutput({ outputs }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Kv label="Source" value={outputs.geocode_source} />
        <Kv label="Confirmed" value={outputs.confirmed ? "yes" : "no"} />
        <Kv label="Latitude" value={outputs.lat?.toFixed(6)} />
        <Kv label="Longitude" value={outputs.lng?.toFixed(6)} />
        {outputs.place_name && <Kv label="Place" value={outputs.place_name} className="col-span-2" />}
        {outputs.relevance != null && <Kv label="Relevance" value={outputs.relevance} />}
        {outputs.matchCode && <Kv label="Match code" value={outputs.matchCode} />}
      </div>
    </div>
  );
}

function TradeAreaOutput({ outputs }) {
  const areas = outputs.trade_areas || [];
  return (
    <div className="space-y-2 text-sm">
      {areas.length === 0 && <p className="text-xs text-muted-foreground">No trade areas generated</p>}
      {areas.map((ta, i) => (
        <div key={i} className="flex items-center gap-3 text-xs">
          <Badge variant="outline" className="text-xs">{ta.minutes} min</Badge>
          <span className="text-muted-foreground">
            {ta.method === "drive_time" ? "Drive-time isochrone" : ta.method}
          </span>
          {ta.geometry && (
            <span className="text-muted-foreground">
              {ta.geometry.geometry?.type || ta.geometry.type || "polygon"}
              {" · "}
              {ta.geometry.geometry?.coordinates?.[0]?.length || "?"} vertices
            </span>
          )}
        </div>
      ))}
      {outputs.coordinates && (
        <p className="text-xs text-muted-foreground">
          Center: {outputs.coordinates.lat?.toFixed(5)}, {outputs.coordinates.lng?.toFixed(5)}
        </p>
      )}
    </div>
  );
}

function DemographicsOutput({ outputs }) {
  const d = outputs.demographics;
  if (!d) return <p className="text-xs text-muted-foreground">{outputs.error || "No demographic data"}</p>;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Population" value={formatNumber(d.total_population)} icon={Users} />
        <MetricCard label="Median income" value={formatCurrency(d.median_household_income)} icon={Building2} />
        <MetricCard label="Median age" value={d.median_age != null ? String(d.median_age) : "–"} icon={Users} />
        <MetricCard label="Households" value={formatNumber(d.total_households)} icon={Building2} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {d.renter_pct != null && <Kv label="Renter %" value={`${d.renter_pct}%`} />}
        {d.family_household_pct != null && <Kv label="Family household %" value={`${d.family_household_pct}%`} />}
        <Kv label="Census tract" value={outputs.tract_fips} />
        <Kv label="Data year" value={outputs.data_year} />
        <Kv label="Scope" value={outputs.geographic_scope} />
      </div>
    </div>
  );
}

function DemandGeneratorsOutput({ outputs }) {
  const cats = outputs.category_summary || {};
  const catEntries = Object.entries(cats).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Kv label="Provider" value={outputs.provider} />
        <Kv label="Search radius" value={outputs.search_radius_m ? `${outputs.search_radius_m}m` : "–"} />
        <Kv label="Total POIs" value={outputs.total_pois} />
      </div>
      {catEntries.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">By category</p>
          <div className="space-y-1">
            {catEntries.map(([cat, info]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">
                  {info.count} &middot; nearest: {info.closest_name} ({info.closest_distance_m}m)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GenericOutput({ outputs }) {
  // Exclude large/noisy fields
  const filtered = { ...outputs };
  delete filtered.pois; // could be very long
  return (
    <pre className="text-xs font-mono bg-muted/30 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap">
      {JSON.stringify(filtered, null, 2)}
    </pre>
  );
}

// ── Small reusable components ────────────────────────────────────────

function Kv({ label, value, className = "" }) {
  if (value == null || value === "") return null;
  return (
    <div className={className}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

// ── Source observations section ──────────────────────────────────────

function SourceObservations({ observations }) {
  const [open, setOpen] = useState(false);
  if (!observations || observations.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          className="flex items-center gap-2 text-left w-full"
          onClick={() => setOpen(!open)}
        >
          <Database className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base flex-1">
            Source observations ({observations.length})
          </CardTitle>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2">
          {observations.map((obs) => (
            <div key={obs.id} className="rounded border border-border p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {obs.data_sources?.name || "unknown source"}
                </span>
                <Badge variant="outline" className="text-xs">
                  {obs.data_sources?.kind || "–"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                <span>Tier: {obs.data_sources?.reliability_tier ?? "–"}</span>
                <span>Confidence: <span className={CONFIDENCE_COLORS[obs.confidence] || ""}>{obs.confidence}</span></span>
                <span>Unit: {obs.unit}</span>
                <span>Retrieved: {obs.retrieved_at ? new Date(obs.retrieved_at).toLocaleString() : "–"}</span>
              </div>
              <p className="text-muted-foreground truncate">
                {obs.source_url_or_id}
              </p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ── Manifest section ─────────────────────────────────────────────────

function ManifestSection({ manifests }) {
  const [open, setOpen] = useState(false);
  if (!manifests || manifests.length === 0) return null;

  const latest = manifests[0]; // sorted desc by version

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          className="flex items-center gap-2 text-left w-full"
          onClick={() => setOpen(!open)}
        >
          <FileText className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base flex-1">
            Manifests ({manifests.length} version{manifests.length !== 1 ? "s" : ""})
          </CardTitle>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2">
          {manifests.map((m) => (
            <div key={m.id} className="rounded border border-border p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">Version {m.version}</span>
                <span className={CONFIDENCE_COLORS[m.overall_confidence] || ""}>
                  {m.overall_confidence || "–"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                <span>Depth: {m.depth}</span>
                <span>Runner: {m.runner_version}</span>
                <span>Cost: {formatCost(m.total_cost_usd)}</span>
                <span>Created: {new Date(m.created_at).toLocaleString()}</span>
                {m.stages_planned && <span>Stages planned: {Array.isArray(m.stages_planned) ? m.stages_planned.length : "–"}</span>}
                {m.stages_completed && <span>Stages completed: {Array.isArray(m.stages_completed) ? m.stages_completed.length : "–"}</span>}
              </div>
              {m.data_sources_used && Array.isArray(m.data_sources_used) && m.data_sources_used.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.data_sources_used.map((ds) => (
                    <Badge key={ds} variant="outline" className="text-xs">{ds}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ── Decision summary ─────────────────────────────────────────────────

function AnalysisSummarySection({ analysis }) {
  const summary = buildAnalysisSummary(analysis);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium">{summary.headline}</p>

        {summary.positives.length > 0 && (
          <div>
            <p className="text-xs font-medium text-green-700 mb-1">Strengths</p>
            <ul className="space-y-0.5">
              {summary.positives.map((p, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-green-500 shrink-0">+</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.risks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-700 mb-1">Risks and limitations</p>
            <ul className="space-y-0.5">
              {summary.risks.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-red-500 shrink-0">-</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.nextSteps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-blue-700 mb-1">Recommended next steps</p>
            <ul className="space-y-0.5">
              {summary.nextSteps.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-blue-500 shrink-0">&rarr;</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.methodology.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Methodology</p>
            {summary.methodology.map((m, i) => (
              <p key={i} className="text-xs text-muted-foreground">{m}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Tenant scoring ──────────────────────────────────────────────────

const VERDICT_COLORS = {
  recommend: "text-green-700 bg-green-50 border-green-200",
  neutral: "text-gray-600 bg-gray-50 border-gray-200",
  avoid: "text-orange-700 bg-orange-50 border-orange-200",
  disqualified: "text-red-700 bg-red-50 border-red-200",
};

function CandidateRow({ candidate }) {
  const [expanded, setExpanded] = useState(false);
  const cat = candidate.tenant_categories;
  const score = candidate.opportunity_scores?.[0];
  if (!score || !cat) return null;

  const overall = Number(score.overall);
  const barColor = overall >= 65 ? "bg-green-500" : overall >= 40 ? "bg-yellow-500" : "bg-red-400";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="w-10 text-center">
          <span className="text-lg font-semibold">{overall}</span>
        </div>
        <div className="w-16 h-2 rounded-full bg-gray-100 overflow-hidden shrink-0">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${overall}%` }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{cat.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{cat.sector?.replace(/_/g, " ")}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded border capitalize shrink-0 ${VERDICT_COLORS[candidate.verdict] || ""}`}>
          {candidate.verdict}
        </span>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Confidence: <strong className="capitalize">{score.confidence}</strong></span>
            <span>Completeness: <strong>{Math.round((score.completeness || 0) * 100)}%</strong></span>
            <span>Rank: <strong>#{candidate.rank}</strong></span>
          </div>

          {score.positive_factors?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-700 mb-0.5">Strengths</p>
              {score.positive_factors.map((f, i) => (
                <p key={i} className="text-xs text-muted-foreground ml-3">+ {f}</p>
              ))}
            </div>
          )}

          {score.negative_factors?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-700 mb-0.5">Risks</p>
              {score.negative_factors.map((f, i) => (
                <p key={i} className="text-xs text-muted-foreground ml-3">- {f}</p>
              ))}
            </div>
          )}

          {score.disqualifiers?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-700 mb-0.5">Disqualified</p>
              {score.disqualifiers.map((d, i) => (
                <p key={i} className="text-xs text-red-600 ml-3">{d}</p>
              ))}
            </div>
          )}

          {score.score_components?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Components</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {score.score_components
                  .sort((a, b) => (b.normalized || 0) * (b.weight || 0) - (a.normalized || 0) * (a.weight || 0))
                  .map((c) => (
                    <div key={c.component_key} className="text-xs flex justify-between px-2 py-1 rounded bg-muted/30">
                      <span className="text-muted-foreground truncate mr-2">{c.component_key.replace(/_/g, " ")}</span>
                      <span className="font-mono shrink-0">{c.normalized ?? "–"}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoringSection({ candidates }) {
  if (!candidates || candidates.length === 0) return null;

  const recommended = candidates.filter((c) => c.verdict === "recommend");
  const others = candidates.filter((c) => c.verdict !== "recommend" && c.verdict !== "disqualified");
  const disqualified = candidates.filter((c) => c.verdict === "disqualified");
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? candidates : candidates.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Tenant scoring
          <span className="text-xs font-normal text-muted-foreground ml-2">
            {recommended.length} recommended · {disqualified.length} disqualified · {others.length} neutral
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayed.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
        {candidates.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-primary hover:underline"
          >
            {showAll ? "Show top 10" : `Show all ${candidates.length} candidates`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function AnalysisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isActiveRef = useRef(true);
  const [elapsed, setElapsed] = useState(0);

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ["workspace-analysis", id],
    queryFn: () => getAnalysis(id),
    staleTime: 2_000,
    // Poll every 3s while queued or running; stop once terminal
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "queued" || status === "running") return 3_000;
      return false;
    },
  });

  // Elapsed-time counter while running
  useEffect(() => {
    if (!analysis?.started_at || ["complete", "partial", "failed"].includes(analysis.status)) {
      return;
    }
    const start = new Date(analysis.started_at).getTime();
    const tick = () => setElapsed(Math.round((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [analysis?.started_at, analysis?.status]);

  const executeMutation = useMutation({
    mutationFn: () => executeAnalysis(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-analysis", id] });
      toast.success(`Pipeline ${result.status}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const pdfMutation = useMutation({
    mutationFn: () => generateReport(id),
    onSuccess: (result) => {
      toast.success(`PDF generated (v${result.version})`);
      // Open download in new tab
      const url = getReportDownloadUrl(result.report_version_id);
      window.open(url, "_blank");
    },
    onError: (err) => toast.error(err.message),
  });

  const rerunMutation = useMutation({
    mutationFn: async () => {
      const newRun = await createAnalysis({
        property_id: analysis.property_id,
        depth: analysis.depth || "standard",
        notes: `Rerun of analysis ${id}`,
      });
      return newRun;
    },
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-analyses"] });
      toast.success("New analysis run created");
      navigate(`/workspace/analyses/${newRun.id}`);
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

  const stages = (analysis.analysis_stage_results || [])
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const manifests = analysis.analysis_manifests || [];
  const observations = analysis.source_observations || [];
  const businessCandidates = analysis.business_candidates || [];
  const latestManifest = manifests[0]; // sorted desc by version from API

  // Compute total duration from stage results
  const totalDuration = stages.reduce((sum, s) => sum + (s.duration_ms || 0), 0);

  // Derive overall confidence from latest manifest or deprecated JSONB
  const overallConfidence =
    latestManifest?.overall_confidence
    || analysis.manifest?.overall_confidence
    || null;

  // Derive data quality confidence from deprecated JSONB if available
  const dataQualityConfidence = analysis.manifest?.data_quality_confidence || null;

  // Find the demographics and demand-generators stages for summary cards
  const demoStage = stages.find((s) => s.stage_name === "demographics" && s.status === "ok");
  const poiStage = stages.find((s) => s.stage_name === "demand-generators" && s.status === "ok");
  const demographics = demoStage?.outputs?.demographics;
  const poiTotal = poiStage?.outputs?.total_pois;

  const canExecute = analysis.status === "queued";
  const isTerminal = ["complete", "failed", "partial"].includes(analysis.status);

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
            <p className="text-sm text-muted-foreground mt-0.5">
              {[analysis.properties?.address, analysis.properties?.city, analysis.properties?.state, analysis.properties?.postal_code]
                .filter(Boolean).join(", ")}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={STATUS_BADGE_VARIANT[analysis.status] || "secondary"}>
                {analysis.status}
              </Badge>
              <span className="text-sm text-muted-foreground">{analysis.depth}</span>
              {overallConfidence && (
                <span className={`text-sm font-medium ${CONFIDENCE_COLORS[overallConfidence] || ""}`}>
                  {overallConfidence} confidence
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {canExecute && (
            <Button
              disabled={executeMutation.isPending}
              onClick={() => executeMutation.mutate()}
            >
              <Play className="w-4 h-4 mr-1.5" />
              {executeMutation.isPending ? "Running..." : "Execute pipeline"}
            </Button>
          )}
          {isTerminal && (
            <Button
              variant="outline"
              onClick={() => navigate(`/workspace/analyses/${id}/report`)}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              View Report
            </Button>
          )}
          {isTerminal && (
            <Button
              variant="outline"
              disabled={pdfMutation.isPending}
              onClick={() => pdfMutation.mutate()}
            >
              <Download className="w-4 h-4 mr-1.5" />
              {pdfMutation.isPending ? "Generating..." : "Download PDF"}
            </Button>
          )}
          {isTerminal && analysis.property_id && (
            <Button
              variant="outline"
              disabled={rerunMutation.isPending}
              onClick={() => rerunMutation.mutate()}
            >
              <Play className="w-4 h-4 mr-1.5" />
              {rerunMutation.isPending ? "Creating..." : "New run"}
            </Button>
          )}
        </div>
      </div>

      {/* Running progress */}
      {(analysis.status === "queued" || analysis.status === "running") && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-blue-700 rounded-full animate-spin shrink-0" />
            <span className="font-medium">
              {analysis.status === "queued" ? "Waiting to start..." : "Pipeline running..."}
            </span>
            {elapsed > 0 && (
              <span className="text-blue-600">{elapsed}s</span>
            )}
          </div>
          {stages.length > 0 && (
            <p className="text-xs text-blue-600 ml-5.5">
              {stages.filter((s) => s.status === "ok").length} of {stages.length} stages complete
            </p>
          )}
        </div>
      )}

      {/* Partial/failed banner */}
      {analysis.status === "partial" && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Some pipeline stages failed. Results below are partial.
        </div>
      )}
      {analysis.status === "failed" && !analysis.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          Pipeline execution failed.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className={`text-sm font-medium mt-0.5 ${CONFIDENCE_COLORS[overallConfidence] || ""}`}>
              {overallConfidence || "–"}
            </p>
            {dataQualityConfidence && dataQualityConfidence !== overallConfidence && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Data quality: <span className={CONFIDENCE_COLORS[dataQualityConfidence] || ""}>{dataQualityConfidence}</span>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm font-medium mt-0.5">{formatDuration(totalDuration)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stages.length} stages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-sm font-medium mt-0.5">
              {analysis.total_cost_usd != null ? formatCost(analysis.total_cost_usd) : "–"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Sources</p>
            <p className="text-sm font-medium mt-0.5">{observations.length} observations</p>
            {manifests.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Manifest v{latestManifest.version}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Decision summary — only for terminal analyses with stages */}
      {isTerminal && stages.length > 0 && <AnalysisSummarySection analysis={analysis} />}

      {/* Tenant scoring — ranked candidates */}
      {isTerminal && <ScoringSection candidates={businessCandidates} />}

      {/* Key metrics — demographics & POI counts */}
      {(demographics || poiTotal != null) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {demographics?.total_population != null && (
            <MetricCard label="Population" value={formatNumber(demographics.total_population)} icon={Users} />
          )}
          {demographics?.median_household_income != null && (
            <MetricCard label="Median income" value={formatCurrency(demographics.median_household_income)} icon={Building2} />
          )}
          {demographics?.median_age != null && (
            <MetricCard label="Median age" value={String(demographics.median_age)} icon={Users} />
          )}
          {poiTotal != null && (
            <MetricCard label="Nearby POIs" value={formatNumber(poiTotal)} icon={MapPin} />
          )}
        </div>
      )}

      {/* Stage results */}
      {stages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stage results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stages.map((s) => (
              <StageCard key={s.id} stage={s} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Source observations */}
      <SourceObservations observations={observations} />

      {/* Manifests */}
      <ManifestSection manifests={manifests} />

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

      {/* Metadata footer */}
      {isTerminal && (
        <div className="text-xs text-muted-foreground space-y-0.5 pt-2">
          <p>Run ID: {analysis.id}</p>
          {analysis.started_at && <p>Started: {new Date(analysis.started_at).toLocaleString()}</p>}
          {analysis.finished_at && <p>Finished: {new Date(analysis.finished_at).toLocaleString()}</p>}
          {latestManifest?.runner_version && <p>Runner: v{latestManifest.runner_version}</p>}
        </div>
      )}
    </div>
  );
}
