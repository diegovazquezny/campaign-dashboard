# Milestone 3 — Dashboard overview page

**Goal:** a marketer can rank campaigns for any range or office (PLAN.md §9 `/`; D9, D11, D12).

**Done when:** the default "Last quarter" view renders real data, filters update the URL and the table, and `npm test` passes.

## Status

Complete. Eight PRs, all merged (PR 8 is this exit check). Builds on M2 (the three API endpoints, merged). The page is a server component that fetches from the API; all filter state lives in the URL, so there is no client state store and no CORS.

## PR rules

Same as M0–M2:
- Each PR does one thing, is individually testable and mergeable, and stays under 500 changed lines.
- Every PR leaves the app runnable, passes `npm test`, `npm run lint` and `npx tsc --noEmit`, and states how to verify it.

## Conventions used across PRs

- **Read the bundled Next.js docs first.** `dashboard-ui/AGENTS.md` says this Next.js has breaking changes. Before writing page, routing or `searchParams` code, read the relevant guide in `dashboard-ui/node_modules/next/dist/docs/` (for example, whether `searchParams` is a `Promise` in server components).
- **Layout:** pure logic and types in `dashboard-ui/lib/` (each with a `*.test.ts` next to it); components in `dashboard-ui/components/`; the page in `dashboard-ui/app/page.tsx`. Components that need the browser (filter bar, sortable table) are client components; everything else stays on the server.
- **Pure first:** date math, formatting, sorting and badge conditions are plain functions with no React, so Vitest covers the rules directly and components only wire them up.
- **Types mirror §8 exactly** (`lib/api-types.ts`). Every metric field is `number | null`. Money is integer cents except `spend_per_booking_cents` (and `paid.spend_per_booking_cents`), which is a fractional float (null when `booked` is 0); `revenue_per_spend` is null when spend is null or 0. Money is formatted only at the edge (`lib/format.ts`), rounding with `Math.round`.
- **URL params:** `preset`, `from`, `to`, `location` (§9). `getCampaignMetrics` maps `location` to the API's `location_id`. `from`/`to` count only when `preset=custom`; with any other preset they are ignored. For a repeated param the first value wins.
- **Server-only fetching:** `API_URL` has no `NEXT_PUBLIC_` prefix, so `lib/api.ts` is imported only from server code (type-only imports from `api-types.ts` are fine in client components). `api.ts` reads `process.env.API_URL` at call time, not at module load, and the page calls `await connection()` as M0's `app/page.tsx` does.
- **"Today" is the current UTC date** (§9) while the data is bucketed by office-local dates; this is accepted in the spec. It is passed into the pure functions as an argument, so unit tests never read the clock; page tests use `vi.useFakeTimers()` with `vi.setSystemTime()`.
- **Default range is "Last quarter"** (D9). With today = 2026-11-22 that is 2026-07-01..2026-09-30, which starts before data coverage (2026-08-31), so the default view shows the partial-range badge. That is expected, not a bug.
- **API base URL:** `API_URL` (`http://api:3001` in Docker). M0's `app/page.tsx` shows the pattern (`connection()`, `API_URL` with a localhost fallback, `AbortSignal.timeout`).
- **Out of scope for M3:** row links to `/campaigns/[id]` (M4 adds the page and the links), the chart, and any styling beyond a readable table.

## PRs

### PR 1 — API types and fetch client
**Status:** merged
- `lib/api-types.ts`: `Meta`, `CampaignMetricsResponse`, `CampaignRow`, `Totals` (with `paid`), `ChannelBreakdown`, `ApiError`, mirroring §8 (also `DailyResponse`, so M4 doesn't touch this file). `Totals` has no `campaign_id`, `name`, `channel` or `channel_breakdown`, and no top-level `revenue_per_spend` or `spend_per_booking_cents` (those live in `paid`); `channel_breakdown` exists only on the "No campaign" row; `spend_cents` and the ratio fields are nullable.
- `lib/api.ts`: `getMeta()` and `getCampaignMetrics({ from, to, locationId })`, server-side `fetch` against `API_URL` with `cache: 'no-store'` and `AbortSignal.timeout(5000)`, so a hung API becomes an error instead of a hang. A non-2xx response throws `ApiRequestError` carrying `status` and the API's `error.code`/`message`; a network failure throws the same type with `status: 0`.
- **Tests:** a mocked `fetch` covers the query string (including omitting `location_id` when unset), a parsed success body, a 400 with the error shape, a 404, a network failure and a timeout.
- **Check:** `npm test`, `npx tsc --noEmit`.
- Depends on M2 only.

### PR 2 — Date presets and quarter math
**Status:** merged
- `lib/date-ranges.ts`: `resolveRange(params, today)`, where `params` is `Record<string, string | string[] | undefined>` (the awaited `searchParams`), returns `{ preset, from?, to?, error? }` for the presets `last_quarter` (default), `this_quarter`, `last_30_days`, `last_90_days` and `custom` (`from`/`to` taken from the URL). Quarters are Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. "Last 30 days" is `today − 29 .. today` (30 days, inclusive); "Last 90 days" likewise. "This quarter" is quarter start `.. today`.
- Invalid input never throws: an unknown preset falls back to `last_quarter`; `from`/`to` are ignored unless `preset=custom`; a custom range with a missing, malformed or impossible date, `from > to`, or more than 366 days returns `{ preset: 'custom', from?, to?, error: <reason> }` (whatever dates were given are echoed back so the filter bar can mark Custom active and refill its inputs), and the page shows the error without calling the API (the API would answer 400). Valid results have no `error`.
- Dates are plain `YYYY-MM-DD` strings and UTC math, with no `Date` local-time parsing.
- **Tests:** quarter boundaries (Mar 31 / Apr 1, Dec 31 / Jan 1), year rollover (last quarter in January is Oct–Dec of the previous year), leap day, each preset with a fixed `today`, every custom-range failure (366 days accepted, 367 rejected, `2026-02-30` rejected) with the echoed dates, `from`/`to` ignored for a non-custom preset, and a repeated param (`?from=a&from=b`) using the first value.
- **Check:** `npm test`.
- Depends on M2 only. Parallel with PR 1.

### PR 3 — Formatting and sorting
**Status:** merged
- `lib/format.ts`: `formatCount`, `formatMoney` (cents → `$12,345`; whole dollars for table cells, `Math.round`ed, so fractional `spend_per_booking_cents` works), `formatPercent`, `formatRatio` (revenue ÷ spend as `3.44×`); every function returns `"—"` for `null`/`undefined`, and never `NaN` or `Infinity`.
- `lib/sort-rows.ts`: `sortRows(rows, key, direction)` over `CampaignRow[]`, where `key` is any sortable column (`name`, `channel` as text; the metric fields as numbers; the exported key list is what the table uses for its headers) returns `{ ranked, noCampaign }`: campaigns sorted by the key with **nulls last in both directions**, ties broken by name for a stable order, and the "No campaign" row (`campaign_id: null`) separated out so the table can pin it under every sort (D12).
- **Tests:** null formatting for each formatter; ascending and descending with nulls present stay last in both; "No campaign" never appears inside `ranked` for any key or direction; a stable tie order; sorting does not mutate its input; a text key (`name`) and numeric keys both work.
- **Check:** `npm test`.
- Depends on PR 1 (types).

### PR 4 — Filter bar
**Status:** merged
- `components/filter-bar.tsx` (client component): preset buttons (Last quarter, This quarter, Last 30 days, Last 90 days, Custom), two date inputs shown for Custom, and a location `<select>` fed from `meta.locations` (first option "All offices"). Every change writes to the URL query (`?preset=…&from=…&to=…&location=…`) with the router, dropping params that are at their default.
- `lib/filters.ts`: `buildQuery(current, change)` as a pure function (preset change clears `from`/`to`; Custom keeps them), tested without React.
- Shows the resolved error from PR 2 under the inputs when the custom range is invalid. Clicking Custom prefills the date inputs with the currently resolved range, so it never lands on a "missing date" error. An unknown `location` id is not validated here: the API's 404 is shown inline by PR 7.
- **Tests:** Testing Library renders the presets and locations, marks the active preset, a click or select change calls the router with the right query (`next/navigation` mocked), the navigation runs inside `useTransition` and the bar shows a pending state while it is in flight, Custom prefills the current range, the custom inputs appear only for Custom, the error message shows for an invalid custom range; `buildQuery` unit tests.
- **Check:** `npm test`; the component renders in a scratch page or the test.
- Depends on PR 1 (`Meta` type), PR 2.

### PR 5 — Header with coverage and badges
**Status:** merged
- `lib/badges.ts`: `partialRange(range, coverage)` (the range extends before `from` or after `to`; `false` when coverage is `null`) and `freshnessWarning(range, freshness)` (the range ends on or after `outcomes_may_be_incomplete_from`; `false` when freshness is `null`), both pure. The range is the structural type `{ from: string; to: string }` (no import from PR 2). `lib/badges.ts` also exports `formatShortDate` (`2026-09-01` → `Sep 1`, no local-time parsing), which PR 7 reuses.
- `components/page-header.tsx`: title, "Data covers ⟨from⟩ – ⟨to⟩", and the two badges with the §9 wording (the shipped wording differs, see Deviations): freshness — "Outcomes can take up to 3 days to arrive; bookings and revenue after ⟨date⟩ may be incomplete."; partial range — "Data covers ⟨from⟩ – ⟨to⟩.". Dates are displayed with `formatShortDate`.
- **Tests:** `formatShortDate`; badge conditions at the boundary (range ends the day before / on / after the freshness date; range starts one day before coverage; range inside coverage); `null` coverage and freshness show no badges and a "No data loaded" header; the component renders each badge text.
- **Check:** `npm test`.
- Depends on PR 1 (types). Parallel with PR 3 and PR 4.

### PR 6 — Campaign table
**Status:** merged
- `components/campaign-table.tsx` (client component, receives `rows` and `totals` as props): sortable headers (the first click on a column sorts descending for metric columns and ascending for Campaign and Channel; a second click flips it; `aria-sort` set), columns Campaign, Channel, Calls, Unique callers, New callers, Booked, Booking rate, Unanswered rate, Awaiting outcome, Revenue, Budgeted spend (est.), Revenue ÷ spend, Spend per booking.
- Order: ranked campaigns from `sortRows`, then the muted "No campaign" row (spend "—", a tooltip listing `channel_breakdown`), then the totals row. Tooltips are a `title` plus an `aria-describedby` target (visually hidden text), so they work for keyboard and screen-reader users, and tests find them by that description. The totals row shows `totals.unique_callers` (never a column sum) and `totals.spend_cents`; its revenue ÷ spend and spend per booking come from `totals.paid`, and the row is labelled "Totals (spend ratios: paid campaigns only)".
- "New callers" header tooltip: "First seen since data starts (Sep 1)". The spend column header reads "Budgeted spend (est.)"; under a location filter (a `locationSelected` prop) the header reads exactly "Budgeted spend (est.), allocated by call share" (D11).
- Default sort: revenue, descending. No row links yet (M4).
- **Tests:** rows render in sorted order; clicking a header re-sorts and flips direction; "No campaign" stays above totals under every sort; null cells show "—"; the tooltip text lists the breakdown; the totals row shows the `paid` ratios; the location label appears only when a location is selected; a zero-call campaign (zero counts, null ratios) sorts last under ratio sorts.
- **Size watch:** if this exceeds 450 lines, move the tooltips and totals row into a follow-on PR 6b that depends on this one (PR 7 then also waits for it; add the edge to the diagram).
- **Check:** `npm test`.
- Depends on PR 3 (and its types from PR 1).

### PR 7 — Overview page
**Status:** merged
- `app/page.tsx` (server component): `resolveRange` → if the range is valid, `getMeta()` and `getCampaignMetrics()` in parallel → `PageHeader`, `FilterBar` and `CampaignTable`. An invalid custom range renders the filter bar with its error and skips the API call.
- `app/loading.tsx` (skeleton or "Loading…"; covers the first load, while filter changes use PR 4's transition state). The page catches `ApiRequestError` itself and renders the API's `error.message` inline with the filter bar still usable (this covers a 404 for an unknown `location` and any 400 that slips through). It must not rely on `error.tsx` for that: in production Next.js replaces errors forwarded from Server Components with a generic message and a digest. `app/error.tsx` is only a generic fallback for unexpected failures, with a retry button (`unstable_retry`, which this Next.js version provides).
- Empty state: when `totals.calls` is 0, "No calls in this range — data covers ⟨from⟩ – ⟨to⟩" (§9; "No data loaded" when `data_coverage` is null) replaces the table. It is based on `totals.calls === 0` for the filtered request, so an office with no calls shows the empty state rather than a table of zero rows; the filter bar stays so the user can change the range.
- Replaces the M0 hello page on `/`. `components/api-status.tsx` is only used by `app/page.tsx`, so delete it with its test (the API's `/up` check stays in compose).
- **Tests:** page-level tests call `await Home({ searchParams: Promise.resolve({...}) })` and render the result, with `getMeta`/`getCampaignMetrics` mocked and `next/navigation` mocked for the filter bar: default render uses the last-quarter range from the fake clock; a location query param reaches the API call; the empty state; the API error path (the message of a mocked `ApiRequestError` is rendered inline) and the null-coverage empty state; an invalid custom range makes no API call.
- **Check:** `npm test`; `docker compose up`, open `http://localhost:3000`: the table shows real data, the partial-range badge shows for the default range, switching preset and office changes the URL and the numbers.
- Depends on PR 1, PR 2, PR 4, PR 5, PR 6.

### PR 8 — M3 exit check and docs
**Status:** merged

No application code.
- Run the exit check against `docker compose up` on seeded data and record it in this file: the default view's row count and totals match `curl 'localhost:3001/api/campaigns/metrics?from=2026-07-01&to=2026-09-30'`; a location filter changes the numbers and the URL; the "No campaign" row stays pinned under each sort; the partial-range badge shows for the default range and the freshness badge shows for a range ending on or after `outcomes_may_be_incomplete_from` from `curl localhost:3001/api/meta` (2026-10-29 on the current seed); a custom range of 367 days shows the inline error.
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

## Exit check results (2026-11-22)

Run against `docker compose up` on the seeded data, using `curl` against `localhost:3001/api/meta`, `localhost:3001/api/campaigns/metrics?from=2026-07-01&to=2026-09-30` (with and without `location_id=loc_03`) and the rendered HTML of `localhost:3000/`, `/?location=loc_03`, `/?preset=custom&from=2026-09-01&to=2026-11-01`, `/?preset=custom&from=2025-01-01&to=2026-01-02` and `/?location=loc_99`. No browser was used.

- `/api/meta`: coverage 2026-08-31..2026-10-29, `outcomes_may_be_incomplete_from` 2026-10-29.
- Default view (2026-07-01..2026-09-30): the API returns 13 rows (12 campaigns plus "No campaign"); the page renders the same 13 rows plus a totals row, and shows 2,525 calls, matching `totals.calls`. The partial-range badge shows.
- Location filter (`?location=loc_03`): the spend header reads "Budgeted spend (est.), allocated by call share" and the API totals differ (402 calls). The URL and table updating on a filter change was not checked live (see below).
- Freshness badge shows for a range ending 2026-11-01 ("Bookings and revenue from Oct 29 onward may be incomplete.").
- A 367-day custom range shows "Range must not exceed 366 days."; an unknown location shows the API's "record not found" inline.
- The exit check was only partly done live. Checked by unit/component tests only, not in a live browser: "No campaign" pinned under each sort (PR 6 tests); preset and office changes updating the URL (PR 4 tests).

## Deviations

- The freshness badge wording is "Bookings and revenue from ⟨date⟩ onward may be incomplete." rather than the §9 text ("Outcomes can take up to 3 days to arrive; ..."). Not changed here; decide whether to align the code or §9.
- The partial-range badge reads "Selected range extends outside available data (covers ⟨from⟩ – ⟨to⟩)." (`components/page-header.tsx`) rather than the §9 text "Data covers ⟨from⟩ – ⟨to⟩.". Not changed here; decide whether to align the code or §9.
