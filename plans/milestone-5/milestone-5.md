# Milestone 5 — Docs + clean-checkout smoke test

**Goal:** a reviewer can run and understand the project unaided (PLAN.md §11, §12 M5).

**Done when:** a fresh clone passes the smoke run (`docker compose up` → dashboard loads with imported data) and `README.md`, `DECISIONS.md`, `TECHNICAL.md` and `AI_COST_LOG.md` exist at the repo root.

## Status

In progress (PR 1 started). Five PRs. Four are independent of each other (three docs and a smoke script); the last verifies everything from a fresh clone. M0–M4 are archived.

## PR rules

Same as M0–M4:
- Each PR does one thing, is individually mergeable, and stays under 500 changed lines.
- Every PR leaves the app runnable and states how to verify it. Docs PRs change no application code.

## Conventions used across PRs

- **Docs state only what the code and PLAN.md say.** Read the code before describing it; do not copy PLAN.md wholesale. Link to PLAN.md sections rather than duplicating them where the detail is long.
- **Audience:** README is for someone running the project; DECISIONS.md is product-focused (a marketer or PM could read it); TECHNICAL.md is for engineers.
- **Commands in docs must be run** by the author of the PR before merging. Do not document a command that was not executed.

## PRs

### PR 1 — README.md
**Status:** merged (PR #62)
- One-command setup (`cp .env.example .env`, `docker compose up`), ports (web 3000, api 3001, db 5432, `DB_PORT` override), native development (`bin/setup`, `bin/dev`), how to run tests (`api` RSpec, `dashboard-ui` `npm test`, lint, `tsc`), where the data lives (`data/`, `DATA_DIR`) and how re-seeding/importing works, a short data-notes section (messy data handled, coverage Aug 31 – Oct 29), repo layout, links to the other docs.
- **Check:** follow the README verbatim on a clean working tree; every command works as written.
- Depends on M4 only.

### PR 2 — DECISIONS.md and AI_COST_LOG.md
**Status:** in review
- `DECISIONS.md`: product-focused summary of D1–D12 (why, in plain language), the **spend-estimate limitation** (budget × days, assumes full spend, overstates cost) and the "allocated by call share" rule, what was left out (auth, first-touch toggle, chatbot), open questions from §13, and the **AI spend total** (taken from `AI_COST_LOG.md`).
- `AI_COST_LOG.md`: table of model, purpose, cost per entry, with a total; fold in `ai-spend.md` (existing entries) and then delete `ai-spend.md` with `git rm`. Costs not recoverable from history are stated as unknown, not invented.
- **Check:** the total in DECISIONS.md equals the sum of the log's rows; no dead links; `ai-spend.md` is gone and nothing references it.
- Depends on M4 only. Parallel with PR 1.

### PR 3 — TECHNICAL.md
**Status:** in review
- Mermaid architecture diagram (browser → Next.js server component → Rails API → Postgres; import from `data/` CSVs at seed time). Sections: import pipeline and messy-data handling (versions by `updated_at`, rejected rows, timezones), metric definitions and the query-time spend/new-caller approach, API endpoints and error shape, data freshness (3-day outcome lag, `outcomes_may_be_incomplete_from`, partial-range badge), testing approach, scaling path (§7).
- **Check:** the Mermaid block renders (GitHub preview or `mmdc`); endpoint paths, params and error codes match `api/` routes and specs.
- Depends on M4 only. Parallel with PR 1 and PR 2.

### PR 4 — Smoke script
**Status:** not started
- `scripts/smoke.sh`: from the repo root, copies `.env.example` to `.env` if missing, runs `docker compose up -d --build`, waits (with a timeout) for the API, then asserts: `GET /api/meta` returns coverage and locations, `GET /api/campaigns/metrics` returns campaigns with non-zero calls, `GET http://localhost:3000/` returns 200 and contains a campaign name. Exits non-zero with a clear message on the first failure. Does not tear down unless `--down` is passed.
- **Tests:** the script itself is the test; run it against a healthy stack (passes) and with the API stopped (fails with the message).
- **Check:** `scripts/smoke.sh` passes on the current stack.
- Depends on M4 only. Parallel with PR 1–3.

### PR 5 — M5 exit check and docs
**Status:** not started

No application code beyond fixes the smoke run exposes (keep those minimal; split into their own PR if over the size limit).
- Fresh `git clone` into an empty temporary directory, follow the README exactly, run `scripts/smoke.sh`, and record the results in this file: what was run, what passed, how long setup took, anything the README got wrong (fix it).
- Check every relative link in README, DECISIONS, TECHNICAL and AI_COST_LOG resolves.
- Update this file's status and the PLAN.md M5 status line; list deviations. Archiving to `plans/archive/` happens when M6 is planned.
- Depends on PR 1, PR 2, PR 3, PR 4.

## Dependencies

Each "Depends on" line lists direct dependencies only; these match the diagram's arrows.

- M4 → PR 1, PR 2, PR 3, PR 4
- PR 1, PR 2, PR 3, PR 4 → PR 5
- PR 1–4 can all run in parallel.
- Longest chain: any of PR 1–4 → PR 5 (2 PRs in sequence).

See [milestone-5-dag.drawio](milestone-5-dag.drawio).

## M5 exit check

- A fresh clone, following only the README, reaches a dashboard with imported data; `scripts/smoke.sh` passes.
- `README.md`, `DECISIONS.md`, `TECHNICAL.md`, `AI_COST_LOG.md` exist; `ai-spend.md` is folded in and removed; all links resolve.
