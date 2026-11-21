# Call Performance Dashboard — Build Plan

## 1. Goal and user

**User:** a marketer deciding which campaigns are worth their budget.
**Question the product answers:** *Which campaigns turn calls into revenue, and at what cost?*
**Slice:** one screen — a sortable campaign table with date-range and location filters, plus a per-campaign daily revenue-vs-spend chart.

Out of scope (per brief): auth, multi-tenancy, cloud deploy, polished UI, scale. No AI features in v1 (a chatbot may come later — see §9).

## 2. Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL |
| API | Ruby on Rails, API-only mode (`api/`) |
| Frontend | Next.js (App Router) + TypeScript (`dashboard-ui/`), Recharts |
| Tests | RSpec (API, `api/spec/`), Vitest + Testing Library (web) |
| Run | `docker compose up` (db, api, web); `bin/dev` for native development |

Exact versions are pinned at scaffold time (latest stable Ruby/Rails/Node/Next/Postgres).

Ports: web `3000`, api `3001`, db `5432`.

## 3. What the data looks like (drives the model)

Profiled from `calls.csv`, `campaigns.csv`, `locations.csv`:

- **5,411 rows, 5,000 calls.** 396 calls have 2–3 versions. `updated_at` marks each write.
  - Most re-writes fill a late outcome (`∅ → booked / qualified_lead / not_qualified`); bookings gain `revenue_usd` in the same write.
  - 100 re-writes change only `updated_at` (no-ops).
  - **Late outcomes (freshness):** 311 answered calls (~8%, incl. 89 bookings) got their outcome in a later write, **24–72h after the call** (median 48h). In a live feed the most recent ~3 days would understate bookings and revenue until outcomes land.
  - **13 calls appear out of order** — the newest version is not the last row in the file. Latest = max `updated_at`, never "last row wins".
  - No outcome ever flips from one value to another.
- **41 calls answered with no final outcome** → "awaiting outcome". Spread evenly across all 60 days, so these are outcomes never recorded, not late ones.
- **161 rows (144 calls) have no `campaign_id`**; they use tracking numbers `+1-555-0190…0199` across organic, direct, referral and paid_search. Channel must live on the call.
  - **Verified:** for calls with a campaign, `marketing_channel` always equals the campaign's `channel` (0 mismatches). Queries therefore use `calls.marketing_channel` for every call.
  - Each of the 22 tracking numbers maps to exactly one campaign; `0190`–`0199` are always unattributed.
- **Timestamps are UTC; 8 offices span 5 timezones.** First call is 2026-09-01T00:39Z, which is Aug 31 locally.
- **Repeat callers:** 2,040 unique callers, 895 called more than once (max 15). 697 of ~1,200 bookings came from a repeat caller; in 635 of those the caller's first call came via a different campaign.
- **Otherwise clean** (every row): valid ISO-8601 UTC timestamps, no orphan FKs, no duplicate `(call_id, updated_at)`, `updated_at >= ended_at`, `duration_seconds` = `ended_at − started_at` exactly (includes ring time; 5–1,633s). Field rules hold without exception:
  - unanswered ⇒ outcome `missed`/`voicemail`, no agent, no revenue;
  - answered ⇒ agent present, outcome `booked`/`qualified_lead`/`not_qualified` or empty;
  - revenue present ⇔ outcome `booked` ($89–$900, median $299).
- **Coverage:** Sep 1 – Oct 30, 2026 (UTC); ~60 days.

## 4. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Import keeps only the latest version of each call (max `updated_at`, never "last row wins") in a single `calls` table; no version history | CSVs are static seed data, so history has no consumer. Out-of-order rows and safe re-runs are handled by the import itself; recovery = re-run the import |
| D2 | Per-call attribution by default; first-call status computed at query time (`NOT EXISTS` an earlier call by the same caller), nothing stored | Per-call matches call-tracking convention. `new_callers` exposes campaigns that mostly re-catch existing callers (635 bookings came from callers first reached via another campaign). At this size, an indexed lookup is cheap; stored flags would duplicate data and need recomputing on every import. A later first-touch toggle uses the same query-time approach. See §7 scaling path |
| D3 | Spend is estimated from budget at query time: `daily_budget_cents` × days in the selected range that fall within data coverage. No spend table; $0-budget campaigns and "No campaign" have spend `null` | The data has no actual spend, and "at what cost?" is half the question, so budget is the only available proxy. It assumes every campaign spends its full budget daily, so cost is overstated and revenue ÷ spend understated (labelled "Budgeted spend (est.)"; limitation noted in DECISIONS.md). Coverage starts on Aug 31 local, a partial day (the first call is Sep 1 00:39Z, a few hours before local midnight), but is charged a full day's budget: ~1.7% extra over 60 days, accepted and documented alongside the full-spend assumption rather than dropping the day and its calls. A table would only copy the budget once per day; if actual spend arrives (§13), add storage then behind the same spend calculation |
| D4 | Days bucket in each office's timezone (`local_date` stored) | "Tuesday" means Tuesday at the office. No hour-of-day view in v1, so no `local_hour`; adding one later is a column plus a backfill |
| D5 | Booking rate = booked ÷ all calls; also show unanswered rate and awaiting-outcome count | Consistent with revenue and spend per booking (full funnel); rankings identical to booked ÷ dispositioned in this data |
| D6 | One screen + two data endpoints; aggregation in SQL | Thin, focused slice |
| D7 | Docker Compose for the one command | Reviewer needs only Docker |
| D8 | No AI features in v1 | Focus on core slice; core must work without a model anyway |
| D9 | Default range = previous calendar quarter (Q1 Jan–Mar … Q4 Oct–Dec), with presets and a data-coverage header | Matches how marketers report |
| D10 | Money as integer cents; enums as strings + DB check constraint + Rails `enum` | Exact sums; enums easy to evolve |
| D11 | With a location filter, campaign spend is allocated to the office by its share of the campaign's calls in the selected range; labelled "allocated by call share" | Spend is campaign-level; dividing one office's revenue by the whole campaign's spend would understate revenue ÷ spend. Call share keeps spend per call equal across offices, so office differences in revenue ÷ spend reflect how well each office converts calls (revenue share would be circular). Daily office spend uses cumulative rounding (§7), so each office's range total is within half a cent of its exact share and its daily rows still sum to it; office totals can differ from the campaign total by under a cent per office (the UI never sums offices). A campaign with no calls in range has no share to allocate, so its spend is `null` under a location filter |
| D12 | "No campaign" row always shown (no hide toggle), pinned below the ranked campaigns and above totals regardless of sort, muted styling, spend "—", tooltip with channel breakdown; totals include it | It's a catch-all bucket, not a fundable campaign, so it shouldn't rank against campaigns; always visible so count and revenue columns sum to totals; a fixed position surfaces the tracking gap (e.g. 12 paid_search calls credited to no campaign). Null metrics (here and for $0-budget campaigns) sort last in both directions. Totals include it in counts and revenue, but not in the totals' spend ratios (§7) |

## 5. Data model (PostgreSQL)

### `campaigns`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `cmp_01` |
| `name` | text not null | |
| `channel` | text not null | check in (`paid_search`,`social`,`display`,`organic`,`direct`,`referral`); list defined once as a shared Rails constant used by both `Campaign` and `Call` enums and their check constraints |
| `daily_budget_cents` | integer not null | `>= 0` |
| timestamps | | |

### `locations`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `loc_01` |
| `name` | text not null | |
| `timezone` | text not null | IANA; validated against `pg_timezone_names` at import |
| timestamps | | |

### `calls` (one row per call, latest version)
| Column | Type | Notes |
|---|---|---|
| `call_id` | text PK | |
| `started_at`, `ended_at` | timestamptz not null | |
| `duration_seconds` | integer not null | `>= 0` |
| `caller_number_hash` | text not null | |
| `tracking_number` | text not null | |
| `campaign_id` | text null FK → `campaigns` | null = unattributed |
| `marketing_channel` | text not null | checked enum, same shared list as `campaigns.channel` |
| `location_id` | text not null FK → `locations` | |
| `answered` | boolean not null | |
| `outcome` | text null | check in (`booked`,`qualified_lead`,`not_qualified`,`missed`,`voicemail`) |
| `revenue_cents` | integer null | `>= 0` |
| `agent_id` | text null | |
| `source_updated_at` | timestamptz not null | CSV `updated_at` of the version kept |
| `local_date` | date not null | `(started_at AT TIME ZONE locations.timezone)::date` |
| timestamps | | |

Check constraints (mirror the §3 field rules; the import rejects violating rows first, so these are a backstop):
- `answered OR (outcome IN ('missed','voicemail') AND agent_id IS NULL)`
- `NOT answered OR (agent_id IS NOT NULL AND (outcome IS NULL OR outcome IN ('booked','qualified_lead','not_qualified')))`
- `(revenue_cents IS NOT NULL) = (outcome IS NOT DISTINCT FROM 'booked')`
- `ended_at >= started_at`

Indexes: `(local_date)`, `(campaign_id, local_date)`, `(location_id, local_date)`, `(caller_number_hash, started_at, call_id)` (serves the first-call lookup in §7).

Not modeled as tables (IDs only in data): agents, tracking numbers.

## 6. Import pipeline

The CSVs are seed data. The API container's start command and `bin/setup` both run `bin/rails db:prepare db:seed`, and `db/seeds.rb` runs the import **only if `calls` is empty** (`Importer.run unless Call.exists?`). Because the import is a single transaction (below), `calls` is either fully loaded or empty, so "empty" reliably means "no import has succeeded yet": the first start imports, a start after a failed import retries, and every other start costs one indexed check. (Plain `db:prepare` seeding is not enough on its own: it seeds only when it creates the database, so a failed first import would never be retried.)

`bin/rails import:all` forces a re-import regardless; run it after editing a CSV, since restarts don't pick up CSV changes. It is idempotent: re-running the same files changes nothing. CSV directory via `DATA_DIR`, defaulting to `data/` at the repo root (where `calls.csv`, `campaigns.csv`, `locations.csv` live); in Docker `./data` is mounted read-only into `/data` and `DATA_DIR=/data`. No run history is stored (see §13 for a recurring feed).

The whole import runs in **one transaction**: if any step fails, nothing changes, including `locations` and `campaigns`.

1. Load `locations.csv`, `campaigns.csv`; validate timezone (against `pg_timezone_names`) and channel. Upsert valid rows by id; invalid rows are rejected and listed like call rows.
2. Stream `calls.csv`; per row: parse/validate (ISO-8601 UTC timestamps, enums, integer duration, decimal revenue → cents, boolean) and check:
   - the §3 field rules (answered/outcome/agent/revenue consistency, `ended_at >= started_at`, `duration_seconds` = `ended_at − started_at`);
   - references: `location_id` is a location loaded in step 1, and `campaign_id` is empty or a campaign loaded in step 1. A call pointing at a missing or rejected location/campaign is rejected with that reason, so a bad reference costs one row, not a foreign-key failure that rolls back the import;
   - duplicate versions: two rows with the same `(call_id, updated_at)` but different content are both rejected ("conflicting versions"), since neither can be trusted as latest; exact duplicates collapse to one.

   Invalid rows are skipped and collected with line number and the failed rule.
3. Still in the transaction:
   - Bulk insert valid rows into a temporary staging table (`ON COMMIT DROP`; never persisted), keeping each row's line number.
   - Upsert `calls` from `SELECT DISTINCT ON (call_id) … ORDER BY call_id, source_updated_at DESC, line_number DESC` over the staging table, joined to `locations` for `local_date`; `ON CONFLICT (call_id) DO UPDATE … WHERE excluded.source_updated_at > calls.source_updated_at`. Latest version wins regardless of file order, and re-running the same file changes nothing. (After step 2 any remaining tie is an exact duplicate, so the line-number tiebreak only makes the choice deterministic.)
   - Recompute `local_date` for every call whose stored value no longer matches its location's current timezone (`UPDATE calls … FROM locations WHERE calls.local_date IS DISTINCT FROM (calls.started_at AT TIME ZONE locations.timezone)::date`). The upsert skips unchanged calls, so without this a timezone corrected in `locations.csv` would leave existing calls on stale local dates.
4. Print a summary and return it as a result object (used by tests):
   ```
   calls.csv: 5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected; 5,000 inserted, 0 updated, 0 local dates recomputed)
   ```
   followed by each rejected row (first 100) with its reason. Exit non-zero if a file can't be read or the transaction fails.

If a call's **newest** version is rejected but an older one is valid, the call keeps its older state (e.g. a late "booked" write that fails validation leaves the call awaiting outcome). The rejection is still counted and listed.

Recovery after a logic bug: fix the code, truncate `calls`, and re-run `import:all` or just restart, since an empty `calls` triggers the import (the CSVs are the source of truth).

## 7. Metric definitions

For a campaign (or the "No campaign" row) within `[from, to]` on `local_date`, optional `location_id`.

**Rows:** every campaign is always listed, including those with no calls in range or at the selected office (zero counts and revenue, null ratios), so the table keeps its shape as filters change. Their spend follows the `spend` rule below (budget × covered days without a location filter; null with one, since there is no call share to allocate). The "No campaign" row appears only when it has calls in range.

| Metric | Definition |
|---|---|
| `calls` | count of calls |
| `unique_callers` | distinct `caller_number_hash` |
| `new_callers` | calls with no earlier call from the same `caller_number_hash` — checked against **all** calls, ignoring the date range, location filter and campaign (ordering by `(started_at, call_id)`). "First" means first since data starts (Sep 1); earlier callers look new |
| `booked` | `outcome = 'booked'` |
| `booking_rate` | `booked / calls` |
| `unanswered_rate` | `NOT answered / calls` |
| `awaiting_outcome` | `answered AND outcome IS NULL` |
| `revenue` | sum `revenue_cents` |
| `spend` | `daily_budget_cents × covered_days`, where `covered_days` = days in `[from, to]` ∩ data coverage (null for $0-budget/unattributed; 0 if the range misses coverage entirely). With `location_id` (D11): `share = office_calls_in_range / campaign_calls_in_range` and spend = `round(share × daily_budget_cents × covered_days)`; null if the campaign has no calls in range. Daily rows (§8) use cumulative rounding: day *k* = `round(share × budget through day k) − round(share × budget through day k−1)`, so they sum exactly to the table figure. (Rounding each day separately would repeat the same error every day, up to 0.5¢ × days per office.) |
| `revenue_per_spend` | `revenue / spend` (null when spend null/0) |
| `spend_per_booking` | `spend / booked` (null when spend null or booked = 0) |

All ratios returned as numbers or `null` — never divide-by-zero, never `Infinity`.

**Totals row:**
- `calls`, `new_callers`, `booked`, `awaiting_outcome`, `revenue`: sums over all rows, including "No campaign" (`new_callers` counts calls, so it sums correctly).
- `unique_callers`: distinct `caller_number_hash` over all calls in range (and office), not the sum of rows, which would count a caller once per campaign they reached.
- `booking_rate`, `unanswered_rate`: recomputed from the summed counts, never averaged across rows.
- `spend`: sum of non-null row spend (null if every row's spend is null).
- `revenue_per_spend`, `spend_per_booking`: computed **only over rows with non-null spend**, i.e. revenue and bookings of paid campaigns ÷ their spend. Including "No campaign" and $0-budget campaigns would add revenue with no spend behind it and overstate the return. The API returns these as `totals.paid` (`revenue_cents`, `booked`, `spend_cents`, `revenue_per_spend`, `spend_per_booking_cents`); the UI labels them "paid campaigns only". The top-level totals object omits these two ratios, so the inflated all-rows version can't be shown by mistake.

**Data coverage** = min to max `calls.local_date` (one indexed query). Spend is clipped to it so that, e.g., the default Jul–Sep range isn't charged two months of budget for July and August, when there are no calls. Spend is calculated in one place (a single SQL fragment/query object) shared by both endpoints, so swapping in actual spend later is a contained change.

### First-call query and scaling path

`new_callers` uses a per-call probe, not a window function over all history:

```sql
NOT EXISTS (
  SELECT 1 FROM calls prior
  WHERE prior.caller_number_hash = c.caller_number_hash
    AND (prior.started_at, prior.call_id) < (c.started_at, c.call_id)
)
```

With the `(caller_number_hash, started_at, call_id)` index, each probe is one short index lookup, so cost scales with calls *in the selected range*, not total history. (`MIN(started_at) OVER (PARTITION BY caller_number_hash)` would read every caller's full history on each request; avoid it.)

If volume grows: measure the metrics query with `EXPLAIN ANALYZE` against realistic data and materialize only when it misses a latency target. The likely next step is a daily rollup table (`campaign_daily_metrics`) that includes `new_callers`; that needs first-call status at write time, so a stored `is_first_call` comes back then, backfilled with the query above, which also serves as its test oracle. Its one maintenance cost is a late-arriving call with an earlier `started_at`: it takes the "first" status from the caller's previous first call, so that row and the affected day's rollups must be updated.

## 8. API (Rails, JSON)

All dates `YYYY-MM-DD`; money in cents; errors as `{ "error": { "code", "message" } }` with 400 on bad params.

### `GET /api/meta`
```json
{
  "data_coverage": { "from": "2026-08-31", "to": "2026-10-29" },
  "freshness": { "latest_update_at": "2026-11-01T13:33:15Z", "outcomes_may_be_incomplete_from": "2026-10-29" },
  "locations": [{ "id": "loc_01", "name": "Northside Office", "timezone": "America/New_York" }],
  "campaigns": [{ "id": "cmp_01", "name": "Search - Brand Terms", "channel": "paid_search" }]
}
```

`latest_update_at` = max `calls.source_updated_at`; `outcomes_may_be_incomplete_from` = date of `latest_update_at − 72h` (the longest observed outcome delay, §3).

### `GET /api/campaigns/metrics?from=&to=&location_id=`
```json
{
  "range": { "from": "2026-07-01", "to": "2026-09-30" },
  "rows": [
    { "campaign_id": "cmp_11", "name": "Referral - Review Sites", "channel": "referral",
      "calls": 198, "unique_callers": 120, "new_callers": 83, "booked": 69,
      "booking_rate": 0.348, "unanswered_rate": 0.187, "awaiting_outcome": 0,
      "revenue_cents": 2365700, "spend_cents": 240000,
      "revenue_per_spend": 9.86, "spend_per_booking_cents": 3478 }
  ],
  "totals": { "...same fields...",
    "paid": { "revenue_cents": 0, "booked": 0, "spend_cents": 0,
              "revenue_per_spend": 0.0, "spend_per_booking_cents": 0 } }
}
```
Unattributed calls appear as a row with `campaign_id: null`, `name: "No campaign"`, plus `channel_breakdown: [{ "channel": "organic", "calls": 63 }, …]` for the tooltip. `totals` include this row in counts and revenue; `totals.paid` holds the spend ratios over paid campaigns only (§7).

### `GET /api/campaigns/:id/daily?from=&to=&location_id=`
```json
{ "campaign": { "id": "cmp_11", "name": "…" },
  "days": [{ "date": "2026-09-01", "calls": 4, "booked": 1, "revenue_cents": 29900, "spend_cents": 4000 }] }
```
Every date in range is present (zero-filled) so charts have no gaps. Each day's spend is `daily_budget_cents` on days within data coverage and 0 outside it (null for $0-budget campaigns). With `location_id`, each day's spend is the office's range-level call share of that day's campaign spend, cumulatively rounded (§7), so the daily rows always sum exactly to the table figure.

Validation: `from`/`to` required and valid; `from <= to`; range ≤ 366 days; unknown `location_id`/campaign → 404.

Health: `GET /up`.

## 9. Frontend (Next.js + TypeScript)

- **Data fetching:** server components call the API using `API_URL` (`http://api:3001` in Docker). Filters live in the URL (`?preset=last_quarter&location=loc_03`) → shareable links, no client state store, no CORS needed.
- **Shared types:** `dashboard-ui/lib/api-types.ts` mirrors §8.
- **Pages**
  - `/` — header (data coverage, freshness / partial-range badges), filter bar (presets: Last quarter (default), This quarter, Last 30 days, Last 90 days, Custom; location select), sortable campaign table with totals row; "No campaign" row always pinned below the ranked campaigns, above totals, muted styling (D12), with a channel-breakdown tooltip. "—" for null metrics; null values sort last in both ascending and descending order. Spend columns labelled "Budgeted spend (est.)". "New callers" header tooltip: "First seen since data starts (Sep 1)".
  - `/campaigns/[id]` — same filters, daily revenue-vs-spend chart (Recharts) and daily table.
- **Badges:** *freshness* — shown when the selected range ends on or after `outcomes_may_be_incomplete_from`: "Outcomes can take up to 3 days to arrive; bookings and revenue after ⟨date⟩ may be incomplete." *Partial range* — shown when the selected range extends beyond data coverage: "Data covers ⟨from⟩ – ⟨to⟩."
- **Date presets:** pure functions in `dashboard-ui/lib/date-ranges.ts` (quarter math, Q1 = Jan–Mar), unit-tested. "Today" = current UTC date.
- **States:** loading, empty range ("No calls in this range — data covers Sep 1 – Oct 29"), API error.
- **Future chatbot:** would call the two metrics endpoints as tools (not free-form SQL) so its numbers always match the table.

## 10. Testing

**API (RSpec), against a small hand-built fixture CSV with known answers:**
- Import: latest version chosen by `updated_at` even when out of order; no-op re-writes; re-importing the same file changes nothing; invalid rows rejected and listed in the import's summary (one fixture row per §3 field rule, each with its reason); a rejected newest version leaves the call at its older valid version; unknown timezone rejected.
- Idempotence: importing into an empty DB and importing twice produce identical `calls`.
- Local time: a UTC call that crosses midnight lands on the office's local date; Phoenix (no DST) vs Denver.
- New callers: a repeat caller across campaigns counts as new only on their earliest call; the earliest call before the selected range or at another location still makes later calls not new; `started_at` tie broken by `call_id`.
- Spend: budget × covered days; a range extending before/after data coverage is clipped; a range entirely outside coverage gives 0; $0-budget campaigns and "No campaign" give null; daily spend rows sum to the table figure.
- Metrics: each §7 formula, null handling (0 bookings, 0 spend), unattributed row; every campaign listed even with no calls in range or at the office; with a location filter, daily spend rows sum exactly to the table figure, each office's spend is within half a cent of its exact share over a multi-week range (guards against per-day rounding drift), and a campaign with no calls in range has null spend.
- Totals: `unique_callers` counts a caller who reached two campaigns once; rates recomputed from summed counts; `totals.paid` ratios exclude "No campaign" and $0-budget campaigns.
- Request specs: param validation and error shape for each endpoint.

**Web (Vitest):** date-range presets (quarter boundaries, year rollover), null formatting, table sorting (nulls last in both directions; "No campaign" stays pinned under every sort).

**Smoke:** `docker compose up` on a clean checkout imports and serves the dashboard.

## 11. Repository layout

```
campaign-dashboard/
├── plans/
│   ├── PLAN.md
│   └── milestone-N/     # one folder per milestone: milestone-N.md + dependency diagram (.drawio)
├── README.md            # one-command setup, tests, data notes
├── DECISIONS.md         # decision summary (product-focused) + AI spend total
├── TECHNICAL.md         # deep dive (incl. freshness + messy data) + Mermaid architecture diagram
├── AI_COST_LOG.md       # model, purpose, cost per entry
├── docker-compose.yml
├── data/                # source data (DATA_DIR defaults to this folder)
│   ├── calls.csv
│   ├── campaigns.csv
│   └── locations.csv
├── shared/             # functionality shared across api/ and dashboard-ui/
├── api/                 # Rails API (specs in api/spec/)
└── dashboard-ui/        # Next.js app
```

## 12. Milestones

Each milestone ends with something demonstrable. Do them in order.

### M0 — Working skeleton
**Goal:** one command runs db + api + web from a clean checkout.
**Status:** code complete. All PRs are merged to `main` (last: PR #15). The per-PR breakdown, deviations and unverified items are in [milestone-0/milestone-0.md](milestone-0/milestone-0.md).

- Remove the nested `api/.git` so the outer repo tracks `api/`.
- Switch the API to PostgreSQL (`pg` gem, `database.yml` from env vars). Replace Minitest `test/` with `rspec-rails` (`api/spec/`).
- `docker-compose.yml`: db `5432`, api `3001`, web `3000`; CSVs mounted read-only at `/data` with `DATA_DIR=/data`; API start command `bin/rails db:prepare db:seed` (§6).
- `bin/dev` and `bin/setup` for native development.
- `dashboard-ui/`: add Vitest and Testing Library; hello page whose server component calls `API_URL/up`.

**Done when:** `docker compose up` on a clean clone shows the hello page with API status OK, and `bundle exec rspec` and `npm test` both run (one smoke test each: `GET /up` and a trivial component test).

### M1 — Data model + import pipeline (§3, §5, §6; D1, D4, D10)
**Goal:** the CSVs load correctly, idempotently and safely.
**Status:** code complete once PR 7 (seeds, `import:all`, summary, real-data spec) merges; PRs 1–6b are merged. Task breakdown and dependency diagram: [milestone-1/milestone-1.md](milestone-1/milestone-1.md).

- Migrations for `campaigns`, `locations`, `calls` with every check constraint and index from §5; shared channel constant defined once.
- Models with Rails `enum`s.
- `Importer`: validate locations/campaigns (timezone against `pg_timezone_names`); stream and validate calls (field rules, references, conflicting versions); stage, then `DISTINCT ON` upsert guarded by `source_updated_at`; recompute stale `local_date`; return a summary result object; all in one transaction.
- `db/seeds.rb` (`Importer.run unless Call.exists?`) and `rake import:all`.
- Fixture CSVs plus import, idempotence and local-time specs (§10).

**Done when:** import specs pass, and importing the real data reports `5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected …)`.

### M2 — Metrics engine + API (§7, §8; D2, D3, D5, D11, D12)
**Goal:** all three endpoints return correct numbers, proven by specs.
**Status:** planned, not started. Ten PRs, all metric and spend math in set-based SQL; task breakdown and dependency diagram: [milestone-2/milestone-2.md](milestone-2/milestone-2.md).

- Single spend calculation, as SQL, shared by both endpoints (set-based so it scales and can later run over a rollup): budget × covered days clipped to data coverage; null for $0-budget and "No campaign"; call-share allocation with cumulative daily rounding under a location filter.
- Campaign metrics query in SQL: every campaign listed, "No campaign" row with `channel_breakdown`, `NOT EXISTS` probe for `new_callers`, null-safe ratios, totals and `totals.paid`.
- Endpoints: `GET /api/meta` (coverage, freshness), `GET /api/campaigns/metrics`, `GET /api/campaigns/:id/daily` (zero-filled). Param validation and error shape (400/404).
- Specs: spend, metrics, totals, new callers, request specs (§10).

**Done when:** all API specs pass, and each endpoint can be `curl`ed against the seeded data with sensible results.

### M3 — Dashboard overview page (§9 `/`; D9, D12)
**Goal:** a marketer can rank campaigns for any range or office.

- `lib/api-types.ts` (mirrors §8) and `lib/date-ranges.ts` (presets, quarter math), unit-tested.
- URL-driven filter bar: presets, custom range, location select.
- Header with data coverage plus freshness and partial-range badges.
- Sortable table: nulls last in both directions; "No campaign" pinned with muted styling and channel-breakdown tooltip; totals row with "paid campaigns only" ratios; "Budgeted spend (est.)" labels.
- Loading, empty and error states.
- Vitest: presets, null formatting, sorting and pinning.

**Done when:** the default "Last quarter" view renders real data, filters update the URL and table, and web tests pass.

### M4 — Campaign detail page (§9 `/campaigns/[id]`)
**Goal:** see how one campaign's daily revenue compares with its spend.

- Same filter bar, carried over from the overview link.
- Add Recharts. Daily revenue-vs-spend chart (consult the `dataviz` skill first) and daily table.
- "Allocated by call share" labelling under a location filter; same empty/error states.

**Done when:** clicking a table row opens the detail page, and its chart and table match the overview (daily spend sums to the table's spend).

### M5 — Docs + clean-checkout smoke test (§11)
**Goal:** a reviewer can run and understand the project unaided.

- `README.md` (one-command setup, tests, data notes), `DECISIONS.md` (incl. spend-estimate limitation and AI spend total), `TECHNICAL.md` (freshness, messy data, Mermaid architecture diagram), `AI_COST_LOG.md` (fold in existing `ai-spend.md`).
- Smoke run: fresh clone → `docker compose up` → dashboard loads with imported data.

**Done when:** a fresh clone passes the smoke run and all docs exist.

### M6 — Stretch (if time)
- First-touch attribution toggle (query-time, as in D2).
- Chatbot that calls the metrics endpoints as tools (§9).

## 13. Open questions

1. Once this is deployed, how does our API actually ingest this call data instead of just reading it from a CSV file? (A recurring feed would bring back a run log — counts, rejections, status per run — and possibly version history; see D1.)
2. Where would actual spend come from (e.g. ad-platform APIs, manual entry), and at what granularity (daily per campaign)?
