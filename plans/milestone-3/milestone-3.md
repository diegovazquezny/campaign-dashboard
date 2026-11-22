# Milestone 3 — Dashboard overview page

**Goal:** a marketer can rank campaigns for any range or office (PLAN.md §9 `/`; D9, D11, D12).

**Done when:** the default "Last quarter" view renders real data, filters update the URL and the table, and `npm test` passes.

## Status

Planned. Eight PRs, not started. Builds on M2 (the three API endpoints, merged). The page is a server component that fetches from the API; all filter state lives in the URL, so there is no client state store and no CORS.

## PR rules

Same as M0–M2:
- Each PR does one thing, is individually testable and mergeable, and stays under 500 changed lines.
- Every PR leaves the app runnable, passes `npm test`, `npm run lint` and `npx tsc --noEmit`, and states how to verify it.

## Conventions used across PRs

- **Read the bundled Next.js docs first.** `dashboard-ui/AGENTS.md` says this Next.js has breaking changes. Before writing page, routing or `searchParams` code, read the relevant guide in `dashboard-ui/node_modules/next/dist/docs/` (for example, whether `searchParams` is a `Promise` in server components).
- **Layout:** pure logic and types in `dashboard-ui/lib/` (each with a `*.test.ts` next to it); components in `dashboard-ui/components/`; the page in `dashboard-ui/app/page.tsx`. Components that need the browser (filter bar, sortable table) are client components; everything else stays on the server.
- **Pure first:** date math, formatting, sorting and badge conditions are plain functions with no React, so Vitest covers the rules directly and components only wire them up.
- **Types mirror §8 exactly** (`lib/api-types.ts`). Metric fields are `number | null`; money is integer cents and is formatted only at the edge (`lib/format.ts`).
- **"Today" is the current UTC date** (§9), passed into the pure functions as an argument so tests never read the clock.
- **Default range is "Last quarter"** (D9). With today = 2026-11-22 that is 2026-07-01..2026-09-30, which starts before data coverage (2026-08-31), so the default view shows the partial-range badge. That is expected, not a bug.
- **API base URL:** `API_URL` (`http://api:3001` in Docker). See how M0's `api-status.tsx` reads it and reuse that.
- **Out of scope for M3:** row links to `/campaigns/[id]` (M4 adds the page and the links), the chart, and any styling beyond a readable table.

## PRs

### PR 1 — API types and fetch client
**Status:** not started
- `lib/api-types.ts`: `Meta`, `CampaignMetricsResponse`, `CampaignRow`, `Totals` (with `paid`), `ChannelBreakdown`, `ApiError`, mirroring §8 (also `DailyResponse`, so M4 doesn't touch this file).
- `lib/api.ts`: `getMeta()` and `getCampaignMetrics({ from, to, locationId })`, server-side `fetch` against `API_URL` with `cache: 'no-store'`. A non-2xx response throws `ApiRequestError` carrying `status` and the API's `error.code`/`message`; a network failure throws the same type with `status: 0`.
- **Tests:** a mocked `fetch` covers the query string (including omitting `location_id` when unset), a parsed success body, a 400 with the error shape, a 404, and a network failure.
- **Check:** `npm test`, `npx tsc --noEmit`.
- Depends on M2 only.

### PR 2 — Date presets and quarter math
**Status:** not started
- `lib/date-ranges.ts`: `resolveRange(params, today)` → `{ from, to, preset }` for the presets `last_quarter` (default), `this_quarter`, `last_30_days`, `last_90_days` and `custom` (`from`/`to` taken from the URL). Quarters are Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. "Last 30 days" is `today − 29 .. today` (30 days, inclusive); "Last 90 days" likewise. "This quarter" is quarter start `.. today`.
- Invalid input never throws: an unknown preset falls back to `last_quarter`; a custom range with a missing, malformed or impossible date, `from > to`, or more than 366 days is returned as `{ error: <reason> }` so the page can show it without calling the API (the API would answer 400).
- Dates are plain `YYYY-MM-DD` strings and UTC math, with no `Date` local-time parsing.
- **Tests:** quarter boundaries (Mar 31 / Apr 1, Dec 31 / Jan 1), year rollover (last quarter in January is Oct–Dec of the previous year), leap day, each preset with a fixed `today`, every custom-range failure (366 days accepted, 367 rejected, `2026-02-30` rejected).
- **Check:** `npm test`.
- Depends on M2 only. Parallel with PR 1.

### PR 3 — Formatting and sorting
**Status:** not started
- `lib/format.ts`: `formatCount`, `formatMoney` (cents → `$12,345`; whole dollars for table cells), `formatPercent`, `formatRatio` (revenue ÷ spend as `3.44×`); every function returns `"—"` for `null`/`undefined`, and never `NaN` or `Infinity`.
- `lib/sort-rows.ts`: `sortRows(rows, key, direction)` over `CampaignRow[]` returns `{ ranked, noCampaign }`: campaigns sorted by the key with **nulls last in both directions**, ties broken by name for a stable order, and the "No campaign" row (`campaign_id: null`) separated out so the table can pin it under every sort (D12).
- **Tests:** null formatting for each formatter; ascending and descending with nulls present stay last in both; "No campaign" never appears inside `ranked` for any key or direction; a stable tie order; sorting does not mutate its input; a text key (`name`) and numeric keys both work.
- **Check:** `npm test`.
- Depends on PR 1 (types).

### PR 4 — Filter bar
**Status:** not started
- `components/filter-bar.tsx` (client component): preset buttons (Last quarter, This quarter, Last 30 days, Last 90 days, Custom), two date inputs shown for Custom, and a location `<select>` fed from `meta.locations` (first option "All offices"). Every change writes to the URL query (`?preset=…&from=…&to=…&location=…`) with the router, dropping params that are at their default.
- `lib/filters.ts`: `buildQuery(current, change)` as a pure function (preset change clears `from`/`to`; Custom keeps them), tested without React.
- Shows the resolved error from PR 2 under the inputs when the custom range is invalid.
- **Tests:** Testing Library renders the presets and locations, marks the active preset, a click or select change calls the router with the right query (router mocked), the custom inputs appear only for Custom, the error message shows for an invalid custom range; `buildQuery` unit tests.
- **Check:** `npm test`; the component renders in a scratch page or the test.
- Depends on PR 1 (`Meta` type), PR 2.

### PR 5 — Header with coverage and badges
**Status:** not started
- `lib/badges.ts`: `partialRange(range, coverage)` (the range extends before `from` or after `to`; `false` when coverage is `null`) and `freshnessWarning(range, freshness)` (the range ends on or after `outcomes_may_be_incomplete_from`; `false` when freshness is `null`), both pure.
- `components/page-header.tsx`: title, "Data covers ⟨from⟩ – ⟨to⟩", and the two badges with the §9 wording: freshness — "Outcomes can take up to 3 days to arrive; bookings and revenue after ⟨date⟩ may be incomplete."; partial range — "Data covers ⟨from⟩ – ⟨to⟩.". Dates are displayed in a readable form (`Sep 1`), formatted without local-time parsing.
- **Tests:** badge conditions at the boundary (range ends the day before / on / after the freshness date; range starts one day before coverage; range inside coverage); `null` coverage and freshness show no badges and a "No data loaded" header; the component renders each badge text.
- **Check:** `npm test`.
- Depends on PR 1 (types). Parallel with PR 3 and PR 4.

### PR 6 — Campaign table
**Status:** not started
- `components/campaign-table.tsx` (client component, receives `rows` and `totals` as props): sortable headers (click toggles direction, `aria-sort` set), columns Campaign, Channel, Calls, Unique callers, New callers, Booked, Booking rate, Unanswered rate, Awaiting outcome, Revenue, Budgeted spend (est.), Revenue ÷ spend, Spend per booking.
- Order: ranked campaigns from `sortRows`, then the muted "No campaign" row (spend "—", a tooltip listing `channel_breakdown`), then the totals row. The totals row's revenue ÷ spend and spend per booking come from `totals.paid`, and the row is labelled "Totals (spend ratios: paid campaigns only)".
- "New callers" header tooltip: "First seen since data starts (Sep 1)". The spend column header reads "Budgeted spend (est.)"; under a location filter (a `locationSelected` prop) the header adds "allocated by call share" (D11).
- Default sort: revenue, descending. No row links yet (M4).
- **Tests:** rows render in sorted order; clicking a header re-sorts and flips direction; "No campaign" stays above totals under every sort; null cells show "—"; the tooltip text lists the breakdown; the totals row shows the `paid` ratios; the location label appears only when a location is selected.
- **Check:** `npm test`.
- Depends on PR 3 (and its types from PR 1).

### PR 7 — Overview page
**Status:** not started
- `app/page.tsx` (server component): `resolveRange` → if the range is valid, `getMeta()` and `getCampaignMetrics()` in parallel → `PageHeader`, `FilterBar` and `CampaignTable`. An invalid custom range renders the filter bar with its error and skips the API call.
- `app/loading.tsx` (skeleton or "Loading…"), `app/error.tsx` (API error with a retry link; shows the API's `error.message`).
- Empty state: when `totals.calls` is 0, "No calls in this range — data covers ⟨from⟩ – ⟨to⟩" (§9) replaces the table; the filter bar stays so the user can change the range.
- Replaces the M0 hello page's API status check on `/`; keep `api-status.tsx` only if something still uses it, otherwise delete it with its test.
- **Tests:** page-level tests with `getMeta`/`getCampaignMetrics` mocked: default render uses the last-quarter range from a fixed clock; a location query param reaches the API call; the empty state; the API error path; an invalid custom range makes no API call.
- **Check:** `npm test`; `docker compose up`, open `http://localhost:3000`: the table shows real data, the partial-range badge shows for the default range, switching preset and office changes the URL and the numbers.
- Depends on PR 1, PR 2, PR 4, PR 5, PR 6.

### PR 8 — M3 exit check and docs
**Status:** not started

No application code.
- Run the exit check against `docker compose up` on seeded data and record it in this file: the default view's row count and totals match `curl 'localhost:3001/api/campaigns/metrics?from=2026-07-01&to=2026-09-30'`; a location filter changes the numbers and the URL; the "No campaign" row stays pinned under each sort; the partial-range badge shows for the default range and the freshness badge shows for a range ending on or after 2026-10-29; a custom range of 367 days shows the inline error.
- Update this file's status and the PLAN.md M3 status line; note any deviations.
- Depends on PR 7.

## Dependencies

Each "Depends on" line lists direct dependencies only; these match the diagram's arrows.

- M2 → PR 1, PR 2
- PR 1 → PR 3, PR 4, PR 5
- PR 2 → PR 4
- PR 3 → PR 6
- PR 1, PR 2, PR 4, PR 5, PR 6 → PR 7
- PR 7 → PR 8
- PR 1 and PR 2 can start together. PR 3, PR 4 and PR 5 run in parallel once PR 1 (and for PR 4, PR 2) is merged.
- Longest chain: PR 1 → 3 → 6 → 7 → 8 (5 PRs in sequence).

See [milestone-3-dag.drawio](milestone-3-dag.drawio).

## M3 exit check

- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
- With `docker compose up` and seeded data, `/` renders the default "Last quarter" table with the "No campaign" row and a totals row, and its numbers match the `/api/campaigns/metrics` response.
- Presets, the custom range and the location select update the URL and the table; invalid custom ranges, empty ranges and API errors show their states.
