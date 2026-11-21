---
name: plan-next-milestone
description: Check ./plans/PLAN.md for which milestone has not been planned yet. Create tasks for the next milestone and update the plan accordingly.
---

# Plan Next Milestone

## Goal
This skill checks the ./plans/PLAN.md, determines which milestone is next, and creates tasks need to complete that milestone.

## Workflow
1. **Gather context:** 
   - Inspect `./plans/PLAN.md` to determine which milestone is up next.
   - If all milestones have been planned, the skill should stop and say so.
   - Inspect `./plans/milestone-<n>/milestone-<n>.md` for detailed information about the milestone.
2. **Create tasks:** Follow these rules:
   - Determine what needs to be done to complete the current milestone.
   - Create tasks for the milestone, ensuring that they are clear, actionable, and follow the project's task naming conventions.
   - If tasks can be done in parallel, create them as separate tasks that can be worked on concurrently.
   - Ensure that the tasks are well-defined and have clear acceptance criteria.
   - Find a good balance between the number of tasks and their granularity. Avoid creating too many small tasks or too few large tasks.
   - Update the `./plans/PLAN.md` and `./plans/milestone-<n>/milestone-<n>.md` files to reflect the new tasks and any changes to the milestone plan.
   - Create a `./plans/milestone-<n>/milestone-<n>-dag.drawio` file to visualize the tasks and their dependencies. This file should follow the format of `./plans/milestone-<n>/milestone-0-dag.drawio`.

## Constraints & Edge Cases
- Each task should be able to be individually tested.
- Each task should be able to be merged independently.
- Each PR should not exceed 500 lines of code changes.
