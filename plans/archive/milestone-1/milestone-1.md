# Milestone 1 — Data model + import pipeline

**Goal:** the CSVs load correctly, idempotently and safely into PostgreSQL (PLAN.md §3, §5, §6; D1, D4, D10).

**Done when:** import specs pass, and importing the real data reports `5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected …)`.

## Status

**M1 is complete: all 8 PRs below are merged to `main`** (last merge: PR #25, 2026-11-21 14:17Z; `origin/main` at `c2731e0`). GitHub CI passed on the merge commit.

| Plan PR | Merged as | Notes |
|---|---|---|
| 1 Reference tables | #18 | |
| 2 `calls` table | #20 | Unanswered check tightened (see deviations) |
| 3 Fixture CSVs + helper | #19 | |
| 4 Strict parsing + reference loader | #21 | Review fixes: strict timestamp ranges, field-count check, padded ids rejected |
| 5 Call row validator + reader | #22 | Review fixes: field-count check; carries PR 4's shared files byte-for-byte |
| 6a Staging + latest-version upsert | #23 | Review: update-path spec added |
| 6b Stale `local_date` recompute | #24 | Review fixes: recompute bumps `updated_at`; rollback spec raises after the real recompute |
| 7 Seeds, `import:all`, summary, real-data spec | #25 | Review fix: spec wipes guarded to `RAILS_ENV=test` |

Work was reviewed by independent subagents on every PR from #18 on; their findings are folded in.

**Exit check, verified:**
- `bundle exec rspec` passes (215 examples on #25's head), including the import, idempotence, local-time, rollback and `:real_data` specs; `bin/rubocop` is clean.
- In Docker, the first `bin/rails db:prepare db:seed` logs `5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected; 5,000 inserted, 0 updated, 0 local dates recomputed)`; a second run prints nothing.
- `bin/rails import:all` run twice reports `0 inserted, 0 updated, 0 local dates recomputed`.

**Deviations from the PR specs below:**
- **Unanswered check (PR 2):** `answered OR ((outcome IN ('missed','voicemail')) IS TRUE AND agent_id IS NULL)`. The §5 form evaluates to NULL for an unanswered call with a blank outcome, and Postgres treats NULL as a pass. PLAN.md §5 now shows the corrected form.
- **Strict parsing (PR 4):** timestamps accept fractional seconds before `Z` but are range-checked (`Time.iso8601` alone rolls `2025-02-30` over to March 2); CSV headers must match exactly and in order; timezone match is case-sensitive; money above the 4-byte cap is rejected.
- **Field counts (PR 4, 5):** rows with extra or missing fields, and blank lines, are rejected as `expected N fields, got M` and counted as rows read. Ids with leading or trailing whitespace are rejected.
- **Result (PR 6a):** `Importer::Result` also reports `duplicates_collapsed`; the summary prints it when non-zero.
- **Test database (PR 7):** `db:prepare` seeds a freshly created database, so a new test DB used to receive the real data. `spec/support/clean_database.rb` empties `calls`, `campaigns` and `locations` before the suite, and refuses to run outside `RAILS_ENV=test`.
- **Not done, by choice:** `api/bin/setup` (stock Rails script) still runs only `db:prepare`; the project's root `bin/setup` runs `db:prepare db:seed`. Exact-duplicate collapses in the reference files are not counted in their results.

## PR rules

Same as M0:
- Each PR does one thing, is individually testable and mergeable, and stays under 500 changed lines.
- Generated code (migrations, `db/schema.rb`) is easy to skim; hand-written code and specs carry the review.
- Every PR leaves the app runnable, passes `bundle exec rspec` and `bin/rubocop`, and states how to verify it.

## Conventions used across PRs

- Models and shared constants live in `api/app/models/`; the importer lives in `api/app/services/importer/`. **PR 4 creates `app/services/importer.rb`** (the `Importer` module, initially without `run`) so Zeitwerk resolves the namespace; PR 6a adds `Importer.run`.
- Importer pieces return plain result objects (`Struct`/`Data`) so each can be unit-tested alone. `Importer::Rejection` (`file`, `line`, `reason`) and `Importer::Error` are defined in PR 4 and reused later.
- **Line numbers** are physical file lines (header = line 1, first data row = 2), from `csv.lineno`, not `$.`.
- **Strict parsing** (shared helper introduced in PR 4, reused in PR 5):
  - Money: regex `\A\d+(\.\d{1,2})?\z`, then `BigDecimal` → cents. Rejects `1e3`, `NaN`, whitespace, negatives and more than 2 decimals (fractional cents).
  - Integers: `\A\d+\z` (no `1_0`, no signs, no spaces), and must fit a 4-byte Postgres `integer` (cents and duration ≤ 2,147,483,647).
  - Timestamps: ISO-8601 UTC only, i.e. must end in `Z` (no other offsets).
  - Booleans: exactly `true`/`false`.
  - One spec per case.
- CSV files may have CRLF endings (the real `calls.csv` does). Parsing must leave no `\r` in the last column; a fixture and a spec cover CRLF.
- A missing file or a missing/extra header column in any CSV raises `Importer::Error` (aborts the import, exit non-zero).
- Fixture CSVs live in `api/spec/fixtures/files/import/` and are handed to the importer through a directory path (`data_dir`/`DATA_DIR`).
- **Transactions and specs:** `Importer.run` opens `ActiveRecord::Base.transaction(requires_new: true)` so a failure rolls back even when specs run inside transactional fixtures. The staging table is created with `DROP TABLE IF EXISTS` then `CREATE TEMP TABLE … ON COMMIT DROP`, so it can be re-created within one outer transaction. Importer specs that must observe a real commit/rollback (rollback spec, `:real_data`) use `use_transactional_tests = false` with truncation cleanup.

## PRs

### PR 1 — Reference tables: `campaigns`, `locations`, shared constants
- Shared constants defined once in `api/app/models/` (e.g. `Channel::ALL` = `paid_search social display organic direct referral`, and `Outcome::ALL` = `booked qualified_lead not_qualified missed voicemail`), so both the models and the importer (PR 5) can use them without depending on PR 2.
- Migrations for `campaigns` (text PK `id`, `name`, `channel` + check constraint, `daily_budget_cents integer >= 0`, timestamps) and `locations` (text PK `id`, `name`, `timezone`, timestamps), per §5. The migration uses **literal** channel values (a later constant change must not silently rewrite what an old migration means).
- Models `Campaign` (Rails `enum :channel` from the constant, string-backed, with `scopes: false` because the `display` value would otherwise define `Campaign.display` and shadow `Object#display`) and `Location`. `has_many :calls` is added in PR 2.
- Commit generated `db/schema.rb` changes alongside.
- **Specs:** enum values; DB constraint rejects an unknown channel and a negative budget; text PKs round-trip; a spec asserts the DB check constraint's values equal `Channel::ALL` (catches drift).
- **Check:** `bin/rails db:migrate`, `bundle exec rspec`.

### PR 2 — `calls` table, constraints, indexes, model
- Migration for `calls` exactly as §5: text PK `call_id`, all columns, FKs to `campaigns` (nullable) and `locations`.
- Constraints: the **four §5 table checks** (the three field-rule checks plus `ended_at >= started_at`), plus column checks: `duration_seconds >= 0`, `revenue_cents >= 0`, `outcome` in the list, `marketing_channel` in the channel list (literal values, as in PR 1).
- Indexes: `(local_date)`, `(campaign_id, local_date)`, `(location_id, local_date)`, `(caller_number_hash, started_at, call_id)`.
- `Call` model with enums (`outcome`, `marketing_channel`, both `scopes: false` or prefixed) from the PR 1 constants; associations to `Campaign` and `Location`.
- **Specs:** one example per constraint (violating insert raises `ActiveRecord::StatementInvalid`/`CheckViolation`); a valid booked call and a valid unanswered call insert; FK violations raise; indexes exist (`connection.index_exists?`).
- **Check:** `bin/rails db:migrate`, `bundle exec rspec`.
- Depends on PR 1.

### PR 3 — Fixture CSVs + import spec helper
Test data and the CSV gem only, no application code, so it merges independently.
- Add `gem "csv"` to the Gemfile (not a default gem on Ruby 3.4; PR 3's sanity spec is the first user). Commit the `Gemfile.lock` change.
- Keep the fixtures small. A valid base set (`locations.csv`, `campaigns.csv`, `calls.csv`) in `api/spec/fixtures/files/import/`, plus one scenario directory per concern, each holding only the files that differ, so scenarios don't pollute each other: `rejects/`, `out_of_order/`, `conflicting/`, `newest_invalid/`, `bad_references/`, `crlf/`.
- Coverage, each with a known answer written in a `README.md` next to the files:
  - a call with 3 versions and an out-of-order file position; a no-op re-write (`updated_at` only); a late outcome (`∅ → booked` with revenue);
  - a UTC call that crosses local midnight (Phoenix vs Denver); an unknown-timezone location row; a bad-channel campaign row; a $0-budget campaign; duplicate ids within `locations.csv` and `campaigns.csv`;
  - one rejected call row per rule: unanswered with an agent, unanswered with a non-missed/voicemail outcome, unanswered with blank outcome, unanswered with revenue, answered without agent, answered with `missed`, revenue without booked, booked without revenue, `ended_at < started_at`, duration mismatch, blank required field (`call_id`, `caller_number_hash`, `tracking_number`, `started_at`, `ended_at`), bad timestamp/enum/integer/revenue (including `1e3`, `NaN`, three decimals, out-of-range integer), unknown location, unknown campaign, conflicting versions (same `call_id` and `updated_at`, different content), exact duplicate (collapses, not rejected);
  - a call whose newest version is invalid but whose older version is valid;
  - a re-import scenario where a location that was valid in the base set is now rejected (its calls are rejected, existing rows remain);
  - a CRLF-ended `calls.csv`.
- `spec/support/import_fixtures.rb`: helper to point the importer at a fixture directory.
- **Specs:** sanity spec that every fixture file parses with Ruby `CSV` and has the expected headers and row counts.
- **Size watch:** if the fixtures plus README exceed 500 lines, move the scenario directories used only by one later PR into that PR.
- **Check:** `bundle exec rspec`.
- Depends on nothing (parallel with PR 1–2).

### PR 4 — Importer: strict parsing helpers, load locations and campaigns
- Create `app/services/importer.rb` (module), `Importer::Rejection`, `Importer::Error`, and the strict parsing helper (conventions above).
- `Importer::ReferenceLoader`: reads `locations.csv` and `campaigns.csv`; validates header columns, non-blank ids/names, timezone against `pg_timezone_names` (one query), channel against `Channel::ALL`, and budget via the strict money parser.
- **Duplicate ids within a file:** identical rows collapse to one; rows with the same id and different content are both rejected ("conflicting versions"). This avoids `upsert_all`'s `CardinalityViolation`.
- Writes valid rows with raw `INSERT … ON CONFLICT (id) DO UPDATE SET … WHERE (cols) IS DISTINCT FROM (excluded.cols) RETURNING (xmax = 0) AS inserted`, so inserted/updated/unchanged counts are exact and unchanged rows are not touched. The SQL sets `created_at`/`updated_at` explicitly.
- Returns `location_ids` / `campaign_ids` (`Set`s) for PR 5/6 to reject bad references, plus counts and rejections.
- Does not own the transaction; the caller wraps it (PR 6a).
- **Specs (self-contained, using `Dir.mktmpdir` files, not PR 3 fixtures):** valid load; re-run reports 0 inserted/0 updated; a changed name or timezone is counted as an update; unknown timezone, unknown channel, bad budget, duplicate/conflicting ids rejected with reason and line number; missing file and missing header column raise `Importer::Error`; CRLF input.
- **Check:** `bundle exec rspec`.
- Depends on PR 1.

### PR 5 — Importer: call row parsing and validation
Pure Ruby, no DB writes.
- `Importer::CallRowValidator`: given a CSV row, its line number and the `location_ids`/`campaign_ids` sets, returns either a normalized attribute hash (`started_at`/`ended_at`/`source_updated_at` as UTC `Time`, `revenue_cents` from the strict money parser, boolean, blank → `nil`) or an `Importer::Rejection` with the failed rule.
- Checks (§6 step 2):
  - required fields non-blank (`call_id`, `caller_number_hash`, `tracking_number`, `started_at`, `ended_at`, `location_id`, `marketing_channel`, `updated_at`), since blanks would otherwise hit NOT NULL and roll back the whole import;
  - strict ISO-8601 UTC timestamps, enums (`Outcome::ALL`, `Channel::ALL`), integer duration within range, boolean, decimal revenue;
  - §3 field rules (answered/outcome/agent/revenue consistency, `ended_at >= started_at`, `duration_seconds == ended_at − started_at`);
  - location exists; campaign blank or exists.
- `Importer::CallsReader`: reads `calls.csv` with `CSV.foreach` (streams the parse; header validated as in PR 4), validates each row, and **collects before emitting**: a hash keyed by `(call_id, updated_at)` holds a content digest and its first row. Identical repeats collapse; a differing repeat marks the key conflicted and both rows become "conflicting versions" rejections. Only after the full pass does it return the surviving rows (with line numbers), the rejections, and counts (rows read, exact-duplicate collapses). The whole valid set is held in memory (about 5k rows, fine); "streaming" refers to parsing only.
- **Specs:** one example per rule with its exact reason string; revenue `299.50` → `29950`; strictness cases; conflicting vs exact duplicates, including conflicting rows far apart in the file; CRLF; line numbers are physical lines.
- Specs build rows inline or in tmpdir files (no dependency on PR 3).
- **Check:** `bundle exec rspec`.
- Depends on PR 1 (constants). Parallel with PR 2 and PR 4.

### PR 6a — Importer: staging, latest-version upsert, orchestration
- `Importer.run(data_dir: ENV.fetch("DATA_DIR", <repo>/data))` runs in **one** `transaction(requires_new: true)`: `ReferenceLoader`, `CallsReader`, then:
  - `DROP TABLE IF EXISTS` + `CREATE TEMP TABLE … ON COMMIT DROP` staging table; bulk insert valid rows with their line numbers;
  - upsert `calls` from `SELECT DISTINCT ON (call_id) … ORDER BY call_id, source_updated_at DESC, line_number DESC`, joined to `locations` for `local_date = (started_at AT TIME ZONE timezone)::date`, `ON CONFLICT (call_id) DO UPDATE … WHERE excluded.source_updated_at > calls.source_updated_at RETURNING (xmax = 0) AS inserted`. The SQL sets `created_at`/`updated_at`; the `WHERE` guard means a no-op conflict leaves the row (including `updated_at`) untouched.
- Returns an `Importer::Result`. Counting rules: `rows` = data rows read; `rejected` = rejection count; `calls` = distinct `call_id`s in the DB from this file's valid rows; `older versions dropped` = valid distinct rows − distinct calls (exact-duplicate collapses are reported separately and not counted as dropped versions); `inserted`/`updated` from `RETURNING`, and `local_dates_recomputed` is added in PR 6b. Any failure rolls back everything, including locations and campaigns.
- **Specs** (PR 3 fixtures):
  - latest version chosen by `updated_at` even when out of order; no-op re-writes;
  - importing twice changes nothing (`inserted: 0, updated: 0`; table identical, including `updated_at`);
  - empty DB vs second import produce identical `calls`;
  - UTC call crossing midnight lands on the local date; Phoenix vs Denver;
  - a rejected newest version leaves the call at its older valid version, rejection still counted;
  - rejected rows listed with reasons; a rejected location/campaign rejects only its dependent call rows, and a previously valid location now rejected leaves existing calls in place;
  - two `Importer.run` calls in one example work (staging table re-creation).
- **Check:** `bundle exec rspec`; `bin/rails runner 'p Importer.run'` against the fixture directory.
- Depends on PR 2, PR 3, PR 4, PR 5.

### PR 6b — Importer: stale `local_date` recompute and rollback guarantees
- After the upsert, in the same transaction: `UPDATE calls SET local_date = … FROM locations WHERE calls.location_id = locations.id AND calls.local_date IS DISTINCT FROM (calls.started_at AT TIME ZONE locations.timezone)::date`; the row count fills `Result#local_dates_recomputed`.
- **Specs:**
  - changing a location's timezone in the CSV recomputes existing `local_date`s while the calls upsert skips unchanged calls;
  - re-run reports 0 recomputed;
  - rollback: a forced error after the reference load and after the upsert leaves `locations`, `campaigns` and `calls` exactly as before (uses `use_transactional_tests = false` with truncation cleanup).
- **Check:** `bundle exec rspec`.
- Depends on PR 6a.

### PR 7 — Seeds, `import:all` rake task, summary output, real-data check
- `Importer::Result#summary` formatting (thousands separators): `calls.csv: 5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected; 5,000 inserted, 0 updated, 0 local dates recomputed)`, followed by the first 100 rejections. Reference-file results get their own lines (`locations.csv: 8 loaded, 0 rejected`, `campaigns.csv: …`), and their rejections are listed with the file name.
- `db/seeds.rb`: `puts Importer.run.summary unless Call.exists?` (§6; prints so `docker compose up` logs the summary).
- `lib/tasks/import.rake`: `import:all` forces a re-import regardless of existing data, prints the summary, and exits non-zero on `Importer::Error` or a failed transaction.
- **Specs:** summary text for a known fixture run; rake task exits non-zero for a missing file; seeds call `Importer.run` when `calls` is empty and do not call it otherwise (assert by stubbing `Importer.run`); a failed first import leaves `calls` empty so the next seed retries.
- A `:real_data` spec (non-transactional, truncation cleanup) imports `data/` and asserts `5,411 rows → 5,000 calls, 411 dropped, 0 rejected`. It is fast (about 5k rows), so it runs in the default `rspec` and CI needs no workflow change.
- **Check:** `docker compose up` on a clean volume logs the summary line; a second `docker compose up` skips the import; `bin/rails import:all` twice reports `0 inserted, 0 updated`.
- Update this file's status and the PLAN.md M1 status line when merged.
- Depends on PR 6a and PR 6b.

## Dependencies

- PR 1 → PR 2, PR 4, PR 5
- PR 3 has no prerequisites
- PR 2, PR 3, PR 4, PR 5 → PR 6a → PR 6b → PR 7 (PR 7 also needs PR 6a directly, implied by the chain)
- PR 3 runs in parallel with everything up to PR 6a; PR 2, PR 4 and PR 5 are parallel with each other once PR 1 is merged. PR 3 is consumed only by PR 6a and later (PR 4 and PR 5 specs are self-contained).
- Longest chain: PR 1 → 4 (or 2, or 5) → 6a → 6b → 7 (5 PRs in sequence).

See [milestone-1-dag.drawio](milestone-1-dag.drawio).

## M1 exit check

- `bundle exec rspec` passes (including the import, idempotence, local-time and rollback specs).
- On a clean database, `bin/rails db:prepare db:seed` (or `docker compose up`) prints `5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected …)`.
- `bin/rails import:all` run again reports `0 inserted, 0 updated, 0 local dates recomputed`.
