# Milestone 0 — Working skeleton

**Goal:** `docker compose up` on a clean clone shows a page that reaches the API. `bundle exec rspec` and `npm test` both run.

## Status

**M0 is complete in code: all 11 PRs below are merged to `main`** (last merge: PR #15, 2026-11-21 12:39Z; `origin/main` at `a118b53`). GitHub CI passed on #15 (api lint/test, dashboard-ui lint/test).

| Plan PR | Merged as | Notes |
|---|---|---|
| 0 Bootstrap `main` | #1 | |
| 1 Rails scaffold | #3 | |
| 2 Next.js scaffold | #2 | |
| 3 Remove deploy tooling | #4 | |
| 4 SQLite → PostgreSQL | #6, landed on `main` by #10 | Stacked PR; never reached `main` on its own |
| 5 Minitest → RSpec | #8, landed on `main` by #10 | Stacked PR; never reached `main` on its own |
| 6 Vitest + Testing Library | #5 | |
| 7 Hello page calls API | #7 and #11 | Stacked PR; #11 landed it on `main`. Both carry the title "PR 7" |
| 8 Compose db + api | #9, landed on `main` by #10 | Stacked PR; #10 also carries PR 4 and 5 content |
| 9 Compose web | #12 | |
| 10 Native dev scripts | #15 | |

Work outside the original PR list, merged to `main`:
- **#13** shared git hooks: pre-commit runs RSpec and Vitest; pre-push blocks direct pushes to `main`; `scripts/setup-hooks.sh` sets `core.hooksPath` and creates `.env` from `.env.example`.
- **#14** GitHub Actions CI (`.github/workflows/ci.yml`): api lint and test (Postgres 18), dashboard-ui lint and test.

**Deviations from the PR specs below:**
- Postgres credentials are not committed. Compose reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and `DB_PORT` from a git-ignored `.env` (copied from `.env.example`) and builds `DATABASE_URL` from them. The compose file fails fast if they are missing.
- The `api` service also mounts `./api` at `/rails` for live reload.
- `web` runs `npm run build` then `npm start`, not `next dev`.
- The `dashboard-ui` `prepare` script runs the hook setup, so `npm ci` enables the hooks.

**Not yet verified end to end:**
- PR 10 (`bin/setup`, `bin/dev`): only `bash -n` was run. Run `bin/setup && bin/dev` on a fresh clone with local Postgres and confirm "API: OK".
- The M0 exit check on a fresh clone (`docker compose up`, `docker compose exec api bundle exec rspec`, `npm test`) has not been run as one pass. PR 9 verified `docker compose up` with "API: OK" and "API: unreachable" on its own branch.
- PR 13 did not build the `web` Docker image.

**Original scaffold state (before PR 0), for reference:** `api/` was Rails 8.1.4 API-only on SQLite and Minitest with a nested `.git`. Kamal, Solid Cache/Queue/Cable, Thruster and image_processing were unused. `dashboard-ui/` was the create-next-app boilerplate with no test runner.

## PR rules

- Each PR does one thing and is mostly hand-written diff.
- Generated code lands alone and untouched, so reviewers can skim it.
- Every PR leaves the app runnable and states how to verify it.

## PRs

### PR 0 — Bootstrap `main` (direct commit, no review)
`main` has no commits, so a PR has nothing to target yet.
- Files: `.gitignore`, `plans/PLAN.md`, `plans/milestone-0/` (this file and `milestone-0-dag.drawio`), `ai-spend.md`, `data/*.csv`, `shared/.gitkeep`.
- **Check:** `git status` shows only `api/` and `dashboard-ui/` untracked. The assessment `.docx` is still ignored.

### PR 1 — Add generated Rails API scaffold (as generated)
- Delete `api/.git`, then commit `api/` exactly as `rails new --api` produced it.
- PR description: "generated, no hand edits — skim only".
- **Check:** `git ls-files api | grep master.key` is empty.

### PR 2 — Add generated Next.js scaffold (as generated)
- Commit `dashboard-ui/` as create-next-app produced it.
- **Check:** no `node_modules` or `.next` in the diff.

### PR 3 — API: remove unused deployment pieces
Deletions only:
- Gems: `kamal`, `thruster`, `solid_cache`, `solid_queue`, `solid_cable`, `image_processing`.
- Files: `.kamal/`, `config/deploy.yml`, `config/{cache,queue,cable,recurring}.yml`, `db/*_schema.rb`, `api/.github/`, `bin/{kamal,thrust,jobs}`.
- Matching lines in `config/environments/production.rb`.
- Why: cloud deploy is out of scope per the brief. It also leaves a single database, which simplifies PR 4.
- **Check:** `bundle install`, `bin/rails runner 'puts :ok'`, `GET /up` → 200.

### PR 4 — API: SQLite → PostgreSQL
- `pg` gem replaces `sqlite3`.
- `config/database.yml`: one Postgres config that reads `DATABASE_URL` / `PG*` env vars, with localhost defaults (`campaign_dashboard_development` / `_test`).
- `Dockerfile`: drop `sqlite3` from the apt packages and add `libpq-dev` (build) / `libpq5` (runtime).
- **Check:** against local Postgres, `bin/rails db:prepare` succeeds and `/up` → 200.

### PR 5 — API: Minitest → RSpec
- Remove `test/`. Add `rspec-rails` (dev/test group) and run `rails g rspec:install`.
- One request spec: `GET /up` returns 200.
- Point `config/ci.rb` / `bin/ci` at `bundle exec rspec`.
- **Check:** `bundle exec rspec` → 1 example, 0 failures.

### PR 6 — Web: Vitest + Testing Library
- Dev deps: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
- Add `vitest.config.ts` and a `"test": "vitest run"` script.
- One trivial component test.
- **Check:** `npm test` passes and `npm run lint` is clean.

### PR 7 — Web: hello page calls the API
- Replace the boilerplate `app/page.tsx` with a server component. It fetches `${API_URL}/up` and shows "API: OK", or "API: unreachable" if the fetch fails.
- Read the Next 16 docs in `node_modules/next/dist/docs/` first. With `cacheComponents: true`, the fetch must be dynamic, uncached and behind a Suspense boundary.
- Remove the unused boilerplate SVGs.
- Default `API_URL` to `http://localhost:3001` for native dev.
- Recharts is **not** added here. It moves to M4, where it's first used, so M0 ships no unused dependency (`PLAN.md` updated to match).
- **Check:** with the API on 3001, `npm run dev` → localhost:3000 shows "API: OK". Stop the API and the page shows "unreachable" instead of crashing.

### PR 8 — Docker Compose: db + api
- `api/Dockerfile.dev`: Ruby 3.4.7-slim, `RAILS_ENV=development`, bundle install. The production `Dockerfile` stays as is.
- `docker-compose.yml`:
  - `db`: `postgres:18` with a healthcheck and a named volume.
  - `api`: port 3001, `depends_on: db (healthy)`, `DATABASE_URL`, `DATA_DIR=/data`, `./data` (the three CSVs) mounted read-only at `/data`.
  - `api` command: `bin/rails db:prepare db:seed && bin/rails s -b 0.0.0.0 -p 3001`. `seeds.rb` stays empty until M1.
- Allow the `api` host in development (`config.hosts << "api"`). Without it the web container gets a 403 from Rails host authorization.
- **Check:** `docker compose up db api` → `curl localhost:3001/up` → 200.

### PR 9 — Docker Compose: web
- `dashboard-ui/Dockerfile` (Node 24, `npm ci`, `next dev` or build + start) and `.dockerignore` (excludes `node_modules`, `.next`).
- Add a `web` service: port 3000, `API_URL=http://api:3001`, `depends_on: api`.
- **Check:** `docker compose up` → localhost:3000 shows "API: OK".

### PR 10 — Native dev scripts
- Root `bin/setup`: `bundle install` in `api/`, then `bin/rails db:prepare db:seed`, then `npm ci` in `dashboard-ui/`.
- Root `bin/dev`: runs `api/bin/rails s -p 3001` and `npm run dev` together. Plain bash with `trap` to kill both, no foreman dependency.
- **Check:** on a fresh clone with local Postgres, `bin/setup && bin/dev` → localhost:3000 shows "API: OK".

## Dependencies

- 0 → 1 → 3 → 4 → 5 → 8 → 9 → 10
- 0 → 2 → 6 → 7 → 9
- PRs 6–7 can run in parallel with 3–5.

## M0 exit check

On a fresh clone:
- `docker compose up` shows "API: OK" at localhost:3000.
- `docker compose exec api bundle exec rspec` passes.
- `cd dashboard-ui && npm test` passes.
