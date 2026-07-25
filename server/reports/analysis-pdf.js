// @ts-check
/**
 * TrafficScout Analysis PDF Document
 *
 * Server-side PDF generation using @react-pdf/renderer.
 * Uses React.createElement (no JSX) so it runs in plain Node without a build step.
 *
 * Usage:
 *   import { renderAnalysisPdf } from "./analysis-pdf.js";
 *   const buffer = await renderAnalysisPdf(analysisData);
 *
 * All data comes from the analysis record + joined tables — no fabrication.
 * Sections render only when their data is available.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { styles, COLORS, FONT_SIZES, VERDICT_COLORS } from "./styles.js";

const h = React.createElement;

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return "–";
  return Number(n).toLocaleString();
}

function fmtCurrency(n) {
  if (n == null) return "–";
  return `$${Number(n).toLocaleString()}`;
}

function fmtPct(n) {
  if (n == null) return "–";
  return `${(Number(n) * 100).toFixed(0)}%`;
}

function fmtDate(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const CONFIDENCE_LABEL = {
  high: "High",
  moderate: "Moderate",
  preliminary: "Preliminary",
  insufficient: "Insufficient",
};

// ── Reusable primitives ──────────────────────────────────────────────

function SectionTitle(text) {
  return h(Text, { style: styles.sectionTitle }, text);
}

function SubsectionTitle(text, color) {
  return h(Text, { style: [styles.subsectionTitle, color ? { color } : null] }, text);
}

function P(text) {
  return h(Text, { style: styles.paragraph }, text);
}

function Sm(text) {
  return h(Text, { style: styles.small }, text);
}

function KV(label, value) {
  return h(View, { style: [styles.row, styles.mb4] },
    h(Text, { style: [styles.paragraph, styles.bold, { width: 140 }] }, `${label}: `),
    h(Text, { style: [styles.paragraph, { flex: 1 }] }, `${value ?? "–"}`),
  );
}

function Bullet(text) {
  return h(Text, { style: styles.paragraph }, `• ${text}`);
}

function Callout(...children) {
  return h(View, { style: styles.callout }, ...children);
}

function CalloutText(text, bold) {
  return h(Text, { style: [styles.calloutText, bold ? styles.bold : null] }, text);
}

// ── Table ────────────────────────────────────────────────────────────

/**
 * @param {Array<{label:string, flex?:number, align?:string, key?:string, render?:Function}>} columns
 * @param {Array<object>} rows
 */
function DataTable(columns, rows) {
  if (!rows?.length) return null;

  const headerCells = columns.map((col, i) =>
    h(Text, {
      key: `h${i}`,
      style: [styles.tableHeaderCell, { flex: col.flex || 1 }],
    }, col.label)
  );

  const dataRows = rows.map((row, ri) => {
    const cells = columns.map((col, ci) => {
      const val = col.render ? col.render(row) : (row[col.key] ?? "–");
      return h(Text, {
        key: `c${ci}`,
        style: [styles.tableCell, { flex: col.flex || 1 }, col.align === "right" ? { textAlign: "right" } : null],
      }, `${val}`);
    });
    return h(View, { key: `r${ri}`, style: ri % 2 === 1 ? styles.tableRowAlt : styles.tableRow }, ...cells);
  });

  return h(View, { style: styles.table },
    h(View, { style: styles.tableHeader }, ...headerCells),
    ...dataRows,
  );
}

// ── Shared page wrapper ──────────────────────────────────────────────

function ReportPage(propertyName, reportDate, ...children) {
  return h(Page, { size: "LETTER", style: styles.page },
    // Header
    h(View, { style: styles.header, fixed: true },
      h(Text, { style: styles.headerText }, "TrafficScout Analysis Report"),
      h(Text, { style: styles.headerText }, propertyName || "Property Report"),
    ),
    // Content
    ...children,
    // Footer
    h(View, { style: styles.footer, fixed: true },
      h(Text, { style: styles.footerText }, `CONFIDENTIAL — Prepared ${reportDate}`),
      h(Text, {
        style: styles.pageNumber,
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
      }),
    ),
  );
}

// ── Section: Cover page ──────────────────────────────────────────────

function CoverPage(analysis, reportDate) {
  const p = analysis.properties || {};
  const address = [p.address, p.city, p.state, p.postal_code].filter(Boolean).join(", ");

  return h(Page, { size: "LETTER", style: [styles.page, { justifyContent: "center", alignItems: "center" }] },
    h(View, { style: { alignItems: "center", marginBottom: 60 } },
      h(Text, { style: { fontSize: FONT_SIZES["4xl"], fontFamily: "Helvetica-Bold", color: COLORS.primary, marginBottom: 8 } }, "TrafficScout"),
      h(Text, { style: { fontSize: FONT_SIZES.lg, color: COLORS.mutedLight, letterSpacing: 3 } }, "ANALYSIS REPORT"),
    ),
    h(View, { style: { alignItems: "center", marginBottom: 40, paddingHorizontal: 40 } },
      h(Text, { style: { fontSize: FONT_SIZES["2xl"], fontFamily: "Helvetica-Bold", color: COLORS.text, textAlign: "center", marginBottom: 8 } }, p.name || "Property Analysis"),
      address ? h(Text, { style: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: "center" } }, address) : null,
    ),
    h(View, { style: { width: 60, borderBottomWidth: 2, borderBottomColor: COLORS.accent, marginBottom: 40 } }),
    h(View, { style: { alignItems: "center" } },
      h(Text, { style: { fontSize: FONT_SIZES.base, color: COLORS.textMuted, marginBottom: 4 } }, reportDate),
      analysis.depth ? h(Text, { style: { fontSize: FONT_SIZES.sm, color: COLORS.mutedLight } }, `Analysis depth: ${analysis.depth}`) : null,
    ),
    h(View, { style: { position: "absolute", bottom: 40, alignItems: "center" } },
      h(Text, { style: { fontSize: FONT_SIZES.xs, color: COLORS.mutedLight } }, "CONFIDENTIAL — For internal use only"),
    ),
  );
}

// ── Section: Executive summary ───────────────────────────────────────

function ExecutiveSummary(analysis, summary, candidates) {
  const manifest = analysis.analysis_manifests?.[0];
  const overallConf = manifest?.overall_confidence;
  const recommended = (candidates || []).filter((c) => c.verdict === "recommend").slice(0, 5);

  const parts = [
    SectionTitle("Executive Summary"),
  ];

  if (summary?.headline) {
    parts.push(Callout(CalloutText(summary.headline, true)));
  }

  parts.push(
    h(View, { style: [styles.row, styles.mb8] },
      h(View, { style: { flex: 1, marginRight: 8 } },
        h(Text, { style: [styles.small, styles.bold, { marginBottom: 4 }] }, "Analysis Status"),
        P(analysis.status || "–"),
      ),
      h(View, { style: { flex: 1, marginRight: 8 } },
        h(Text, { style: [styles.small, styles.bold, { marginBottom: 4 }] }, "Overall Confidence"),
        P(CONFIDENCE_LABEL[overallConf] || overallConf || "–"),
      ),
      h(View, { style: { flex: 1 } },
        h(Text, { style: [styles.small, styles.bold, { marginBottom: 4 }] }, "Pipeline Stages"),
        P(`${analysis.analysis_stage_results?.length || 0} completed`),
      ),
    ),
  );

  if (summary?.positives?.length) {
    parts.push(SubsectionTitle("Key Strengths"));
    parts.push(...summary.positives.map((p, i) => Bullet(p)));
  }

  if (summary?.risks?.length) {
    parts.push(SubsectionTitle("Risks & Limitations"));
    parts.push(...summary.risks.map((r, i) => Bullet(r)));
  }

  if (recommended.length) {
    parts.push(SubsectionTitle("Top Recommendations"));
    parts.push(DataTable(
      [
        { label: "Rank", flex: 0.5, render: (r) => `#${r.rank}` },
        { label: "Category", flex: 2, render: (r) => r.tenant_categories?.name || "–" },
        { label: "Sector", flex: 1.5, render: (r) => (r.tenant_categories?.sector || "–").replace(/_/g, " ") },
        { label: "Score", flex: 0.8, align: "right", render: (r) => `${r.opportunity_scores?.overall ?? "–"}` },
        { label: "Confidence", flex: 1, render: (r) => r.opportunity_scores?.confidence || "–" },
      ],
      recommended,
    ));
  }

  return parts;
}

// ── Section: Property overview ───────────────────────────────────────

function PropertyOverview(analysis) {
  const p = analysis.properties || {};
  const address = [p.address, p.city, p.state, p.postal_code].filter(Boolean).join(", ");

  const parts = [
    SectionTitle("Property Overview"),
    KV("Name", p.name),
    KV("Address", address),
    KV("Type", p.property_type?.replace(/_/g, " ")),
  ];
  if (p.year_built) parts.push(KV("Year Built", p.year_built));
  if (p.gla_sqft) parts.push(KV("GLA", `${fmt(p.gla_sqft)} sqft`));
  if (p.parcel_acres) parts.push(KV("Parcel", `${p.parcel_acres} acres`));
  if (p.parking_spaces) parts.push(KV("Parking", `${fmt(p.parking_spaces)} spaces`));
  if (p.lat && p.lng) parts.push(KV("Coordinates", `${p.lat}, ${p.lng}`));

  return parts;
}

// ── Section: Vacancy overview ────────────────────────────────────────

function VacancyOverview(vacancies) {
  if (!vacancies?.length) return [];

  return [
    SectionTitle("Vacancy Overview"),
    P(`${vacancies.length} vacanc${vacancies.length === 1 ? "y" : "ies"} identified on the property.`),
    DataTable(
      [
        { label: "Unit", flex: 1.2, render: (v) => v.unit_label || "–" },
        { label: "Size (sqft)", flex: 1, align: "right", render: (v) => fmt(v.sqft) },
        { label: "Asking Rent", flex: 1, align: "right", render: (v) => v.asking_rent_psf ? `$${v.asking_rent_psf}/psf` : "–" },
        { label: "Placement", flex: 1, render: (v) => v.placement || "–" },
        { label: "Condition", flex: 1, render: (v) => (v.condition || "–").replace(/_/g, " ") },
      ],
      vacancies,
    ),
  ];
}

// ── Section: Demographics ────────────────────────────────────────────

function DemographicsSection(stageOutputs) {
  const demo = stageOutputs?.demographics?.demographics;
  if (!demo) return [];

  const acsYear = stageOutputs.demographics?.acs_year;
  const parts = [
    SectionTitle("Demographics"),
  ];
  if (acsYear) parts.push(Sm(`Source: U.S. Census Bureau, ACS 5-Year Estimates (${acsYear})`));

  parts.push(h(View, { style: styles.mt8 },
    KV("Total Population", fmt(demo.total_population)),
    KV("Median Household Income", fmtCurrency(demo.median_household_income)),
    demo.median_age ? KV("Median Age", demo.median_age) : null,
    demo.total_households ? KV("Total Households", fmt(demo.total_households)) : null,
    demo.family_households ? KV("Family Households", fmt(demo.family_households)) : null,
    demo.owner_occupied ? KV("Owner-Occupied", fmt(demo.owner_occupied)) : null,
    demo.renter_occupied ? KV("Renter-Occupied", fmt(demo.renter_occupied)) : null,
    demo.bachelors_plus ? KV("Bachelor's Degree+", fmt(demo.bachelors_plus)) : null,
  ));

  return parts;
}

// ── Section: Trade area ──────────────────────────────────────────────

function TradeAreaSection(stageOutputs) {
  const ta = stageOutputs?.["trade-area"];
  if (!ta?.isochrones) return [];

  return [
    SectionTitle("Trade Area"),
    P("Trade areas defined using drive-time isochrones from the property location."),
    DataTable(
      [
        { label: "Drive Time", flex: 1, render: (r) => `${r.minutes} min` },
        { label: "Vertices", flex: 1, align: "right", render: (r) => fmt(r.vertices) },
      ],
      ta.isochrones.map((iso) => ({
        minutes: iso.minutes,
        vertices: iso.geometry?.coordinates?.[0]?.length || 0,
      })),
    ),
  ];
}

// ── Section: Demand generators ───────────────────────────────────────

function DemandGeneratorsSection(stageOutputs) {
  const dg = stageOutputs?.["demand-generators"];
  if (!dg?.category_summary) return [];

  const categories = Object.entries(dg.category_summary)
    .map(([cat, info]) => ({
      category: cat.replace(/_/g, " "),
      count: typeof info === "object" ? info.count : info,
      nearest: typeof info === "object" ? info.nearest_m : null,
    }))
    .sort((a, b) => b.count - a.count);

  return [
    SectionTitle("Demand Generators"),
    P(`${fmt(dg.total_pois)} points of interest identified within the trade area${dg.provider ? ` (source: ${dg.provider})` : ""}.`),
    DataTable(
      [
        { label: "Category", flex: 2, render: (r) => r.category },
        { label: "Count", flex: 0.8, align: "right", render: (r) => fmt(r.count) },
        { label: "Nearest (m)", flex: 1, align: "right", render: (r) => r.nearest != null ? fmt(Math.round(r.nearest)) : "–" },
      ],
      categories,
    ),
  ];
}

// ── Section: Tenant recommendations ──────────────────────────────────

function TenantRecommendationsSection(candidates) {
  if (!candidates?.length) return [];

  const recommended = candidates.filter((c) => c.verdict === "recommend");
  const neutral = candidates.filter((c) => c.verdict === "neutral");
  const avoid = candidates.filter((c) => c.verdict === "avoid");
  const disqualified = candidates.filter((c) => c.verdict === "disqualified");

  const scoreCols = [
    { label: "#", flex: 0.4, render: (r) => `${r.rank}` },
    { label: "Category", flex: 2, render: (r) => r.tenant_categories?.name || "–" },
    { label: "Sector", flex: 1.5, render: (r) => (r.tenant_categories?.sector || "–").replace(/_/g, " ") },
    { label: "Score", flex: 0.7, align: "right", render: (r) => `${r.opportunity_scores?.overall ?? "–"}` },
    { label: "Confidence", flex: 1, render: (r) => r.opportunity_scores?.confidence || "–" },
    { label: "Completeness", flex: 0.9, align: "right", render: (r) => fmtPct(r.opportunity_scores?.completeness) },
  ];

  const sectorCount = new Set(candidates.map((c) => c.tenant_categories?.sector)).size;
  const parts = [
    SectionTitle("Tenant Category Recommendations"),
    P(`${candidates.length} categories scored across ${sectorCount} sectors.${recommended.length ? ` ${recommended.length} recommended.` : ""}${disqualified.length ? ` ${disqualified.length} disqualified due to physical constraints.` : ""}`),
  ];

  if (recommended.length) {
    parts.push(SubsectionTitle(`Recommended (${recommended.length})`, VERDICT_COLORS.recommend));
    parts.push(DataTable(scoreCols, recommended));

    // Highlight top candidate
    const top = recommended[0];
    if (top?.opportunity_scores?.positive_factors?.length) {
      const calloutParts = [CalloutText(`Top candidate: ${top.tenant_categories?.name}`, true)];
      for (const f of top.opportunity_scores.positive_factors.slice(0, 3)) {
        calloutParts.push(CalloutText(`+ ${f}`));
      }
      for (const f of (top.opportunity_scores.negative_factors || []).slice(0, 2)) {
        calloutParts.push(CalloutText(`− ${f}`));
      }
      parts.push(h(View, { style: [styles.callout, styles.mt8] }, ...calloutParts));
    }
  }

  if (neutral.length) {
    parts.push(SubsectionTitle(`Neutral (${neutral.length})`, VERDICT_COLORS.neutral));
    parts.push(DataTable(scoreCols, neutral.slice(0, 10)));
  }

  if (avoid.length) {
    parts.push(SubsectionTitle(`Poor Fit (${avoid.length})`, VERDICT_COLORS.avoid));
    parts.push(DataTable(scoreCols, avoid));
  }

  if (disqualified.length) {
    parts.push(SubsectionTitle(`Disqualified (${disqualified.length})`, VERDICT_COLORS.disqualified));
    for (const c of disqualified) {
      const reasons = c.opportunity_scores?.disqualifiers?.length
        ? ` — ${c.opportunity_scores.disqualifiers.join("; ")}`
        : "";
      parts.push(Bullet(`${c.tenant_categories?.name || "–"}${reasons}`));
    }
  }

  return parts;
}

// ── Section: Sources ─────────────────────────────────────────────────

function SourcesSection(observations) {
  if (!observations?.length) return [];

  const uniqueSources = [];
  const seen = new Set();
  for (const obs of observations) {
    const key = obs.source_name || obs.data_sources?.name;
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueSources.push({
        name: key,
        kind: obs.source_kind || obs.data_sources?.source_type || "–",
        tier: obs.reliability_tier ?? obs.data_sources?.reliability_tier ?? "–",
        confidence: obs.confidence || "–",
        retrieved: obs.retrieved_at,
      });
    }
  }

  return [
    SectionTitle("Data Sources"),
    P(`This analysis used ${uniqueSources.length} data source${uniqueSources.length !== 1 ? "s" : ""}. All findings are traceable to specific observations.`),
    DataTable(
      [
        { label: "Source", flex: 2, render: (r) => r.name.replace(/_/g, " ") },
        { label: "Type", flex: 1, render: (r) => r.kind },
        { label: "Tier", flex: 0.5, align: "right", render: (r) => `${r.tier}` },
        { label: "Confidence", flex: 1, render: (r) => r.confidence },
        { label: "Retrieved", flex: 1.2, render: (r) => r.retrieved ? fmtDate(r.retrieved) : "–" },
      ],
      uniqueSources,
    ),
  ];
}

// ── Section: Methodology ─────────────────────────────────────────────

function MethodologySection(analysis, manifest) {
  const parts = [
    SectionTitle("Methodology"),
    P("This report was generated by the TrafficScout deterministic analysis pipeline. All scores are computed from real data sources — no AI-generated numbers. The scoring engine uses 15 weighted components to evaluate each tenant category against available vacancy data and market evidence."),
  ];

  if (manifest) {
    parts.push(h(View, { style: styles.mt8 },
      KV("Manifest Version", manifest.version),
      KV("Runner Version", manifest.runner_version),
      KV("Pipeline Stages", `${manifest.stage_count || "–"} stages`),
      KV("Overall Confidence", CONFIDENCE_LABEL[manifest.overall_confidence] || manifest.overall_confidence || "–"),
      KV("Inputs Hash", manifest.inputs_hash),
    ));
  }

  parts.push(
    h(View, { style: [styles.callout, styles.mt8] },
      CalloutText("Confidence Levels", true),
      CalloutText("High — Multiple corroborating authoritative sources"),
      CalloutText("Moderate — Authoritative sources with some gaps"),
      CalloutText("Preliminary — Limited data; directional only"),
      CalloutText("Insufficient — Not enough evidence for reliable conclusions"),
    ),
    h(View, { style: styles.mt8 },
      Sm(`Analysis ID: ${analysis.id}`),
      Sm(`Generated: ${fmtDate(analysis.started_at || analysis.created_at)}`),
      analysis.completed_at ? Sm(`Completed: ${fmtDate(analysis.completed_at)}`) : null,
    ),
  );

  return parts;
}

// ── Section: Disclaimer ──────────────────────────────────────────────

function DisclaimerSection() {
  return [
    SectionTitle("Notice & Disclaimer"),
    P("This report is provided for internal analytical purposes only. The information contained herein is derived from public and third-party data sources believed to be reliable but not independently verified."),
    P("This analysis does not constitute an appraisal, property valuation, or investment recommendation. Rent analysis, where provided, reflects estimated market ranges based on available comparable data and should not be relied upon as a formal appraisal."),
    P("Tenant category recommendations are based on statistical scoring of market conditions and physical property attributes. Actual leasing outcomes depend on many factors not captured in this analysis, including tenant-specific requirements, market timing, and negotiation dynamics."),
    h(Text, { style: [styles.small, styles.mt8] }, `© ${new Date().getFullYear()} TrafficScout. All rights reserved.`),
  ];
}

// ── Main document assembly ───────────────────────────────────────────

function buildDocument({ analysis, summary, candidates, vacancies, observations, stageOutputs }) {
  const reportDate = fmtDate(new Date());
  const propertyName = analysis.properties?.name || "Property";
  const manifest = analysis.analysis_manifests?.[0];

  const pages = [
    // Cover
    CoverPage(analysis, reportDate),

    // Executive summary
    ReportPage(propertyName, reportDate,
      ...ExecutiveSummary(analysis, summary, candidates),
    ),

    // Property + vacancies
    ReportPage(propertyName, reportDate,
      ...PropertyOverview(analysis),
      ...VacancyOverview(vacancies),
    ),
  ];

  // Demographics + trade area (conditional)
  const demoContent = DemographicsSection(stageOutputs);
  const taContent = TradeAreaSection(stageOutputs);
  if (demoContent.length || taContent.length) {
    pages.push(ReportPage(propertyName, reportDate, ...demoContent, ...taContent));
  }

  // Demand generators (conditional)
  const dgContent = DemandGeneratorsSection(stageOutputs);
  if (dgContent.length) {
    pages.push(ReportPage(propertyName, reportDate, ...dgContent));
  }

  // Tenant recommendations (conditional)
  const recContent = TenantRecommendationsSection(candidates);
  if (recContent.length) {
    pages.push(ReportPage(propertyName, reportDate, ...recContent));
  }

  // Sources + methodology + disclaimer (always)
  pages.push(ReportPage(propertyName, reportDate,
    ...SourcesSection(observations),
    ...MethodologySection(analysis, manifest),
    ...DisclaimerSection(),
  ));

  return h(Document, {
    title: `TrafficScout Report — ${propertyName}`,
    author: "TrafficScout",
    subject: "Commercial Real Estate Analysis",
    creator: "TrafficScout Analysis Pipeline",
  }, ...pages);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Render the analysis PDF to a Node Buffer.
 * @param {object} params
 * @returns {Promise<Buffer>} PDF file buffer
 */
export async function renderAnalysisPdf(params) {
  const doc = buildDocument(params);
  return renderToBuffer(doc);
}

/**
 * Build a snapshot object for report_versions persistence.
 * Contains everything needed to reproduce the PDF.
 * @param {object} params
 * @returns {object} Snapshot JSONB value
 */
export function buildReportSnapshot(params) {
  const { analysis, summary, candidates, vacancies, observations, stageOutputs } = params;
  return {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    analysis_id: analysis.id,
    analysis_status: analysis.status,
    property_id: analysis.property_id,
    property_name: analysis.properties?.name,
    manifest_version: analysis.analysis_manifests?.[0]?.version,
    manifest_inputs_hash: analysis.analysis_manifests?.[0]?.inputs_hash,
    overall_confidence: analysis.analysis_manifests?.[0]?.overall_confidence,
    depth: analysis.depth,
    summary: summary || null,
    candidate_count: candidates?.length || 0,
    recommended_count: candidates?.filter((c) => c.verdict === "recommend")?.length || 0,
    vacancy_count: vacancies?.length || 0,
    observation_count: observations?.length || 0,
    stage_keys: stageOutputs ? Object.keys(stageOutputs) : [],
    sections_rendered: [
      "cover",
      "executive_summary",
      "property_overview",
      ...(vacancies?.length ? ["vacancy_overview"] : []),
      ...(stageOutputs?.demographics ? ["demographics"] : []),
      ...(stageOutputs?.["trade-area"] ? ["trade_area"] : []),
      ...(stageOutputs?.["demand-generators"] ? ["demand_generators"] : []),
      ...(candidates?.length ? ["tenant_recommendations"] : []),
      "sources",
      "methodology",
      "disclaimer",
    ],
  };
}
