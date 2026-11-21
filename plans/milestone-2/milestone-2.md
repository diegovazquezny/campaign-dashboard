# Milestone 2 — Metrics engine + API

**Goal:** all three endpoints return correct numbers, proven by specs (PLAN.md §7, §8; D2, D3, D5, D11, D12).

**Done when:** all API specs pass, and each endpoint can be `curl`ed against the seeded data with sensible results.

## Status

In progress. PR 1 (#28), PR 2 (#30), PR 3 (#29) and PR 4 (#31) and PR 5 (#32) are merged; PR 6 is in review. Ten PRs. Designed for scale: all metric and spend math is set-based SQL (see conventions). Builds on M1 (models, importer, seeded `calls`/`campaigns`/`locations`). The API has no controllers or `/api` routes yet (only `GET /up`), so PR 1 creates the controller base. The plan was reviewed by an independent agent; its findings are folded in below.

## PR rules

Same as M0/M1:
- Each PR does one thing, is individually testable and mergeable, and stays under 500 changed lines.
- Every PR leaves the app runnable, passes `bundle exec rspec` and `bin/rubocop`, and states how to verify it.

## Conventions used across PRs

- **Layout:** query objects live in `api/app/services/metrics/` (module `Metrics`); controllers in `api/app/controllers/api/`. PR 1 creates `app/controllers/api/base_controller.rb`; the first PR that needs the `Metrics` namespace (PR 2) creates `app/services/metrics.rb` so Zeitwerk resolves it.
- **Dates:** `from`/`to` are `Date`s on `calls.local_date`, inclusive. Money is integer cents everywhere.
- **Designed for scale: everything is computed in SQL, set-based.** Counts, revenue, distinct callers, `NOT EXISTS`, spend and ratios all come from one statement per endpoint, so sorting, filtering and paging on any metric (including spend-derived ones) can later be pushed into the database, and the same expressions can run over a rollup table instead of `calls`. Nothing loops over campaigns or days in Ruby. Spend lives in one SQL fragment module (`Metrics::SpendSql`) used by both endpoints (§7), so swapping in actual spend later only touches it.
- **The `call_facts` CTE (PR 4) is the single source of per-call data.** `Metrics::CallFacts.sql(from:, to:, location_id:)` returns one row per call in `[from, to]` on `local_date` with `call_id`, `campaign_id`, `marketing_channel`, `caller_number_hash`, `at_office` (true for every row when no location filter, otherwise `location_id = :loc`), `is_new`, `booked`, `unanswered`, `awaiting`, `revenue_cents`. Every metric aggregates it:
  - **Office filtering is done with `FILTER (WHERE at_office)`, never by removing rows**, so the campaign-wide call count (the D11 share denominator) and the office count come from one scan: `share = count(*) FILTER (WHERE at_office) / count(*)`.
  - `is_new` is the §7 `NOT EXISTS` probe against the **unfiltered `calls` table**, never against the CTE (otherwise `new_callers` would silently respect range and office). It is only evaluated for `at_office` rows, so other offices cost nothing.
- **Exact rounding:** spend is always multiply-then-divide in Postgres `numeric`: `round(office_calls::numeric × budget × covered_days / campaign_calls)`. `share` is never materialised as a column or a division result, so there is no truncation before `round`. `round` is half away from zero; the spec oracle uses `Rational#round`, which matches.
- **JSON types:** Postgres `numeric` reaches Rails as `BigDecimal`, which serializes to a JSON string. So SQL casts money to `::bigint` and ratios to `::float8`, and request specs assert `be_a(Numeric)` on every metric field.
- **Ratios are returned unrounded** (the UI formats them). `spend_per_booking_cents` is a Float. The values in the PLAN.md §8 example are illustrative.
- **Spec oracle:** a small `Rational`-based reference implementation of the spend rules lives in `spec/support/` only. Specs compare the SQL against it, including randomized cases; the app never uses it.
- **Scale path (from §7):** if `EXPLAIN ANALYZE` on larger data misses a latency target, the next step is a daily rollup table (`campaign_daily_metrics`, with a stored `is_first_call` for `new_callers`). The queries are written so the `call_facts` CTE can be repointed at it. The rollup itself is out of scope for M2.
- **Empty database:** if `calls` is empty, coverage is `nil`: `covered_days` is 0, and `/api/meta` returns `data_coverage: null` and `freshness: null`.
- **Row order:** campaigns by `id`, then the "No campaign" row last (the UI re-sorts and pins it; D12).
- **Spend rules summary** (used by PR 3, 5, 8):

  | Case | Spend |
  |---|---|
  | `daily_budget_cents = 0`, or "No campaign" | `NULL` |
  | No location filter | `budget × covered_days` (0 when no covered days) |
  | Location filter, campaign has no calls in range | `NULL` |
  | Location filter, campaign has calls in range but none at the office | `0` |
  | Location filter, otherwise | `round(office_calls × budget × covered_days / campaign_calls)` |

- **Specs** build their own small data with hand-built helpers (`Campaign`/`Call` builders in `spec/support/metrics_data.rb`, introduced in PR 1), not the import fixtures, so each scenario's known answer is visible next to its assertion.

## PRs

### PR 1 — API base: routing, params validation, error shape, spec helpers
**Status:** done (PR #28)
- `Api::BaseController` (inherits `ApplicationController`): rescues `Api::BadRequest` → 400 and `ActiveRecord::RecordNotFound` → 404, rendering `{ "error": { "code", "message" } }` (`bad_request`, `not_found`).
- `Api::RangeParams` (plain Ruby): parses and validates `from`, `to`, optional `location_id`: both dates required and strict `YYYY-MM-DD` (real calendar dates), `from <= to`, range ≤ 366 days; a present but blank `location_id` → 400; unknown `location_id` → 404. Returns a `Data` object `(from, to, location)`. **Param validation (400) always runs before any record lookup (404).**
- `namespace :api` in `routes.rb` (no endpoints yet beyond a spec-only dummy route/controller used to exercise the base controller).
- `spec/support/metrics_data.rb`: small builders for campaigns, locations and calls used by every later PR (PR 1 has no consumer yet beyond its own sanity spec).
- **Specs:** every validation failure (missing, malformed, impossible date such as `2026-02-30`, reversed range, 367 days, 366 days accepted, blank `location_id`), unknown location → 404, 400 wins over 404, error JSON shape; builders create valid rows.
- **Check:** `bundle exec rspec`.
- Depends on nothing.

### PR 2 — Data coverage + `GET /api/meta`
**Status:** done (PR #30)
- `Metrics::DataCoverage.current` → `(from, to)` (min/max `calls.local_date`, one indexed query) or `nil`; also exposes `latest_update_at` (max `source_updated_at`).
- `GET /api/meta` per §8: `data_coverage`, `freshness` (`latest_update_at`, `outcomes_may_be_incomplete_from` = date of `latest_update_at − 72h`, in UTC), `locations`, `campaigns` (ordered by id).
- **Specs:** coverage from hand-built calls (local-date based, not UTC: a call at `2026-09-01T00:39Z` in New York covers `2026-08-31`); freshness date math across a day boundary; empty DB → nulls; request spec for the JSON shape.
- **Check:** `bundle exec rspec`; `curl localhost:3001/api/meta` shows the real data's coverage (the plan's example dates are illustrative; verify against the data).
- Depends on PR 1 (controller base, spec helpers).

### PR 3 — Spend calculation in SQL (`Metrics::SpendSql`)
**Status:** done (PR #29)
SQL fragments only (no controller, no endpoint), so it merges independently. Specs run through Postgres with inline `VALUES` rows, so no model data is needed.
- **Pinned contract** (PR 5 and PR 8 are written against it). Inputs are columns of a caller-supplied relation, plus bound dates:
  - `SpendSql.covered_days(from:, to:, cov_from:, cov_to:)` → SQL scalar `GREATEST(0, LEAST(to, cov_to) − GREATEST(from, cov_from) + 1)`; 0 when disjoint, and 0 when coverage is `nil`.
  - `SpendSql.total_cents(filtered:)` → SQL scalar over the columns `daily_budget_cents`, `covered_days`, `office_calls`, `campaign_calls`, implementing the spend rules table above. `filtered` says whether a location filter is active (without it, `office_calls`/`campaign_calls` are ignored).
  - `SpendSql.daily_cents(filtered:)` → SQL scalar over `daily_budget_cents`, `office_calls`, `campaign_calls`, `covered_day` (boolean: the day is inside data coverage; NULL counts as not covered) and `covered_through` (covered days from `from` through this day: 0 before coverage, counting consecutive days from 1 on the first covered day, and staying at the total after coverage ends), giving the day's spend as `round(f(covered_through)) − round(f(covered_through − 1))` with `f(k) = office_calls × budget × k / campaign_calls`; no window function needed. Without a location, the budget on covered days and 0 elsewhere. Days with `covered_day` false get 0 (with a location filter). The daily values always sum to `total_cents`, provided `covered_through` follows the definition above.
  - All results are cast `::bigint`.
- `spec/support/spend_oracle.rb`: the `Rational` reference implementation used only by specs.
- **Specs:** SQL vs oracle over a table of cases and a randomized batch (budgets, ranges, shares); covered days (inside, partial overlap before/after, disjoint, single day, nil coverage); every row of the spend rules table; a 1/3 share over a multi-week range where per-day rounding would drift (daily sum == total, total within half a cent of exact); an exact half-cent case (rounds away from zero); zero covered days → 0 (not `NULL`) for a paid campaign.
- **Size watch:** if this exceeds 500 lines, move `daily_cents` (and its specs) into PR 8, its only consumer.
- **Check:** `bundle exec rspec`.
- Depends on nothing.

### PR 4 — `call_facts` CTE and per-campaign counts
**Status:** done (PR #31)
- `Metrics::CallFacts.sql(from:, to:, location_id: nil)` as described in the conventions (`at_office`, `is_new` via the `NOT EXISTS` probe on unfiltered `calls`, `(started_at, call_id)` ordering).
- `Metrics::CampaignCounts.sql(...)` (composable fragment; `.call(...)` runs it): per-campaign `calls`, `unique_callers`, `new_callers`, `booked`, `unanswered`, `awaiting_outcome`, `revenue_cents`, all `FILTER (WHERE at_office)`, plus `campaign_calls` (unfiltered by office). Every campaign is listed (LEFT JOIN from `campaigns`; zeros when no calls in range or at the office). A `campaign_id: nil` "No campaign" row appears **only when it has office calls in range**, with `channel_breakdown` (`[{channel, calls}]`, office calls only, by calls descending then channel). Breakdown uses `marketing_channel` (§3).
- **Specs:** every count with a known answer; booking/awaiting/unanswered definitions; every campaign listed with zero counts when out of range or at another office; no "No campaign" row when there are none (including none at the selected office); channel breakdown respects the location filter; `new_callers`: a repeat caller across campaigns counts once as new, an earlier call before the range or at another office makes a later call not new, `started_at` tie broken by `call_id`; `unique_callers` per row; date filter uses `local_date`, not the UTC date.
- **Size watch:** if specs push it past 500 lines, move the `new_callers` specs into a follow-up PR that depends on this one; PR 5 and PR 8 then also wait for it (add the edge to the diagram).
- **Check:** `bundle exec rspec`; `EXPLAIN` of the probe shows the `(caller_number_hash, started_at, call_id)` index in use (an index probe per call in range, not a scan of all history).
- Depends on PR 1 (spec helpers).

### PR 5 — Campaign rows: spend and ratios
**Status:** done (PR #32)
- `Metrics::CampaignMetrics.rows(from:, to:, location_id: nil)` → the `rows` array of §8. One SQL statement: the `CampaignCounts` fragment joined to `campaigns` for the budget, `covered_days` from `DataCoverage` bound dates, `total_cents` from `Metrics::SpendSql`, and the ratios. The statement is structured so PR 6 can add a grouping set for totals.
- Ratios: `booking_rate = booked / calls`, `unanswered_rate`, `revenue_per_spend`, `spend_per_booking_cents`, all null-safe (`NULL` when the denominator is `NULL` or 0), cast `::float8`; counts and money `::bigint`.
- **Specs:** each §7 formula; 0 bookings and `NULL`/0 spend → `nil` ratios; $0-budget → `nil` spend; "No campaign" spend `nil`; range partly outside coverage clipped, entirely outside coverage with no location filter → spend 0 and `nil` ratios (with a location filter, a campaign with no calls in range is `nil` even when no day is covered: the no-calls rule wins); with a location filter: spend follows call share, an office with no calls for a campaign that has calls elsewhere → 0, a campaign with no calls in range → `nil`, $0-budget → `nil`, each office's spend within half a cent of the exact share over a multi-week range; spend and ratios match the PR 3 spec oracle on a hand-built dataset.
- **Check:** `bundle exec rspec`; `bin/rails runner` prints sensible rows for the real data.
- Depends on PR 2 (coverage), PR 3, PR 4.

### PR 6 — Totals and `totals.paid`
**Status:** in review
**Deviation:** the totals row is a `UNION ALL` over the same `spent` CTE (tagged `is_total`, so "No campaign" is never confused with it) instead of a `GROUPING SETS` clause: `unique_callers` needs a separate `count(DISTINCT)` over all calls in range either way, and the union keeps spend computed once and the SQL simpler.
- Extends the PR 5 statement with a grouping set `((campaign_id), ())` and `GROUPING(campaign_id)`, so the "No campaign" row (`campaign_id` NULL) is never confused with the grand total. `Metrics::CampaignMetrics.call(...)` returns the full §8 hash: `range`, `rows`, `totals`.
- `totals` has exactly: `calls`, `unique_callers`, `new_callers`, `booked`, `booking_rate`, `unanswered_rate`, `awaiting_outcome`, `revenue_cents`, `spend_cents`, `paid`. It omits `campaign_id`, `name`, `channel`, `channel_breakdown` and the two spend ratios (`revenue_per_spend`, `spend_per_booking_cents`).
- Per §7: counts and revenue summed over all rows including "No campaign"; `unique_callers` is a `count(DISTINCT caller_number_hash)` over all calls in range and office (never a sum of rows); rates recomputed from summed counts; `spend_cents` = sum of non-null row spend (`nil` if all `nil`).
- `totals.paid` = `revenue_cents`, `booked`, `spend_cents`, `revenue_per_spend`, `spend_per_booking_cents` over rows with **non-null** spend only. Rows with spend 0 (a paid campaign outside coverage) count as non-null, so the ratios are `nil` but their revenue and bookings are included. When no row has non-null spend: `revenue_cents: 0`, `booked: 0`, `spend_cents: nil`, ratios `nil`.
- **Specs:** `totals.unique_callers` counts a caller who reached two campaigns once; rates not averaged; "No campaign" and $0-budget excluded from `totals.paid`; the all-`NULL`-spend case; a paid row with spend 0 included in `paid`; totals with a location filter; the "No campaign" row and the grand total are never confused when "No campaign" is absent or present; every total field is numeric or `nil` (no `BigDecimal`).
- **Check:** `bundle exec rspec`; `bin/rails runner` shows totals consistent with the rows.
- Depends on PR 5.

### PR 7 — `GET /api/campaigns/metrics`
- Route, `Api::CampaignMetricsController#index` using `RangeParams` and `CampaignMetrics.call`; JSON per §8.
- **Request specs:** happy path shape (all §8 fields present, `channel_breakdown` only on the "No campaign" row), every metric field `be_a(Numeric)` or `nil`, location filter, 400s (missing/invalid/reversed/too-long range, blank `location_id`), 404 unknown `location_id`.
- **Check:** `bundle exec rspec`; `curl 'localhost:3001/api/campaigns/metrics?from=2026-09-01&to=2026-09-30'` returns 12 campaign rows plus "No campaign" (the real `campaigns.csv` has 12 campaigns) with sane totals.
- Depends on PR 6 (which builds on PR 5, PR 2 and PR 1, so the controller base is already merged).

### PR 8 — `GET /api/campaigns/:id/daily`
- `Metrics::CampaignDaily.call(campaign:, from:, to:, location_id: nil)`: one SQL statement: `generate_series` over the range left-joined to `call_facts` (this campaign) grouped by `local_date` (`calls`, `booked`, `revenue_cents`, all `FILTER (WHERE at_office)`), so zero-filling happens in the database, with per-day `spend_cents` from `SpendSql.daily_cents`. `campaign_calls`/`office_calls` come from the whole range (not per day), as in §8, from the same scan.
- Route and `Api::CampaignDailyController#show`; params validated first (400), then the campaign lookup (404 via `RecordNotFound`). The "No campaign" row has no daily view in v1 (`:id` must be a real campaign).
- **Specs:** every date present with zeros; counts and revenue per day on `local_date`; spend on covered days and 0 outside coverage; `nil` spend for $0-budget; the daily spend sums exactly to `SpendSql.total_cents` **without** a location filter when the range partly overlaps coverage, and **with** a location filter (including an office with no calls → 0, and a campaign with no calls in range → `nil`); every field numeric or `nil`; unknown campaign and location → 404; param errors → 400 (400 wins when both apply).
- **Check:** `bundle exec rspec`; `curl 'localhost:3001/api/campaigns/cmp_01/daily?from=2026-09-01&to=2026-09-30'`.
- Depends on PR 2 (coverage, controller base), PR 3, PR 4. Parallel with PR 5–7.

### PR 9 — Cross-endpoint consistency on the real data
Specs only, no application code.
- `:real_data` spec (non-transactional, as in M1; fast, runs in the default `rspec`): imports `data/` and asserts
  - for every campaign, the sum of `/daily` `spend_cents`, `revenue_cents`, `calls` and `booked` over a range equals the same campaign's row in `/metrics`, with and without a location filter, and for a range that partly overlaps data coverage;
  - for the default quarter, `totals.calls` equals the sum of row calls, and `totals.revenue_cents` equals total `calls.revenue_cents` in range;
  - no ratio is `NaN`/`Infinity`, and `/api/meta` coverage equals the real data's min/max `local_date`.
- **Check:** `bundle exec rspec`.
- Depends on PR 7, PR 8.

### PR 10 — Scale check and M2 docs
No application code.
- A rake task (`bin/rails metrics:scale_check`, not part of the default `rspec`) that builds a larger synthetic dataset in a scratch database (for example 1M calls over 500 campaigns and 50 offices) and prints `EXPLAIN (ANALYZE, BUFFERS)` for the metrics and daily queries.
- Record the output summary in this file: indexes used, timings, and whether the §7 rollup is needed.
- Update this file's status and the PLAN.md M2 status line; record the real-data `curl` results (coverage, row count, totals) as the M2 exit evidence.
- **Check:** the three `curl`s from PRs 2, 7 and 8 against `docker compose up`; the rake task runs end to end.
- Depends on PR 7, PR 8. Parallel with PR 9.

## Dependencies

Each "Depends on" line lists direct dependencies only; these match the diagram's arrows.

- PR 1 → PR 2, PR 4
- PR 2 → PR 5, PR 8
- PR 3 → PR 5, PR 8
- PR 4 → PR 5, PR 8
- PR 5 → PR 6
- PR 6 → PR 7
- PR 7, PR 8 → PR 9, PR 10
- PR 1 and PR 3 have no prerequisites and can start together. PR 8 runs in parallel with PR 5–7. PR 9 and PR 10 run in parallel.
- Longest chain: PR 1 → 2 (or 4) → 5 → 6 → 7 → 9 (or 10) (6 PRs in sequence).

See [milestone-2-dag.drawio](milestone-2-dag.drawio).

## M2 exit check

- `bundle exec rspec` passes (spend SQL vs oracle, call facts, rows, totals, request and real-data specs).
- On seeded data, `curl` of `/api/meta`, `/api/campaigns/metrics` and `/api/campaigns/:id/daily` returns sensible results, and a campaign's daily sums match its metrics row.
- `EXPLAIN ANALYZE` results on the larger synthetic dataset are recorded.
