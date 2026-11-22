---
name: do-next-task
description: Check ./plans/PLAN.md for which milestone is currently being worked on and implement the next task.
---

# Do Next Task

## Goal
This skill checks the ./plans/PLAN.md, determines which milestone is in progress, and implements the next task in that milestone.

## Workflow
1. **Gather context:** 
   - Read only the first 20 lines of `./plans/PLAN.md` (the `## Status` section). Do not read the full file. It has a `**Current milestone:**` line and a status table. The current milestone is the one named there; its status should be `in progress` or `not started`. If the status table and the current-milestone line disagree, stop and report the mismatch.
   - Read `./plans/milestone-<n>/milestone-<n>.md` for the current milestone only. Read the other sections of PLAN.md (for example §6, §7, §10) only when the task needs them, and then read only the relevant section by line range.
   - Do not read other milestone folders unless the task depends on them.
2. **Execute task:** Follow these rules:
   - Determine the next task in the current milestone.
   - If tasks can be done in parallel, use subagents to implement them concurrently.
   - Pull the latest changes from the main branch before starting work to ensure you are working on the most up-to-date codebase.
   - Implement the task in code, ensuring that it adheres to the project's coding standards and guidelines.
   - Commit the changes with a clear and descriptive commit message.
   - Push the changes to the appropriate branch in the repository.
   - Open a pull request for review.
   - Branches and PR titles follow a `milestone-<m>-pr-<n>-<slug>` pattern, where <m> is the milestone number and <n> is the PR number within that milestone (milestone-2-pr-8-campaign-daily-endpoint, milestone-3-pr-1-api-types)
   - Track progress in `./plans/PLAN.md` by updating the status table only: set the milestone to `in progress` when its first PR starts, and to `complete` when its last PR merges. Also update the `**Current milestone:**` line when a milestone completes. Keep the detail in `./plans/milestone-<n>/milestone-<n>.md`; do not add status text to PLAN.md §12.

## Constraints & Edge Cases
- Never stack PRs.
- PRs should always branch from the latest up-to-date main branch.
- If the next task is blocked by an unresolved issue, do not proceed and instead report the blockage.
- If the previous PR is still open, the skill should stop and say so.
