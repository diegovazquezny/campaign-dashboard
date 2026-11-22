# UI Improvements — Task Plan

**Goal:** deliver the phases in [PLAN.md](PLAN.md) (U0–U3c) as thirteen small, independently mergeable PRs. PLAN.md holds the design and decisions; this file holds the task breakdown.

**Done when:** every task below is merged, `npm test`, `npm run lint`, `npx tsc --noEmit` and `bundle exec rspec` pass, and both themes were checked on the overview, campaign detail and call detail pages.

## Status

T1 (PR #65), T2 (PR #67), T3 (PR #68), T4 (PR #73), T5 (PR #74), T6 (PR #75), T7 (PR #76) T8 (PR #77), T9 (PR #78), T10 (PR #79) and T11 (PR #80, calls list on the campaign page) and T11b (PR #81, the `/campaigns/none` page, split from T11) merged. T12 (call detail page) in review. Everything else not started.

## PR rules

- One thing per PR, individually mergeable and testable, under 500 changed lines (T1 is the one exception). Every PR leaves the app runnable and states how to verify it.
- Branch from `main`. Leave `dashboard-ui/AGENTS.md` out of commits (`next dev` edits it; `git checkout` it first).
- Tailwind utilities only (no CSS Modules, no new global CSS; shared class strings live in TS modules like `components/table-styles.ts`), theme tokens only, check both themes (PLAN.md §4 "Rules for U1–U3 components").
- Metric definitions are base-plan §7 and apply unchanged; reuse `call_facts.rb`, `spend_sql.rb`, `data_coverage.rb`.
- **Gate:** T1–T3 may land any time. T4 onward starts only after base-plan M5 is complete.

## Shared files (conflict hot spots)

Parallel tasks that edit the same file will conflict textually. Whichever merges second rebases; no ordering edge is needed unless the logic overlaps.

| File | Tasks |
|---|---|
| `api/config/routes.rb` | T4, T9, T10 |
| `api/app/services/metrics/call_facts.rb` | T7 (adds missed/voicemail flags), T9 (extracts the new-caller probe) |
| `dashboard-ui/lib/api-types.ts`, `lib/api.ts` | T4/T6, T7, T11 |
| `dashboard-ui/app/page.tsx` | T5, T6, T8 (hence T8 depends on T6) |
| `dashboard-ui/lib/filters.ts` | T11, T12 |

## Tasks

### T1 — Theme, styled with Tailwind (U0)
**Status:** merged (PR #65) · **Depends on:** nothing
- Light ("Clarity") and dark ("Midnight") themes with a toggle, **styled entirely with Tailwind utilities** (decision: Tailwind-first everywhere, no CSS Modules, no bare-element CSS). Started from the uncommitted U0 code, then converted.
- Tokens: `app/styles/typography.css` (type and spacing, **identical in both themes**) plus `theme-light.css` and `theme-dark.css` (colours, radius, shadow; variables on `html[data-theme]`), imported via `app/styles.css`, and mapped to utilities in `app/globals.css` (`@theme inline`, plus a `dark:` variant tied to `data-theme`).
- Components converted to utilities: `campaign-table`, `daily-table`, `daily-chart` (Recharts styles passed as props), `filter-bar`, `page-header`, `back-link`, `theme-toggle`, page shells. New shared pieces: `components/table-styles.ts`, `page-shell.tsx`, `page-title.tsx`, `notice.tsx`.
- **Exception to the 500-line rule:** this PR is large on purpose (it replaces the 400-line bare-element stylesheet with utilities in one go).
- **Acceptance:** font sizes, font styles and spacing are identical in both themes (verified by comparing computed styles light vs dark); colours differ per theme on overview and detail; toggle flips `data-theme` and persists with no white flash; title is "Campaign Dashboard"; no bare-element styling remains except the shared focus ring in `globals.css`; `npm test`, lint and `tsc` pass.

### T2 — Loading states + toggle test (U0)
**Status:** merged (PR #67) · **Depends on:** T1
- Style `app/loading.tsx` and `app/campaigns/[id]/loading.tsx` (wrap in `<main>`, Tailwind utilities).
- Add `components/theme-toggle.test.tsx`: label, flips `data-theme`, writes `localStorage`, survives `localStorage` throwing.
- **Acceptance:** loading and error states look right in both themes; new tests pass.

### T3 — Pager + daily-table pagination (U0b)
**Status:** merged (PR #68) · **Depends on:** T1
- `components/pager.tsx` (`page`, `pageCount`, `onChange`; `<nav aria-label>`, live range label, Tailwind styles) and paging in `components/daily-table.tsx` per PLAN.md §4b (30 rows, oldest first, totals row covers all days, resets on range/office change).
- **Tests:** the six cases listed in §4b (`daily-table.test.tsx`) plus a small `pager.test.tsx`.
- **Acceptance:** 90- and 366-day ranges page correctly; totals match the chart on every page.

### T4 — `GET /api/daily` (U1 backend)
**Status:** merged (PR #73) · **Depends on:** M5
- Extract the date-series + `CallFacts` aggregation out of `campaign_daily.rb` into a shared helper used by both; add the endpoint, route and controller. Response `{ range, days: [{ date, calls, booked, revenue_cents }] }`, zero-filled, includes "No campaign", no spend.
- **Specs:** zero-fill, office filter, "No campaign" included, day sums = metrics `totals`, invalid range 400, unknown location 404; existing `campaign_daily` specs still pass.
- **Acceptance:** endpoint matches PLAN.md §6 U1. Base-plan §8 is updated in T13, not here (docs stay stale until then, deliberately, so each API PR stays small).

### T5 — KPI cards (U1)
**Status:** merged (PR #74) · **Depends on:** M5, T1
- `components/kpi-cards.tsx`: Calls, Booked, Booking rate, Revenue, Revenue ÷ spend (paid only), from `totals`/`totals.paid` already fetched. Null → "—". "May be incomplete" marker when the range reaches `outcomes_may_be_incomplete_from`. Mount above the table in `app/page.tsx`; keep the existing "No calls in this range" message for an empty range.
- **Tests:** values, nulls, empty range, freshness marker.
- **Acceptance:** KPI values equal the table's totals row; both themes checked.

### T6 — Overview chart + page wiring (U1)
**Status:** merged (PR #75) · **Depends on:** T4, T5
- `getAccountDaily()` in `lib/api.ts`, `AccountDailyResponse` in `lib/api-types.ts`, `components/overview-chart.tsx` (calls line, revenue toggle, `role="img"`, caption, screen-reader summary, `--series-calls` token, shaded/noted incomplete days). Page order: header → filters → KPIs → chart → table; empty range keeps the existing message. Resolves open question 1.
- **Tests:** chart component (series, toggle, empty, freshness).
- **Acceptance:** chart day sums equal KPI totals; both respond to filters; both themes checked.

### T7 — Totals missed/voicemail + extended `channel_breakdown` (U2 backend)
**Status:** merged (PR #76) · **Depends on:** M5
- Add `missed` and `voicemail` flags to the facts in `call_facts.rb`, carry them through the per-campaign selects in `campaign_counts.rb` and `TOTAL_KEYS`/SQL in `campaign_metrics.rb`, and expose them in `totals`; add `booked` and `revenue_cents` to the "No campaign" row's `channel_breakdown`; update `Totals` in `lib/api-types.ts`. May conflict with T9 in `call_facts.rb` (rebase on whichever lands first).
- **Specs:** new fields; `missed + voicemail = unanswered`; extended breakdown sums to the row totals; existing specs unchanged.
- **Acceptance:** purely additive; existing clients and tests unaffected.

### T8 — Channel chart + missed-calls card (U2)
**Status:** merged (PR #77) · **Depends on:** T7, T6 (both edit `app/page.tsx`)
- `--channel-*` six-colour tokens (contrast-checked in both themes), `components/channel-chart.tsx` (horizontal bars, calls/revenue switch, client-side aggregation), `components/missed-calls-card.tsx`.
- **Tests:** aggregation (channel sums = totals), card values, both metrics.
- **Acceptance:** bars sum to the totals row; card agrees with `unanswered_rate`; both themes checked.

### T9 — `GET /api/calls` (U3a)
**Status:** merged (PR #78) · **Depends on:** M5
- Route, controller, query service. Filters `from`, `to`, `location_id`, `campaign_id` (id or `none`), `outcome` (five values or `awaiting`, else 400), `page`; page size 25; order `started_at DESC, call_id DESC`; `total` in the response. Row fields per PLAN.md §6 U3a. Never return `caller_number_hash`.
- Also extract the `NOT EXISTS` earlier-call probe from `call_facts.rb` into a shared fragment (`new_callers` uses it now; T10 adds the second consumer). No behaviour change.
- **Specs:** each filter, `none`, `awaiting`, invalid outcome, pagination edges, tie ordering, no hash key; metrics specs still pass after the extraction.
- **Acceptance:** all new specs pass, existing metrics specs unchanged, response has no `caller_number_hash`.

### T10 — `GET /api/calls/:id` (U3a)
**Status:** merged (PR #79) · **Depends on:** T9
- Row fields plus `is_first_call`, `caller_call_count`, `caller_first_seen`; 404 for unknown id; uses the shared fragment.
- **Specs:** first vs repeat caller, agreement with `new_callers` over the same calls, 404, no hash key.
- **Acceptance:** specs pass; `is_first_call` agrees with `new_callers` for the same calls.

### T11 — Calls list on the campaign page (U3b)
**Status:** merged (PR #80; the `none` page and the "No campaign" row link are split into T11b, as this plan allows: the full change was over 500 lines; T11b is in review) · **Depends on:** T9, T3
- `getCalls()` + types; "Calls" section under the daily chart (time in office-local zone, outcome incl. "Awaiting outcome", duration, agent, revenue), paged with `Pager`; `page` added to `buildQuery` and reset on filter change; "No campaign" row links to `/campaigns/none`, a **calls-only page** (static route `app/campaigns/none/page.tsx`, which takes precedence over `[id]`): header, filters and the calls list, no daily chart or table, since `/api/campaigns/:id/daily` has no "none" campaign. Resolves open question 4. If the PR passes 500 lines, split the `none` page into its own follow-up.
- **Tests:** list rendering, empty state, paging, reset on filter change, `buildQuery`.

### T12 — Call detail page (U3c)
**Status:** in review · **Depends on:** T10, T11
- `app/calls/[id]/page.tsx` with About This Call, Caller Data, Marketing Data cards; times in the call's office timezone with zone abbreviation; back link preserving filters and page (new `listHref(campaignId | "none", query)` helper and a `BackLink` prop; the existing `detailHref` in `lib/filters.ts` stays as is); not-found page; rows in T11 link here.
- If this exceeds 500 lines, split the not-found page and back-link change into a follow-up.
- **Tests:** each card incl. null outcome, null revenue, no campaign, first vs repeat caller; back link; not found.
- **Acceptance:** no caller hash anywhere in UI or network responses.

### T13 — Base-plan amendments + exit check
**Status:** not started · **Depends on:** T2, T6, T8, T12
- Apply PLAN.md §7: `../PLAN.md` §1 and D6 notes, §8 docs for `/api/daily`, new totals fields, extended `channel_breakdown`, `/api/calls*`; mention the theme in README if relevant. Update statuses in both plans. Check every relative link.
- Walk the app in both themes and record the result here. Docs only.

## Dependencies

Direct dependencies only; they match the diagram.

- M5 → T4, T5, T7, T9
- T1 → T2, T3, T5
- T4, T5 → T6
- T7, T6 → T8
- T9 → T10, T11
- T3 → T11
- T10, T11 → T12
- T2, T6, T8, T12 → T13
- Start immediately: T1. Then in parallel: T2, T3. After M5, in parallel: T4, T5, T7, T9.
- Longest chains (5 PRs): T1 → T5 → T6 → T8 → T13 and T1 → T3 → T11 → T12 → T13.

See [ui-improvements-dag.drawio](ui-improvements-dag.drawio).
