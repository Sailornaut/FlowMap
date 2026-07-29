// @ts-check
/**
 * TrafficScout Analysis PDF Document — Professional CRE Report
 *
 * Server-side PDF generation using @react-pdf/renderer.
 * Uses React.createElement (no JSX) so it runs in plain Node without a build step.
 *
 * Report structure:
 *   1. Property Overview
 *   2. Executive Assessment
 *   3. Opportunity Summary
 *   4. Analysis Status
 *   5. Demographics (with benchmarks & interpretation)
 *   6. Trade Area
 *   7. Demand Generators
 *   8. Recommended Tenant Categories (with evidence & breakdown)
 *   9. Risks & Limitations
 *  10. Additional Data That Would Increase Confidence
 *  11. Evidence & Sources
 *  12. Methodology
 *
 * All data comes from the analysis record + joined tables — no fabrication.
 * Narrative text summarizes deterministic findings but never invents evidence.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { styles, COLORS, FONT_SIZES, VERDICT_COLORS, RATING_COLORS } from "./styles.js";
import {
  computeSiteRating,
  generateExecutiveNarrative,
  explainCandidate,
  interpretDemographics,
  explainConfidence,
  analyzeRisks,
  identifyDataGaps,
  buildOpportunitySummary,
} from "./report-narratives.js";

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

function EvidencePositive(text) {
  return h(Text, { style: styles.evidencePositive }, `✓ ${text}`);
}

function EvidenceNegative(text) {
  return h(Text, { style: styles.evidenceNegative }, `• ${text}`);
}

// ── Score breakdown bar ─────────────────────────────────────────────

function ScoreBar(label, earned, max) {
  if (max === 0) return null;
  const pct = Math.min(100, Math.round((earned / max) * 100));
  const barColor = pct >= 70 ? COLORS.success : pct >= 40 ? COLORS.accent : COLORS.warning;

  return h(View, { style: styles.scoreBarContainer },
    h(Text, { style: styles.scoreBarLabel }, label),
    h(View, { style: styles.scoreBarTrack },
      h(View, { style: [styles.scoreBarFill, { width: `${pct}%`, backgroundColor: barColor }] }),
    ),
    h(Text, { style: styles.scoreBarValue }, `${earned}/${max}`),
  );
}

// ── Table ────────────────────────────────────────────────────────────

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
  return h(Page, { size: "LETTER", style: styles.page, wrap: true },
    h(View, { style: styles.header, fixed: true },
      h(Text, { style: styles.headerText }, "TrafficScout Analysis Report"),
      h(Text, { style: styles.headerText }, propertyName || "Property Report"),
    ),
    ...children,
    h(View, { style: styles.footer, fixed: true },
      h(Text, { style: styles.footerText }, `CONFIDENTIAL — Prepared ${reportDate}`),
      h(Text, {
        style: styles.pageNumber,
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
      }),
    ),
  );
}

// ── Section 0: Cover ────────────────────────────────────────────────

function CoverPage(analysis, reportDate, siteRating) {
  const p = analysis.properties || {};
  const address = [p.address, p.city, p.state, p.postal_code].filter(Boolean).join(", ");
  const ratingColor = RATING_COLORS[siteRating?.rating] || COLORS.primary;

  return h(Page, { size: "LETTER", style: [styles.page, { justifyContent: "center", alignItems: "center" }] },
    h(View, { style: { alignItems: "center", marginBottom: 60 } },
      h(Text, { style: { fontSize: FONT_SIZES["4xl"], fontFamily: "Helvetica-Bold", color: COLORS.primary, marginBottom: 8 } }, "TrafficScout"),
      h(Text, { style: { fontSize: FONT_SIZES.lg, color: COLORS.mutedLight, letterSpacing: 3 } }, "ANALYSIS REPORT"),
    ),
    h(View, { style: { alignItems: "center", marginBottom: 30, paddingHorizontal: 40 } },
      h(Text, { style: { fontSize: FONT_SIZES["2xl"], fontFamily: "Helvetica-Bold", color: COLORS.text, textAlign: "center", marginBottom: 8 } }, p.name || "Property Analysis"),
      address ? h(Text, { style: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: "center" } }, address) : null,
    ),
    // Site rating on cover
    siteRating ? h(View, { style: { alignItems: "center", marginBottom: 30 } },
      h(View, { style: [styles.ratingBadge, { backgroundColor: ratingColor }] },
        h(Text, { style: styles.ratingText }, siteRating.rating),
      ),
      h(Text, { style: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginTop: 4 } }, `Site Score: ${siteRating.score}/100`),
    ) : null,
    h(View, { style: { width: 60, borderBottomWidth: 2, borderBottomColor: COLORS.accent, marginBottom: 30 } }),
    h(View, { style: { alignItems: "center" } },
      h(Text, { style: { fontSize: FONT_SIZES.base, color: COLORS.textMuted, marginBottom: 4 } }, reportDate),
      analysis.depth ? h(Text, { style: { fontSize: FONT_SIZES.sm, color: COLORS.mutedLight } }, `Analysis depth: ${analysis.depth}`) : null,
    ),
    h(View, { style: { position: "absolute", bottom: 40, alignItems: "center" } },
      h(Text, { style: { fontSize: FONT_SIZES.xs, color: COLORS.mutedLight } }, "CONFIDENTIAL — For internal use only"),
    ),
  );
}

// ── Section 1: Property Overview ────────────────────────────────────

function PropertyOverviewSection(analysis) {
  const p = analysis.properties || {};
  const address = [p.address, p.city, p.state, p.postal_code].filter(Boolean).join(", ");

  const parts = [
    SectionTitle("1. Property Overview"),
    KV("Property Name", p.name),
    KV("Address", address),
    KV("Property Type", (p.property_type || "–").replace(/_/g, " ")),
  ];
  if (p.total_gla_sqft) parts.push(KV("Total GLA", `${fmt(p.total_gla_sqft)} sqft`));
  if (p.year_built) parts.push(KV("Year Built", p.year_built));
  if (p.parking_spaces) parts.push(KV("Parking Spaces", fmt(p.parking_spaces)));
  if (p.lat && p.lng) parts.push(KV("Coordinates", `${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}`));
  if (p.analyst_notes) {
    parts.push(h(View, { style: styles.mt8 },
      h(Text, { style: [styles.small, styles.bold] }, "Analyst Notes"),
      h(Text, { style: styles.small }, p.analyst_notes),
    ));
  }

  return parts;
}

// ── Section 2: Executive Assessment ─────────────────────────────────

function ExecutiveAssessmentSection(analysis, siteRating, narrative, confidenceExplanation, manifest) {
  const ratingColor = RATING_COLORS[siteRating?.rating] || COLORS.primary;

  const parts = [
    SectionTitle("2. Executive Assessment"),
  ];

  // Rating badge
  parts.push(h(View, { style: [styles.row, styles.mb8, { alignItems: "center" }] },
    h(View, { style: [styles.ratingBadge, { backgroundColor: ratingColor, marginRight: 12 }] },
      h(Text, { style: styles.ratingText }, siteRating?.rating || "–"),
    ),
    h(View, { style: { flex: 1 } },
      h(Text, { style: [styles.paragraph, styles.bold] }, `Site Score: ${siteRating?.score ?? "–"}/100`),
      h(Text, { style: styles.small }, `Overall Confidence: ${CONFIDENCE_LABEL[manifest?.overall_confidence] || "–"}`),
      h(Text, { style: styles.small }, `Depth: ${manifest?.depth || "–"}`),
    ),
  ));

  // Executive narrative
  if (narrative) {
    parts.push(Callout(
      h(Text, { style: [styles.calloutText, { lineHeight: 1.6 }] }, narrative),
    ));
  }

  // Rating factors
  if (siteRating?.factors?.length) {
    parts.push(SubsectionTitle("Contributing Factors"));
    for (const factor of siteRating.factors) {
      parts.push(EvidencePositive(factor));
    }
  }

  // Confidence explanation
  if (confidenceExplanation?.reasons?.length) {
    parts.push(SubsectionTitle("Confidence Assessment"));
    for (const reason of confidenceExplanation.reasons) {
      parts.push(h(Text, { style: [styles.small, styles.mb4] }, reason));
    }
  }

  return parts;
}

// ── Section 3: Opportunity Summary ──────────────────────────────────

function OpportunitySummarySection(opportunities) {
  if (!opportunities?.length) return [];

  const parts = [
    SectionTitle("3. Opportunity Summary"),
    P("Top-scoring tenant categories based on available market evidence. Each recommendation cites the deterministic factors that support it."),
  ];

  for (let i = 0; i < Math.min(opportunities.length, 5); i++) {
    const opp = opportunities[i];
    parts.push(h(View, { style: [styles.callout, styles.mt8, { borderLeftColor: COLORS.success }] },
      CalloutText(`${i + 1}. ${opp.category}`, true),
      CalloutText(`Score: ${opp.score}/100 · Sector: ${opp.sector}`),
      ...(opp.reasons.length > 0
        ? opp.reasons.map((r) => h(Text, { style: styles.evidencePositive }, `✓ ${r}`))
        : [CalloutText("Supporting evidence available in detailed scoring below.")]),
    ));
  }

  return parts;
}

// ── Section 4: Analysis Status ──────────────────────────────────────

function AnalysisStatusSection(analysis) {
  const stages = analysis.analysis_stage_results || [];
  const manifest = analysis.analysis_manifests?.[0];

  const parts = [
    SectionTitle("4. Analysis Status"),
    h(View, { style: [styles.row, styles.mb8] },
      h(View, { style: { flex: 1, marginRight: 8 } },
        h(Text, { style: [styles.small, styles.bold, { marginBottom: 2 }] }, "Status"),
        P(analysis.status || "–"),
      ),
      h(View, { style: { flex: 1, marginRight: 8 } },
        h(Text, { style: [styles.small, styles.bold, { marginBottom: 2 }] }, "Depth"),
        P(analysis.depth || "–"),
      ),
      h(View, { style: { flex: 1, marginRight: 8 } },
        h(Text, { style: [styles.small, styles.bold, { marginBottom: 2 }] }, "Pipeline Stages"),
        P(`${stages.length} completed`),
      ),
      h(View, { style: { flex: 1 } },
        h(Text, { style: [styles.small, styles.bold, { marginBottom: 2 }] }, "Cost"),
        P(`$${manifest?.cost?.toFixed(4) || stages.reduce((sum, s) => sum + (s.cost || 0), 0).toFixed(4)}`),
      ),
    ),
  ];

  if (stages.length > 0) {
    parts.push(DataTable(
      [
        { label: "Stage", flex: 2, render: (r) => r.stage_name.replace(/-/g, " ") },
        { label: "Status", flex: 0.7, render: (r) => r.status },
        { label: "Confidence", flex: 1, render: (r) => r.confidence || "–" },
        { label: "Duration", flex: 0.8, align: "right", render: (r) => r.duration_ms != null ? `${r.duration_ms}ms` : "–" },
        { label: "Cost", flex: 0.7, align: "right", render: (r) => r.cost ? `$${r.cost.toFixed(4)}` : "–" },
      ],
      stages,
    ));
  }

  return parts;
}

// ── Section 5: Demographics ─────────────────────────────────────────

function DemographicsSection(stageOutputs, propertyState) {
  const demo = stageOutputs?.demographics?.demographics;
  if (!demo) return [];

  const acsYear = stageOutputs.demographics?.acs_year;
  const interpretations = interpretDemographics(demo, propertyState);

  const parts = [
    SectionTitle("5. Demographics"),
  ];
  if (acsYear) parts.push(Sm(`Source: U.S. Census Bureau, ACS 5-Year Estimates (${acsYear})`));

  // Key metrics with benchmarks
  for (const item of interpretations) {
    parts.push(h(View, { style: [styles.mt8, { marginBottom: 6 }] },
      h(View, { style: styles.row },
        h(Text, { style: [styles.paragraph, styles.bold, { width: 160 }] }, item.metric),
        h(Text, { style: [styles.paragraph, styles.bold, { width: 80 }] }, item.value),
        ...item.benchmarks.map((b) =>
          h(View, { style: [styles.row, { marginLeft: 8 }] },
            h(Text, { style: styles.small }, `${b.label}: `),
            h(Text, { style: [styles.small, styles.bold] }, b.value),
          )
        ),
      ),
      h(Text, { style: styles.interpretationText }, item.interpretation),
    ));
  }

  // Additional raw metrics not covered by interpretation
  if (demo.bachelors_plus != null) {
    parts.push(h(View, { style: styles.mt8 }, KV("Bachelor's Degree or Higher", fmt(demo.bachelors_plus))));
  }

  return parts;
}

// ── Section 6: Trade Area ───────────────────────────────────────────

function TradeAreaSection(stageOutputs) {
  const ta = stageOutputs?.["trade-area"];
  if (!ta?.isochrones) return [];

  return [
    SectionTitle("6. Trade Area"),
    P("Trade areas are defined using drive-time isochrones from the property location, calculated via the Mapbox Isochrone API with a standard driving profile."),
    DataTable(
      [
        { label: "Drive Time", flex: 1, render: (r) => `${r.minutes} min` },
        { label: "Polygon Vertices", flex: 1, align: "right", render: (r) => fmt(r.vertices) },
      ],
      ta.isochrones.map((iso) => ({
        minutes: iso.minutes,
        vertices: iso.geometry?.coordinates?.[0]?.length || 0,
      })),
    ),
    P("These isochrones define the primary, secondary, and tertiary trade areas from which the property draws customers. Demographics are currently based on the census tract containing the property; trade-area-weighted demographics would be more precise."),
  ];
}

// ── Section 7: Demand Generators ────────────────────────────────────

function DemandGeneratorsSection(stageOutputs) {
  const dg = stageOutputs?.["demand-generators"];
  if (!dg?.category_summary) return [];

  const categories = Object.entries(dg.category_summary)
    .map(([cat, info]) => ({
      category: cat.replace(/_/g, " "),
      count: typeof info === "object" ? info.count : info,
      nearest: typeof info === "object" ? info.nearest_m || info.closest_distance_m : null,
      nearestName: typeof info === "object" ? info.nearest_name || info.closest_name : null,
    }))
    .sort((a, b) => b.count - a.count);

  const total = dg.total_pois || 0;
  const radius = dg.search_radius_m || "1600";

  const parts = [
    SectionTitle("7. Demand Generators"),
    P(`${fmt(total)} points of interest identified within ${fmt(radius)}m of the property${dg.provider ? ` (source: ${dg.provider === "osm_overpass" ? "OpenStreetMap" : dg.provider})` : ""}.`),
  ];

  // Interpretation
  if (total >= 30) {
    parts.push(h(Text, { style: styles.interpretationText }, "The density of nearby demand generators indicates an active commercial environment with multiple traffic drivers. This benefits categories that rely on pass-by and cross-shopping traffic."));
  } else if (total >= 10) {
    parts.push(h(Text, { style: styles.interpretationText }, "A moderate number of demand generators are present. The location should support neighborhood-serving retail but may require destination-draw uses to thrive."));
  } else if (total > 0) {
    parts.push(h(Text, { style: styles.interpretationText }, "Limited demand generators nearby. Tenant categories that rely heavily on co-located traffic may underperform. Destination-oriented uses may be more appropriate."));
  }

  parts.push(DataTable(
    [
      { label: "Category", flex: 2, render: (r) => r.category },
      { label: "Count", flex: 0.6, align: "right", render: (r) => fmt(r.count) },
      { label: "Nearest", flex: 2, render: (r) => {
        const dist = r.nearest != null ? `${fmt(Math.round(r.nearest))}m` : "–";
        return r.nearestName ? `${r.nearestName} (${dist})` : dist;
      }},
    ],
    categories,
  ));

  return parts;
}

// ── Section 8: Tenant Category Recommendations ─────────────────────

function TenantRecommendationsSection(candidates, stageOutputs) {
  if (!candidates?.length) return [];

  const recommended = candidates.filter((c) => c.verdict === "recommend");
  const neutral = candidates.filter((c) => c.verdict === "neutral");
  const disqualified = candidates.filter((c) => c.verdict === "disqualified");

  const parts = [
    SectionTitle("8. Recommended Tenant Categories"),
  ];

  const sectorCount = new Set(candidates.map((c) => c.tenant_categories?.sector)).size;
  parts.push(P(`${candidates.length} categories evaluated across ${sectorCount} sectors. ${recommended.length} recommended, ${disqualified.length} disqualified.`));

  // Detailed recommended candidates with evidence
  if (recommended.length) {
    parts.push(SubsectionTitle(`Recommended (${recommended.length})`, VERDICT_COLORS.recommend));

    for (const candidate of recommended.slice(0, 15)) {
      const score = candidate.opportunity_scores;
      const { supporting, concerns, breakdown } = explainCandidate(candidate, stageOutputs);
      const catName = candidate.tenant_categories?.name || "–";
      const sector = (candidate.tenant_categories?.sector || "–").replace(/_/g, " ");

      // Category header
      parts.push(h(View, { style: [styles.mt8, { marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: COLORS.border, paddingBottom: 4 }] },
        h(View, { style: styles.spaceBetween },
          h(Text, { style: [styles.paragraph, styles.bold, { fontSize: FONT_SIZES.md }] }, `#${candidate.rank} ${catName}`),
          h(Text, { style: [styles.paragraph, styles.bold, { color: COLORS.success }] }, `Score: ${score?.overall ?? "–"}/100`),
        ),
        h(View, { style: styles.row },
          h(Text, { style: styles.small }, `Sector: ${sector}`),
          h(Text, { style: [styles.small, { marginLeft: 12 }] }, `Confidence: ${score?.confidence || "–"}`),
          h(Text, { style: [styles.small, { marginLeft: 12 }] }, `Completeness: ${fmtPct(score?.completeness)}`),
        ),
      ));

      // Strengths (raw positive_factors from scoring engine)
      const positives = score?.positive_factors || [];
      if (positives.length > 0) {
        parts.push(h(View, { style: styles.mb4 },
          h(Text, { style: [styles.small, styles.bold, { color: COLORS.success, marginBottom: 2 }] }, "Strengths"),
          ...positives.map((f) => EvidencePositive(f)),
        ));
      }

      // Concerns (raw negative_factors from scoring engine)
      const negatives = score?.negative_factors || [];
      if (negatives.length > 0) {
        parts.push(h(View, { style: styles.mb4 },
          h(Text, { style: [styles.small, styles.bold, { color: COLORS.warning, marginBottom: 2 }] }, "Concerns"),
          ...negatives.map((f) => EvidenceNegative(f)),
        ));
      }

      // Score breakdown bars
      if (breakdown.length > 0) {
        parts.push(h(View, { style: styles.mb4 },
          h(Text, { style: [styles.small, styles.bold, { marginBottom: 2 }] }, "Score Breakdown"),
          ...breakdown.filter((b) => b.maxScore > 0).map((b) =>
            ScoreBar(b.label, b.score, b.maxScore)
          ),
        ));
      }

      // Component scores grid (raw normalized values per component)
      const components = score?.score_components || [];
      if (components.length > 0) {
        const sorted = [...components].sort(
          (a, b) => (b.normalized || 0) * (b.weight || 0) - (a.normalized || 0) * (a.weight || 0)
        );
        parts.push(h(View, { style: styles.mb4 },
          h(Text, { style: [styles.small, styles.bold, { marginBottom: 2 }] }, "Component Scores"),
          h(View, { style: { flexDirection: "row", flexWrap: "wrap" } },
            ...sorted.map((c) =>
              h(View, {
                key: c.component_key,
                style: {
                  width: "33%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 1,
                  paddingHorizontal: 4,
                },
              },
                h(Text, { style: [styles.small, { color: COLORS.muted }] },
                  (c.component_key || "").replace(/_/g, " ")
                ),
                h(Text, { style: [styles.small, styles.bold] }, `${c.normalized ?? "–"}`),
              )
            ),
          ),
        ));
      }

      // Narrative evidence (generated interpretations)
      if (supporting.length > 0) {
        parts.push(h(View, { style: styles.mb4 },
          h(Text, { style: [styles.small, styles.bold, { color: COLORS.success, marginBottom: 2 }] }, "Supporting Evidence"),
          ...supporting.map((s) => EvidencePositive(s)),
        ));
      }

      // Narrative concerns
      if (concerns.length > 0) {
        parts.push(h(View, { style: styles.mb4 },
          h(Text, { style: [styles.small, styles.bold, { color: COLORS.warning, marginBottom: 2 }] }, "Potential Concerns"),
          ...concerns.map((c) => EvidenceNegative(c)),
        ));
      }
    }

    if (recommended.length > 15) {
      parts.push(Sm(`${recommended.length - 15} additional recommended categories not shown.`));
    }
  }

  // Neutral (summary table only)
  if (neutral.length) {
    parts.push(SubsectionTitle(`Neutral (${neutral.length})`, VERDICT_COLORS.neutral));
    parts.push(DataTable(
      [
        { label: "#", flex: 0.4, render: (r) => `${r.rank}` },
        { label: "Category", flex: 2, render: (r) => r.tenant_categories?.name || "–" },
        { label: "Score", flex: 0.7, align: "right", render: (r) => `${r.opportunity_scores?.overall ?? "–"}` },
        { label: "Confidence", flex: 1, render: (r) => r.opportunity_scores?.confidence || "–" },
      ],
      neutral.slice(0, 10),
    ));
  }

  // Disqualified
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

// ── Section 9: Risks & Limitations ──────────────────────────────────

function RisksSection(risks) {
  if (!risks?.length) return [];

  return [
    SectionTitle("9. Risks & Limitations"),
    P("The following limitations affect the precision of this analysis. These are inherent to the current data coverage and do not reflect failures in the analysis methodology."),
    ...risks.map((r) =>
      h(View, { style: styles.riskCard },
        h(Text, { style: styles.riskTitle }, r.risk),
        h(Text, { style: styles.riskBody }, `Impact: ${r.impact}`),
        h(Text, { style: styles.riskBody }, `Mitigation: ${r.mitigation}`),
      )
    ),
  ];
}

// ── Section 10: Data Gaps ───────────────────────────────────────────

function DataGapsSection(gaps) {
  if (!gaps?.length) return [];

  return [
    SectionTitle("10. Additional Data That Would Increase Confidence"),
    P("The following data sources, if available, would increase the precision and confidence of this analysis. Their absence does not invalidate current findings but represents opportunities for deeper analysis."),
    ...gaps.map((g) =>
      h(View, { style: styles.dataGapItem },
        h(Text, { style: styles.dataGapLabel }, g.label),
        h(Text, { style: styles.dataGapDescription }, g.description),
        h(Text, { style: [styles.dataGapDescription, { fontStyle: "italic" }] }, `Value: ${g.impact}`),
      )
    ),
  ];
}

// ── Section 11: Evidence & Sources ──────────────────────────────────

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
        kind: obs.source_kind || obs.data_sources?.kind || "–",
        tier: obs.reliability_tier ?? obs.data_sources?.reliability_tier ?? "–",
        confidence: obs.confidence || "–",
        retrieved: obs.retrieved_at,
      });
    }
  }

  return [
    SectionTitle("11. Evidence & Sources"),
    P(`This analysis is supported by ${uniqueSources.length} data source${uniqueSources.length !== 1 ? "s" : ""}. Every finding is traceable to a specific observation with a recorded retrieval timestamp.`),
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
    h(View, { style: [styles.callout, styles.mt8] },
      CalloutText("Reliability Tiers", true),
      CalloutText("Tier 1 — Authoritative government or institutional data (Census, BLS)"),
      CalloutText("Tier 2 — Reliable commercial APIs with quality guarantees (Mapbox)"),
      CalloutText("Tier 3 — Community-contributed data requiring validation (OpenStreetMap)"),
    ),
  ];
}

// ── Section 12: Methodology ─────────────────────────────────────────

function MethodologySection(analysis, manifest) {
  const parts = [
    SectionTitle("12. Methodology"),
    P("This report was generated by the TrafficScout deterministic analysis pipeline. All scores are computed from real data sources using a versioned scoring methodology with 15 weighted components. No AI-generated rankings or fabricated statistics are used. Every conclusion points back to measurable evidence."),
  ];

  if (manifest) {
    // stages_planned is the JSONB array from the manifest; its length is the stage count
    const stageCount = Array.isArray(manifest.stages_planned) ? manifest.stages_planned.length : null;
    parts.push(h(View, { style: styles.mt8 },
      KV("Manifest Version", manifest.version),
      KV("Runner Version", manifest.runner_version),
      stageCount ? KV("Pipeline Stages", `${stageCount} stages`) : null,
      KV("Overall Confidence", CONFIDENCE_LABEL[manifest.overall_confidence] || manifest.overall_confidence || "–"),
      KV("Depth", manifest.depth),
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
    h(View, { style: [styles.callout, styles.mt8] },
      CalloutText("Scoring Components", true),
      CalloutText("The opportunity score for each tenant category is a weighted composite of 15 components:"),
      CalloutText("Local Demand (10%), Demographic Alignment (10%), Competition (10%), Tenant Mix Gap (10%), Unit Size Fit (8%), Physical Fit (8%), Traffic Alignment (8%), Daypart Alignment (6%), Cotenancy Synergy (6%), Visibility (4%), Accessibility (4%), Parking (4%), Market Growth (4%), Rent Feasibility (4%), Data Quality (4%)."),
      CalloutText("Components without real data default to 50 (neutral) and reduce the score's completeness metric."),
    ),
  );

  // Disclaimer
  parts.push(h(View, { style: styles.mt16 },
    SubsectionTitle("Notice & Disclaimer"),
    P("This report is provided for internal analytical purposes only. The information contained herein is derived from public and third-party data sources believed to be reliable but not independently verified."),
    P("This analysis does not constitute an appraisal, property valuation, or investment recommendation. Tenant category recommendations are based on statistical scoring of market conditions and physical property attributes. Actual leasing outcomes depend on many factors not captured in this analysis, including tenant-specific requirements, market timing, and negotiation dynamics."),
    h(View, { style: styles.mt8 },
      Sm(`Analysis ID: ${analysis.id}`),
      Sm(`Generated: ${fmtDate(analysis.started_at || analysis.created_at)}`),
      analysis.completed_at ? Sm(`Completed: ${fmtDate(analysis.completed_at)}`) : null,
      Sm(`© ${new Date().getFullYear()} TrafficScout. All rights reserved.`),
    ),
  ));

  return parts;
}

// ── Main document assembly ───────────────────────────────────────────

function buildDocument({ analysis, summary, candidates, vacancies, observations, stageOutputs }) {
  const reportDate = fmtDate(new Date());
  const propertyName = analysis.properties?.name || "Property";
  const manifest = analysis.analysis_manifests?.[0];
  const stageResults = analysis.analysis_stage_results || [];
  const propertyState = analysis.properties?.state || null;

  // Compute narrative elements
  const siteRating = computeSiteRating({ stageOutputs, candidates, manifest, stageResults });
  const narrative = generateExecutiveNarrative({ stageOutputs, candidates, siteRating, stageResults });
  const confidenceExplanation = explainConfidence(manifest, stageResults);
  const risks = analyzeRisks(stageOutputs, stageResults, candidates);
  const dataGaps = identifyDataGaps(stageOutputs, stageResults);
  const opportunities = buildOpportunitySummary(candidates, stageOutputs);

  const pages = [
    // Cover
    CoverPage(analysis, reportDate, siteRating),

    // Section 1: Property Overview + Section 2: Executive Assessment
    ReportPage(propertyName, reportDate,
      ...PropertyOverviewSection(analysis),
      ...ExecutiveAssessmentSection(analysis, siteRating, narrative, confidenceExplanation, manifest),
    ),
  ];

  // Section 3: Opportunity Summary
  if (opportunities.length > 0) {
    pages.push(ReportPage(propertyName, reportDate,
      ...OpportunitySummarySection(opportunities),
    ));
  }

  // Section 4: Analysis Status
  pages.push(ReportPage(propertyName, reportDate,
    ...AnalysisStatusSection(analysis),
  ));

  // Section 5: Demographics + Section 6: Trade Area
  const demoContent = DemographicsSection(stageOutputs, propertyState);
  const taContent = TradeAreaSection(stageOutputs);
  if (demoContent.length || taContent.length) {
    pages.push(ReportPage(propertyName, reportDate, ...demoContent, ...taContent));
  }

  // Section 7: Demand Generators
  const dgContent = DemandGeneratorsSection(stageOutputs);
  if (dgContent.length) {
    pages.push(ReportPage(propertyName, reportDate, ...dgContent));
  }

  // Section 8: Tenant Recommendations (with evidence and breakdowns)
  const recContent = TenantRecommendationsSection(candidates, stageOutputs);
  if (recContent.length) {
    pages.push(ReportPage(propertyName, reportDate, ...recContent));
  }

  // Section 9: Risks + Section 10: Data Gaps
  pages.push(ReportPage(propertyName, reportDate,
    ...RisksSection(risks),
    ...DataGapsSection(dataGaps),
  ));

  // Section 11: Sources + Section 12: Methodology
  pages.push(ReportPage(propertyName, reportDate,
    ...SourcesSection(observations),
    ...MethodologySection(analysis, manifest),
  ));

  return h(Document, {
    title: `TrafficScout Report — ${propertyName}`,
    author: "TrafficScout",
    subject: "Commercial Real Estate Site Analysis",
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
  const stageResults = analysis?.analysis_stage_results || [];
  const manifest = analysis?.analysis_manifests?.[0];

  // Compute site rating for snapshot
  const siteRating = computeSiteRating({ stageOutputs, candidates, manifest, stageResults });

  return {
    schema_version: "2.0.0",
    generated_at: new Date().toISOString(),
    analysis_id: analysis.id,
    analysis_status: analysis.status,
    property_id: analysis.property_id,
    property_name: analysis.properties?.name,
    manifest_version: manifest?.version,
    manifest_depth: manifest?.depth,
    overall_confidence: manifest?.overall_confidence,
    depth: analysis.depth,
    site_rating: siteRating?.rating,
    site_score: siteRating?.score,
    summary: summary || null,
    candidate_count: candidates?.length || 0,
    recommended_count: candidates?.filter((c) => c.verdict === "recommend")?.length || 0,
    vacancy_count: vacancies?.length || 0,
    observation_count: observations?.length || 0,
    stage_keys: stageOutputs ? Object.keys(stageOutputs) : [],
    sections_rendered: [
      "cover",
      "property_overview",
      "executive_assessment",
      ...(candidates?.filter((c) => c.verdict === "recommend")?.length ? ["opportunity_summary"] : []),
      "analysis_status",
      ...(stageOutputs?.demographics ? ["demographics"] : []),
      ...(stageOutputs?.["trade-area"] ? ["trade_area"] : []),
      ...(stageOutputs?.["demand-generators"] ? ["demand_generators"] : []),
      ...(candidates?.length ? ["tenant_recommendations"] : []),
      "risks_limitations",
      "data_gaps",
      "sources",
      "methodology",
    ],
  };
}
