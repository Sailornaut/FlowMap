# TrafficScout Test Fixtures

Six scenario properties required by the governing roadmap (Phase 2). Each file is a self-contained JSON object representing a property with its tenants, vacancies, and (where applicable) evidence and comparables. These fixtures are used by domain-module tests and, once the pipeline is live, by integration tests.

**No data in these fixtures is fabricated external data.** All values are plausible but synthetic — they exist purely to exercise scoring, rent analysis, and confidence logic across the six required scenarios.

## Scenarios

1. `healthy-grocery-anchored.json` — Grocery-anchored neighborhood center with low vacancy
2. `declining-strip.json` — Declining strip center with multiple vacancies and weak evidence
3. `child-activity-dominated.json` — Center dominated by child/family-oriented tenants
4. `small-office.json` — Small office property (non-retail)
5. `insufficient-data.json` — Property with minimal information, testing confidence degradation
6. `physically-disqualified.json` — Vacancy whose physical constraints disqualify food-service categories
