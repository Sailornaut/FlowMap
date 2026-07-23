# TrafficScout — Report Schema

A report is **not a document**; it is structured data (`report_projects` + `report_sections` + `report_versions`) from which documents are rendered reproducibly. The PDF is a projection. Regenerating a finalized version's PDF from its `snapshot` must produce an identical document (asset specs included in the snapshot).

## 1. Report kinds

- `full` — the sellable analysis packet (sections §3).
- `teaser` — prospecting one-pager: observed vacancy count, top 3 tenant opportunities, one tenant-mix gap, one property-level opportunity, and the "complete analysis available" statement. Never includes component-level scoring, weights, methodology detail, or full comparables unless explicitly toggled on.

## 2. Section model

Each `report_sections` row:

```jsonc
{
  "section_key": "executive_summary",     // enum, §3
  "position": 3,
  "payload": { /* typed per section — numbers/tables/refs, no prose */ },
  "narrative": {
    "blocks": [
      {
        "id": "b1",
        "kind": "paragraph|bullet|callout",
        "text": "…",
        "origin": "ai|analyst",
        "grounding_refs": [                 // REQUIRED for origin:"ai"
          { "type": "stage_output",       "stage_result_id": "…", "path": "$.gap_analysis.top_gaps[0]" },
          { "type": "source_observation", "observation_id": "…" },
          { "type": "analyst_note",       "note_id": "…" },
          { "type": "score",              "score_id": "…" }
        ]
      }
    ]
  },
  "review_status": "pending|edited|accepted|rejected",
  "locked": false                            // locked blocks survive regeneration
}
```

**Grounding rule:** an AI-origin block with empty or unresolvable `grounding_refs` fails validation and cannot be stored or rendered. Analyst-origin blocks need no refs (they *are* a source, recorded as such).

**Fact classes** (rendered as footnote markers in the PDF): `measured` · `third_party` · `modeled` · `analyst` · `ai_interpretation`. Every figure in a payload carries a `fact_class` and, except `analyst`, an `observation_id` or `stage_result_id`.

## 3. Full-report section keys (canonical order)

| # | section_key | Payload highlights |
|---|---|---|
| 1 | `cover` | property name/address, cover image asset_key, report date, version, prepared-for |
| 2 | `notice` | confidentiality + methodology notice, methodology_version, disclaimer_version |
| 3 | `executive_summary` | top recommendations (candidate refs), headline stats (all ref'd) |
| 4 | `property_overview` | property record projection, photos, map asset |
| 5 | `tenant_mix` | tenant table w/ categories, anchor flags, mix shares |
| 6 | `vacancy_overview` | vacancy table (sqft, placement, condition, constraints) |
| 7 | `trade_area` | method, params, map asset, geometry ref |
| 8 | `demographics` | ACS table: population, households, income, daytime pop; per-figure observation refs + effective dates |
| 9 | `traffic_dayparts` | AADT counts (measured) vs modeled patterns (labeled), hourly/weekly chart specs |
| 10 | `demand_generators` | employers/schools/housing/transit/activity list w/ distances, observation refs |
| 11 | `access_visibility_parking` | access points, frontage, signage, parking ratio |
| 12 | `competition` | saturation table per category, map asset |
| 13 | `mix_strengths_weaknesses` | gap-analysis outputs |
| 14 | `recommended_categories` | ranked candidates: overall score, top ± factors, confidence (component detail optional appendix) |
| 15 | `vacancy_recommendations` | per-vacancy ranked candidates + disqualifiers with named constraints |
| 16 | `poor_fits` | categories likely to struggle + why (score/component refs) |
| 17 | `synergies` | co-tenancy synergy pairs, cross-shopping rationale |
| 18 | `property_improvements` | physical/market weaknesses and improvement opportunities |
| 19 | `rent_analysis` | **only two shapes:** `supported` (indicated asking-rent range, basis, comparables table w/ per-comp source+date, adjustments, assumptions, confidence, limitations, non-appraisal disclaimer) or `insufficient_data` (explicit statement + what data would be needed). No third shape exists. |
| 20 | `positioning` | leasing/positioning recommendations |
| 21 | `risks_limitations` | risk stage outputs, data limitations, staleness flags |
| 22 | `methodology` | scoring components/weights summary for the used methodology version |
| 23 | `sources` | deduplicated source list w/ retrieval + effective dates |
| 24 | `appendix` | component score tables, raw observation extracts, optional |

Teaser reports use: `cover`, `teaser_summary` (vacancy count, top-3 opportunities, one gap, one property opportunity, CTA statement), `notice`.

## 4. Rendering contracts

- **Charts:** payloads store chart *specs* (`{ type: "hourly_bars", series: [...], observation_refs: [...] }`), not images. One spec → SVG function pair renders web preview and react-pdf output identically.
- **Maps:** `report_assets` rows with `spec` (center, zoom, overlays, style) and a rendered Static-Images PNG in `files`; `spec_hash` prevents redundant fetches.
- **Branding:** `report_projects.branding` (logo file id, palette, footer text); headers/footers/page numbers/watermark (`CONFIDENTIAL` on non-final drafts and optional on final) applied at render.
- **Versioning:** finalize = write `report_versions` row with full `snapshot` (sections + assets specs + methodology version + disclaimer text), render PDF, store file id, audit-log. Finalized versions are immutable; corrections produce version n+1.

## 5. Review workflow states

Project: `draft → reviewed → final → archived` (finalization blocked until every section is `accepted` or `edited`, and zero AI blocks are unreviewed). Section-level: `pending → edited|accepted|rejected`; `locked` sections are skipped by any regeneration. Reports are never sent automatically to anyone.
