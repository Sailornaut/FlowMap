import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getAnalysis, generateReport, getReportDownloadUrl } from "@/lib/api-client";
import { buildAnalysisSummary } from "@/lib/analysis-summary";

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return "–";
  return Number(n).toLocaleString();
}

function fmtCurrency(n) {
  if (n == null) return "–";
  return `$${Number(n).toLocaleString()}`;
}

function fmtDuration(ms) {
  if (ms == null) return "–";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const CONFIDENCE_LABEL = {
  high: "High",
  moderate: "Moderate",
  preliminary: "Preliminary",
  insufficient: "Insufficient",
};

// ── PDF download button ─────────────────────────────────────────────

function PdfDownloadButton({ analysisId }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await generateReport(analysisId);
      const url = getReportDownloadUrl(result.report_version_id);
      window.open(url, "_blank");
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={loading} onClick={handleClick}>
      <Download className="w-4 h-4 mr-1" />
      {loading ? "Generating..." : "Download PDF"}
    </Button>
  );
}

// ── Report sections ──────────────────────────────────────────────────

function SectionTitle({ children }) {
  return <h2 className="text-lg font-semibold mt-8 mb-3 border-b border-gray-200 pb-1 print:mt-6">{children}</h2>;
}

function PropertyOverview({ analysis }) {
  const p = analysis.properties || {};
  return (
    <>
      <SectionTitle>1. Property overview</SectionTitle>
      <table className="w-full text-sm">
        <tbody>
          {[
            ["Name", p.name],
            ["Address", [p.address, p.city, p.state, p.postal_code].filter(Boolean).join(", ")],
            ["Type", analysis.properties?.property_type?.replace(/_/g, " ")],
          ].map(([label, value]) => value && (
            <tr key={label} className="border-b border-gray-100">
              <td className="py-1.5 pr-4 text-gray-500 w-36">{label}</td>
              <td className="py-1.5 font-medium">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ExecutiveSummary({ summary }) {
  return (
    <>
      <SectionTitle>2. Executive summary</SectionTitle>
      <p className="text-sm font-medium mb-3">{summary.headline}</p>

      {summary.positives.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Strengths</p>
          {summary.positives.map((p, i) => (
            <p key={i} className="text-sm text-gray-700 ml-4">+ {p}</p>
          ))}
        </div>
      )}

      {summary.risks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Risks &amp; limitations</p>
          {summary.risks.map((r, i) => (
            <p key={i} className="text-sm text-gray-700 ml-4">- {r}</p>
          ))}
        </div>
      )}

      {summary.nextSteps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Recommended next steps</p>
          {summary.nextSteps.map((s, i) => (
            <p key={i} className="text-sm text-gray-700 ml-4">&rarr; {s}</p>
          ))}
        </div>
      )}
    </>
  );
}

function ConfidenceSection({ analysis, stages, latestManifest }) {
  const overallConfidence = latestManifest?.overall_confidence
    || analysis.manifest?.overall_confidence || null;

  return (
    <>
      <SectionTitle>3. Analysis status and confidence</SectionTitle>
      <table className="w-full text-sm mb-3">
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 pr-4 text-gray-500 w-36">Status</td>
            <td className="py-1.5 font-medium capitalize">{analysis.status}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 pr-4 text-gray-500">Overall confidence</td>
            <td className="py-1.5 font-medium">{CONFIDENCE_LABEL[overallConfidence] || overallConfidence || "–"}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 pr-4 text-gray-500">Depth</td>
            <td className="py-1.5">{analysis.depth}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 pr-4 text-gray-500">Stages completed</td>
            <td className="py-1.5">{stages.filter(s => s.status === "ok").length} of {stages.length}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="text-left py-1 pr-2">Stage</th>
            <th className="text-left py-1 pr-2">Status</th>
            <th className="text-left py-1 pr-2">Confidence</th>
            <th className="text-right py-1">Duration</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.id} className="border-b border-gray-100">
              <td className="py-1 pr-2">{s.stage_name}</td>
              <td className="py-1 pr-2 capitalize">{s.status}</td>
              <td className="py-1 pr-2">{CONFIDENCE_LABEL[s.confidence] || s.confidence || "–"}</td>
              <td className="py-1 text-right">{fmtDuration(s.duration_ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {stages.some(s => s.status === "failed") && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          One or more stages failed. Results are partial. Failed stages are excluded from the overall confidence calculation.
        </div>
      )}
    </>
  );
}

function DemographicsSection({ stages }) {
  const demo = stages.find(s => s.stage_name === "demographics" && s.status === "ok");
  if (!demo?.outputs?.demographics) {
    return (
      <>
        <SectionTitle>4. Key demographics</SectionTitle>
        <p className="text-sm text-gray-500">Demographic data not available for this analysis.</p>
      </>
    );
  }

  const d = demo.outputs.demographics;
  const metrics = [
    ["Total population", fmt(d.total_population)],
    ["Median household income", fmtCurrency(d.median_household_income)],
    ["Median age", d.median_age != null ? String(d.median_age) : "–"],
    ["Total households", fmt(d.total_households)],
    ["Family household %", d.family_household_pct != null ? `${d.family_household_pct}%` : "–"],
    ["Renter %", d.renter_pct != null ? `${d.renter_pct}%` : "–"],
    ["Housing units", fmt(d.total_housing_units)],
  ];

  return (
    <>
      <SectionTitle>4. Key demographics</SectionTitle>
      <table className="w-full text-sm">
        <tbody>
          {metrics.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100">
              <td className="py-1.5 pr-4 text-gray-500 w-48">{label}</td>
              <td className="py-1.5 font-medium">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">
        Source: Census ACS 5-year ({demo.outputs.acs_year || demo.outputs.data_year || "unknown"}),
        tract {demo.outputs.tract_fips || "unknown"}.
        Demographics are tract-level, not trade-area-weighted.
      </p>
    </>
  );
}

function TradeAreaSection({ stages }) {
  const ta = stages.find(s => s.stage_name === "trade-area" && s.status === "ok");
  if (!ta?.outputs?.trade_areas?.length) {
    return (
      <>
        <SectionTitle>5. Trade-area methodology</SectionTitle>
        <p className="text-sm text-gray-500">Trade-area data not available for this analysis.</p>
      </>
    );
  }

  const areas = ta.outputs.trade_areas;
  return (
    <>
      <SectionTitle>5. Trade-area methodology</SectionTitle>
      <p className="text-sm text-gray-700 mb-2">
        Drive-time isochrones generated via Mapbox Isochrone API using the driving profile.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-xs">
            <th className="text-left py-1">Drive time</th>
            <th className="text-left py-1">Method</th>
            <th className="text-left py-1">Geometry</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((a, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5">{a.minutes} minutes</td>
              <td className="py-1.5 capitalize">{(a.method || "drive_time").replace(/_/g, " ")}</td>
              <td className="py-1.5 text-gray-500">
                {a.geometry?.geometry?.coordinates?.[0]?.length || "?"} vertices
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function DemandGeneratorsSection({ stages }) {
  const dg = stages.find(s => s.stage_name === "demand-generators" && s.status === "ok");
  if (!dg?.outputs?.category_summary) {
    return (
      <>
        <SectionTitle>6. Demand generators</SectionTitle>
        <p className="text-sm text-gray-500">POI data not available for this analysis.</p>
      </>
    );
  }

  const cats = dg.outputs.category_summary;
  const entries = Object.entries(cats).sort((a, b) => b[1].count - a[1].count);

  return (
    <>
      <SectionTitle>6. Demand generators</SectionTitle>
      <p className="text-sm text-gray-700 mb-2">
        {dg.outputs.total_pois || 0} nearby points of interest within {dg.outputs.search_radius_m || "?"}m
        ({dg.outputs.provider || "unknown"}).
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-xs">
            <th className="text-left py-1">Category</th>
            <th className="text-right py-1">Count</th>
            <th className="text-left py-1 pl-4">Nearest</th>
            <th className="text-right py-1">Distance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([cat, info]) => (
            <tr key={cat} className="border-b border-gray-100">
              <td className="py-1.5 capitalize">{cat.replace(/_/g, " ")}</td>
              <td className="py-1.5 text-right">{info.count}</td>
              <td className="py-1.5 pl-4 text-gray-600 truncate max-w-48">{info.closest_name}</td>
              <td className="py-1.5 text-right">{info.closest_distance_m}m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function TenantRecommendations({ candidates }) {
  if (!candidates || candidates.length === 0) {
    return (
      <>
        <SectionTitle>7. Tenant recommendations</SectionTitle>
        <p className="text-sm text-gray-500">No scoring data available for this analysis. Run the seed-taxonomy script and re-execute.</p>
      </>
    );
  }

  const recommended = candidates.filter(c => c.verdict === "recommend");
  const disqualified = candidates.filter(c => c.verdict === "disqualified");

  return (
    <>
      <SectionTitle>7. Tenant recommendations</SectionTitle>
      {recommended.length > 0 && (
        <>
          <p className="text-sm text-gray-700 mb-2">
            {recommended.length} category(ies) recommended based on deterministic scoring of {candidates.length} evaluated candidates.
          </p>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs">
                <th className="text-left py-1">Rank</th>
                <th className="text-left py-1">Category</th>
                <th className="text-left py-1">Sector</th>
                <th className="text-right py-1">Score</th>
                <th className="text-left py-1 pl-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {recommended.slice(0, 15).map((c) => {
                const score = c.opportunity_scores?.[0];
                return (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-1.5">#{c.rank}</td>
                    <td className="py-1.5 font-medium">{c.tenant_categories?.name}</td>
                    <td className="py-1.5 capitalize text-gray-500">{c.tenant_categories?.sector?.replace(/_/g, " ")}</td>
                    <td className="py-1.5 text-right font-mono">{score?.overall ?? "–"}</td>
                    <td className="py-1.5 pl-3 capitalize">{score?.confidence || "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {recommended.length === 0 && (
        <p className="text-sm text-gray-500 mb-4">No categories met the recommendation threshold.</p>
      )}
      {disqualified.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Disqualified ({disqualified.length})</p>
          {disqualified.slice(0, 10).map((c) => (
            <p key={c.id} className="text-sm text-gray-600">
              {c.tenant_categories?.name}: {c.opportunity_scores?.[0]?.disqualifiers?.join("; ") || "Physical constraints"}
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Scores computed deterministically from pipeline evidence. No AI-generated rankings.
      </p>
    </>
  );
}

function KeyFindings({ summary }) {
  return (
    <>
      <SectionTitle>8. Key findings</SectionTitle>
      {summary.positives.length > 0 && summary.positives.map((p, i) => (
        <p key={i} className="text-sm text-gray-700">+ {p}</p>
      ))}
      {summary.risks.length > 0 && (
        <div className="mt-2">
          {summary.risks.map((r, i) => (
            <p key={i} className="text-sm text-gray-700">- {r}</p>
          ))}
        </div>
      )}
    </>
  );
}

function RisksSection({ summary, stages }) {
  const failedStages = stages.filter(s => s.status === "failed");
  return (
    <>
      <SectionTitle>9. Risks and limitations</SectionTitle>
      {summary.risks.map((r, i) => (
        <p key={i} className="text-sm text-gray-700 mb-1">- {r}</p>
      ))}
      {failedStages.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Failed stages</p>
          {failedStages.map(s => (
            <p key={s.id} className="text-sm text-red-700">
              {s.stage_name}: {s.error || "Unknown error"}
            </p>
          ))}
        </div>
      )}
      {summary.risks.length === 0 && failedStages.length === 0 && (
        <p className="text-sm text-gray-500">No significant risks identified.</p>
      )}
    </>
  );
}

function EvidenceSection({ observations }) {
  return (
    <>
      <SectionTitle>10. Evidence and sources</SectionTitle>
      {(!observations || observations.length === 0) ? (
        <p className="text-sm text-gray-500">No source observations recorded.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-1">Source</th>
              <th className="text-left py-1">Kind</th>
              <th className="text-left py-1">Confidence</th>
              <th className="text-left py-1">Retrieved</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((obs) => (
              <tr key={obs.id} className="border-b border-gray-100">
                <td className="py-1">{obs.data_sources?.name || "unknown"}</td>
                <td className="py-1">{obs.data_sources?.kind || "–"}</td>
                <td className="py-1 capitalize">{obs.confidence || "–"}</td>
                <td className="py-1">{obs.retrieved_at ? new Date(obs.retrieved_at).toLocaleDateString() : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function ManifestInfo({ analysis, latestManifest }) {
  return (
    <>
      <SectionTitle>11. Methodology and manifest</SectionTitle>
      <table className="w-full text-sm">
        <tbody>
          {[
            ["Run ID", analysis.id],
            ["Manifest version", latestManifest?.version],
            ["Runner version", latestManifest?.runner_version],
            ["Depth", analysis.depth],
            ["Started", analysis.started_at ? new Date(analysis.started_at).toLocaleString() : "–"],
            ["Finished", analysis.finished_at ? new Date(analysis.finished_at).toLocaleString() : "–"],
            ["Total cost", analysis.total_cost_usd != null ? `$${Number(analysis.total_cost_usd).toFixed(4)}` : "–"],
          ].map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100">
              <td className="py-1.5 pr-4 text-gray-500 w-36">{label}</td>
              <td className="py-1.5 font-mono text-xs">{value ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-3">
        This report is based on immutable analysis manifest v{latestManifest?.version || "?"}.
        Regenerating this report will not change the underlying evidence.
      </p>
    </>
  );
}

// ── Print styles (injected once) ────────────────────────────────────

const PRINT_CSS = `
@media print {
  @page { margin: 0.75in; size: letter; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { break-after: avoid; }
  table { break-inside: avoid; }
  tr { break-inside: avoid; }
}
`;

let printStyleInjected = false;
function injectPrintStyles() {
  if (printStyleInjected) return;
  const style = document.createElement("style");
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
  printStyleInjected = true;
}

// ── Main report page ─────────────────────────────────────────────────

export default function AnalysisReport() {
  injectPrintStyles();
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ["workspace-analysis", id],
    queryFn: () => getAnalysis(id),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse mb-8" />
        <div className="h-96 bg-gray-50 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      </div>
    );
  }

  const stages = (analysis.analysis_stage_results || [])
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const manifests = analysis.analysis_manifests || [];
  const observations = analysis.source_observations || [];
  const candidates = analysis.business_candidates || [];
  const latestManifest = manifests[0];
  const summary = buildAnalysisSummary(analysis);

  const propertyName = analysis.properties?.name || "Property Analysis";
  const address = [analysis.properties?.address, analysis.properties?.city, analysis.properties?.state]
    .filter(Boolean).join(", ");

  return (
    <div className="bg-white min-h-screen">
      {/* Screen-only toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/workspace/analyses/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to analysis
        </Button>
        <div className="flex items-center gap-2">
          <PdfDownloadButton analysisId={id} />
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* Report body — print-optimized */}
      <div className="max-w-3xl mx-auto px-8 py-12 print:px-0 print:py-0 print:max-w-none">
        {/* Title block */}
        <div className="mb-8 print:mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">TrafficScout Analysis Report</p>
          <h1 className="text-2xl font-bold text-gray-900">{propertyName}</h1>
          {address && <p className="text-sm text-gray-500 mt-1">{address}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>Generated {new Date().toLocaleDateString()}</span>
            <span>·</span>
            <span className="capitalize">{analysis.status}</span>
            <span>·</span>
            <span>Manifest v{latestManifest?.version || "?"}</span>
          </div>
        </div>

        {analysis.status === "partial" && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2 mb-6">
            This is a partial analysis. One or more pipeline stages failed. Results should be reviewed with caution.
          </div>
        )}

        <PropertyOverview analysis={analysis} />
        <ExecutiveSummary summary={summary} />
        <ConfidenceSection analysis={analysis} stages={stages} latestManifest={latestManifest} />
        <DemographicsSection stages={stages} />
        <TradeAreaSection stages={stages} />
        <DemandGeneratorsSection stages={stages} />
        <TenantRecommendations candidates={candidates} />
        <KeyFindings summary={summary} />
        <RisksSection summary={summary} stages={stages} />
        <EvidenceSection observations={observations} />
        <ManifestInfo analysis={analysis} latestManifest={latestManifest} />

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-200 text-xs text-gray-400">
          <p>TrafficScout &mdash; Commercial Real Estate Intelligence</p>
          <p>Analysis run {analysis.id} &middot; Manifest v{latestManifest?.version || "?"} &middot; {new Date().toLocaleDateString()}</p>
          <p className="mt-1">This report is generated from verified external data sources. No data in this report was fabricated by AI.</p>
        </div>
      </div>
    </div>
  );
}
