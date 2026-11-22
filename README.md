# Call Performance Dashboard

A one-screen dashboard that answers: *which campaigns turn calls into revenue, and at what cost?*
A sortable campaign table with date-range and office filters, plus a per-campaign daily revenue-vs-spend chart.

- **API:** Ruby on Rails (API-only) in `api/`
- **Web:** Next.js + TypeScript + Recharts in `dashboard-ui/`
- **Database:** PostgreSQL

## Quick start (Docker)

Needs only Docker.

```sh
cp .env.example .env
docker compose up
```

On first start the API creates the database and imports the CSVs from `data/` (later starts skip the import).
Then open:

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API | http://localhost:3001/api/meta |
| Database | localhost:5432 (set `DB_PORT` in `.env` if 5432 is taken) |

The default view is "Last quarter", which starts before the data does, so a "Data covers …" badge is expected.

## Native development

Needs Ruby (version in `api/.ruby-version`), Node and a local PostgreSQL.

```sh
bin/setup   # installs gems and packages, prepares the database, imports the data
bin/dev     # API on :3001 and web on :3000; Ctrl-C stops both
```

## Tests and checks

```sh
# API (RSpec), from api/ (needs a local PostgreSQL; see Native development):
bundle exec rspec
bundle exec rubocop

# Web (Vitest), from dashboard-ui/:
npm test
npm run lint
npx tsc --noEmit
```

`scripts/setup-hooks.sh` enables the git hooks (pre-commit runs rubocop and eslint; pre-push blocks pushes to `main`). It runs automatically on `npm install`.

## Data

Source files are in `data/` (`calls.csv`, `campaigns.csv`, `locations.csv`); set `DATA_DIR` to read from elsewhere.
To re-import: `docker compose exec api bin/rails import:all` (or `bin/rails import:all` from `api/`). The import is idempotent.

Things to know about the data:

- It covers 2026-08-31 to 2026-10-29 (office-local dates), about 60 days.
- Calls can be written more than once. The import keeps the latest version by `updated_at`, not the last row in the file, and rejects invalid rows with a reason.
- Outcomes arrive up to about 3 days late, so bookings and revenue near the end of the data can be incomplete (the dashboard shows a badge).
- Some calls have no campaign. They appear as a pinned "No campaign" row.
- The data has no actual ad spend. Spend is estimated from each campaign's daily budget and labelled "Budgeted spend (est.)".

More detail: [plans/PLAN.md](plans/PLAN.md) (the full design) and, once written, DECISIONS.md and TECHNICAL.md.

## Layout

```
api/           Rails API (specs in api/spec/)
dashboard-ui/  Next.js app
data/          source CSVs
bin/           setup and dev scripts
plans/         build plan and per-milestone task breakdowns
```
