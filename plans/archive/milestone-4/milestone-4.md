# Milestone 4 — Campaign detail page

**Goal:** see how one campaign's daily revenue compares with its spend (PLAN.md §9 `/campaigns/[id]`; D11).

**Done when:** clicking a table row opens the detail page, and its chart and table match the overview (daily spend sums to the table's spend), and `npm test` passes.

## Status

Complete. Seven PRs. Builds on M3 (overview page, filter bar, header, formatters) and the M2 endpoint `GET /api/campaigns/:id/daily` (merged). Same architecture as M3: a server component fetches, all filter state lives in the URL.

## PR rules

Same as M0–M3:
- Each PR does one thing, is individually testable and mergeable, and stays under 500 changed lines.
- Every PR leaves the app runnable (no link may point at a page that does not exist yet), passes `npm test`, `npm run lint` and `npx tsc --noEmit`, and states how to verify it.

## Conventions used across PRs

- **Read the bundled Next.js docs first** (`dashboard-ui/AGENTS.md`): before writing the dynamic route, read the guide in `dashboard-ui/node_modules/next/dist/docs/` (for example, whether `params` and `searchParams` are `Promise`s).
- **Consult the `dataviz` skill before writing any chart code** (PR 4).
- **Layout:** pure logic in `dashboard-ui/lib/` with a `*.test.ts` beside it; components in `dashboard-ui/components/`; the page in `dashboard-ui/app/campaigns/[id]/page.tsx`. Only the chart is a client component (Recharts needs the browser); the daily table stays a server-compatible component.
- **Reuse, don't copy:** `FilterBar`, `PageHeader`, `resolveRange`, `buildQuery` and the `lib/format.ts` functions from M3. `FilterBar` already uses `usePathname()`, so it works on the detail route; check that it keeps the other params (`buildQuery`'s `extra`).
- **Types:** `DailyResponse` already exists in `lib/api-types.ts`. `spend_cents` is `number | null` (null for $0-budget campaigns); `calls`, `booked` and `revenue_cents` are never null. "No campaign" has no id and is never linked.
- **Spend labelling:** the two header strings (`SPEND_LABEL`, `SPEND_LOCATION_LABEL`) are private to `components/campaign-table.tsx` today. PR 3 moves them to `lib/format.ts` and both tables import them. When a location is selected, spend is labelled "Budgeted spend (est.), allocated by call share" (D11), as in the overview table; otherwise "Budgeted spend (est.)".
- **Consistency rule (the exit criterion):** the sum of daily `spend_cents` equals the overview row's `spend_cents` for the same range and office; likewise revenue, calls and booked. A pure helper (`sumDays`) makes this testable.
- **Out of scope:** styling beyond a readable chart and table, new metrics, a chart on the overview page.

## PRs

### PR 1 — Daily fetch client and helpers
**Status:** complete (#53)
- `lib/api.ts`: `getCampaignDaily(id, { from, to, locationId })`, same pattern as `getCampaignMetrics` (`cache: 'no-store'`, 5 s timeout, `ApiRequestError`). The id is `encodeURIComponent`ed. PR 5 must confirm in the bundled Next docs whether `params.id` arrives decoded, so ids with special characters are not double-encoded; PR 1/PR 2 tests cover the encoded path and PR 5 covers the page.
- `lib/daily.ts` (pure): `sumDays(days)` → `{ calls, booked, revenue_cents, spend_cents }` (`spend_cents` null only when every day is null), `hasActivity(days)` (any call), and `toChartData(days)` (adds `revenue_dollars` and `spend_dollars`, where a null spend stays null so the chart shows a gap rather than 0).
- **Tests:** query string (omits `location_id` when unset), the encoded path, a 404 and 400 error shape, a network failure; `sumDays` with all-null, mixed and empty input; `toChartData` keeps null; `hasActivity`.
- **Check:** `npm test`, `npx tsc --noEmit`.
- Depends on M3 only.

### PR 2 — Detail link helper and back link
**Status:** complete (#55)
- `lib/filters.ts`: `detailHref(campaignId, query)` → `/campaigns/<id>?<query>` (id encoded; the given query string is used as is, empty query gives no `?`; callers build it with `buildQuery`) and `overviewHref(query)`. `components/back-link.tsx`: "← All campaigns" using `overviewHref`.
- **Tests:** both helpers (ids with special characters, empty query, preserved `preset`/`from`/`to`/`location`); the back link renders the right `href`.
- **Check:** `npm test`.
- Depends on M3 only. Parallel with PR 1.

### PR 3 — Daily table
**Status:** complete (#56)
- `components/daily-table.tsx`: columns Date, Calls, Booked, Revenue, Budgeted spend (est.) (header text from a `locationSelected` prop, see conventions; this PR also moves the shared spend-label constants out of `campaign-table.tsx` into `lib/format.ts`). Rows in date order, "—" for null spend, zero-filled days shown as zeros, and a totals row from `sumDays`.
- **Tests:** rows render in date order; null spend shows "—" (and the totals spend shows "—" when all are null); the totals row equals the sum of the rows; the location label appears only when a location is selected.
- **Check:** `npm test`.
- Depends on PR 1 (`sumDays`).

### PR 4 — Revenue-vs-spend chart
**Status:** complete (#57)
- Read the `dataviz` skill first. Add `recharts` to `dashboard-ui/package.json`. Lockfile churn in `package-lock.json` is excluded from the 500-line limit; the lockfile must be committed for the Docker build.
- `components/daily-chart.tsx` (client component, takes `days`): one chart with daily revenue and daily spend over the range, in dollars, a legend, accessible title/description, and a tooltip with exact values. A null spend renders as a gap, not zero. A text summary beneath (`sr-only` or visible) gives range totals so the chart is not the only source of the numbers.
- **Tests:** jsdom has no layout, so mock `ResponsiveContainer` (or give it a fixed size); assert the series, legend labels and the accessible description render, and that `toChartData` output is what the chart receives.
- **Check:** `npm test`; `docker compose build web` still succeeds with the new dependency.
- Depends on PR 1 (`toChartData`). Parallel with PR 3.

### PR 5 — Detail page
**Status:** complete (#58)
- `app/campaigns/[id]/page.tsx` (server component): `resolveRange` → if valid, `getMeta()` and `getCampaignDaily()` run independently, each wrapped as `{value}|{err}` as in `app/page.tsx`, so a daily 404 keeps the filter bar and does not refetch meta. The page calls `await connection()`. If `getMeta()` fails, render the `<h1>` plus an alert only, as M3 does. An invalid custom range passes `freshness={null}` and the meta coverage to `PageHeader`, as M3 does → `BackLink`, the page's own `<h1>{daily.campaign.name}</h1>` (`PageHeader` has no title prop and renders no `<h1>`; on an error or 404 there is no name, so use a generic "Campaign" heading), `PageHeader`, `FilterBar`, `DailyChart`, `DailyTable`.
- States, as on `/`: an invalid custom range renders the filter bar with its error and makes no API call; an `ApiRequestError` (404 unknown campaign or office, 400) renders `error.message` inline with the filter bar usable; no calls in range (`!hasActivity`) shows (consistent with the overview's `totals.calls === 0`, so a campaign with spend but no calls also shows it) "No calls in this range — data covers ⟨from⟩ – ⟨to⟩" in place of the chart and table. `app/campaigns/[id]/loading.tsx`. The generic `app/error.tsx` covers the rest.
- **Tests:** page-level, as in M3 (`await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({...}) })`, API functions mocked): default range from the fake clock; filters and the `location` param reach the API call; empty state; API error inline; invalid custom range makes no call.
- **Check:** `npm test`; `docker compose up`, open `http://localhost:3000/campaigns/<id>?preset=last_quarter` (use an id from `/api/campaigns/metrics`): chart and table render, a location filter changes the numbers and shows the "allocated by call share" label.
- Depends on PR 1, PR 2, PR 3, PR 4.

### PR 6 — Row links from the overview
**Status:** complete (#59)
- `components/campaign-table.tsx`: campaign names become links built with `detailHref` (the "No campaign" row stays plain text). `app/page.tsx` builds the query with `buildQuery({ preset, from, to, location }, {})` (so the default preset is dropped and `from`/`to` are kept only for `custom`) and passes the string to `CampaignTable` as a prop; the table calls `detailHref` itself. Keyboard-accessible (a real `<a>`/`Link`); row-wide click is optional.
- **Tests:** each ranked row links to `/campaigns/<id>` with the current `preset`/`from`/`to`/`location` carried; "No campaign" has no link; existing table tests still pass; the page test checks the query reaches the table.
- **Check:** `npm test`; in the running app, click a row and land on the detail page with the same filters in the URL and filter bar.
- Depends on PR 5 (so the link target exists) and PR 2.

### PR 7 — M4 exit check and docs
**Status:** complete (this PR)

No application code.
- Against `docker compose up` on seeded data, record in this file: for two campaigns (one with a location filter, one without), the sum of the daily table's spend, revenue, calls and booked equals the overview row for the same range, compared with `curl` on `/api/campaigns/metrics` and `/api/campaigns/:id/daily`; a $0-budget campaign shows "—" spend; clicking a row carries the filters; an unknown id shows the API's error inline; an empty range shows the empty state. State clearly which items were checked live and which only by tests.
- Update this file's status and the PLAN.md M4 status line; list deviations. Archiving to `plans/archive/` happens when M5 is planned.
- Depends on PR 6.

## Dependencies

Each "Depends on" line lists direct dependencies only; these match the diagram's arrows.

- M3 → PR 1, PR 2
- PR 1 → PR 3, PR 4
- PR 1, PR 2, PR 3, PR 4 → PR 5
- PR 2, PR 5 → PR 6
- PR 6 → PR 7
- PR 1 and PR 2 start together; PR 3 and PR 4 then run in parallel.
- Longest chain: PR 1 → 3 → 5 → 6 → 7 (5 PRs in sequence; via PR 4 instead of PR 3 is equally long).

See [milestone-4-dag.drawio](milestone-4-dag.drawio).

## M4 exit check

- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
- With `docker compose up` and seeded data, clicking an overview row opens `/campaigns/[id]` with the filters carried over; its daily table sums match the overview row (spend, revenue, calls, booked); the chart shows the same days.
- Location filter shows the "allocated by call share" label; invalid ranges, empty ranges and API errors show their states.

## M4 exit check results

Run on 2026-11-22 against `docker compose up --build` with the seeded data (coverage Aug 31 – Oct 29), range `from=2026-08-31&to=2026-10-29`.

**Checked live** (`curl` on `/api/campaigns/metrics` and `/api/campaigns/:id/daily`, plus the rendered pages on :3000):
- Daily sums (calls, booked, revenue, spend) equal the overview row, for all four cases:
  - `cmp_02`, no location: 861 calls, 204 booked, $74,344 revenue, $24,000 spend.
  - `cmp_01`, `loc_01`: 103 calls, 13 booked, $3,449 revenue, $1,462.15 spend.
  - `cmp_12`, `loc_01`: 60 calls, 18 booked, $8,970 revenue, $1,653.06 spend.
  - `cmp_08` ($0 budget): spend null in both.
- `cmp_08` detail page: totals row shows "—" for spend.
- With `location=loc_01` the detail page shows "allocated by call share"; without it, it does not.
- Unknown id: the API returns 404 `record not found`; `/campaigns/nope` shows it inline under a generic "Campaign" heading, with no table.
- Empty range (custom, Jan 2026): "No calls in this range — data covers Aug 31 – Oct 29", no table.
- Overview rows link to `/campaigns/<id>?preset=last_30_days&location=loc_01`, carrying the filters.

**Checked only by tests:** invalid custom range (no API call), meta failure, `FilterBar` on the detail route, the chart's rendered output (no browser check of the chart or of clicking a row).

**Deviations:** none from the plan. Not run: `docker compose down` hit a read-only-filesystem error removing a container (Docker Desktop issue, not the app).
