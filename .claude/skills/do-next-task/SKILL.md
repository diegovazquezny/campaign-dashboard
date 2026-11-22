---
name: do-next-task
description: Check ./plans/PLAN.md for which milestone is currently being worked on and implement the next task.
---

# Do Next Task

## Goal
This skill checks the ./plans/PLAN.md, determines which milestone is in progress, and implements the next task in that milestone.

## Workflow
1. **Gather context:** 
   - Inspect `./plans/PLAN.md` before making changes to determine which milestone is in progress or needs to be done. This will be milestone-<n> where <n> is the milestone number.
   - Inspect `./plans/milestone-<n>/milestone-<n>.md` for detailed information about the milestone.
2. **Execute task:** Follow these rules:
   - Determine the next task in the current milestone.
   - If tasks can be done in parallel, use subagents to implement them concurrently.
   - Pull the latest changes from the main branch before starting work to ensure you are working on the most up-to-date codebase.
   - Implement the task in code, ensuring that it adheres to the project's coding standards and guidelines.
   - Commit the changes with a clear and descriptive commit message.
   - Push the changes to the appropriate branch in the repository.
   - Open a pull request for review.
   - Branches and PR titles follow a `milestone-<m>-pr-<n>-<slug>` pattern, where <m> is the milestone number and <n> is the PR number within that milestone (milestone-2-pr-8-campaign-daily-endpoint, milestone-3-pr-1-api-types)
   - Use the `./plans/PLAN.md` and `./plans/milestone-<n>/milestone-<n>.md` files to track progress and update it accordingly.

## Constraints & Edge Cases
- Never stack PRs.
- PRs should always branch from the latest up-to-date main branch.
- If the next task is blocked by an unresolved issue, do not proceed and instead report the blockage.
- If the previous PR is still open, the skill should stop and say so.
