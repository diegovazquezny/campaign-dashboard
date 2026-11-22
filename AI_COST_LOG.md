# AI cost log

One row per AI session whose cost can be recovered from this repo. The only record is a usage summary that was kept in a standalone file, now folded in here and removed. The original is in git history at commit `344ef04`.

| Model | Purpose | Cost (USD) |
|---|---|---|
| claude-opus-5-5 | Plan mode, "Plan refinement 2" session (954.6k cache read, 68.5k cache write, 21.5k output tokens) | 0.97 |
| claude-haiku-5-5 | Same session, minor calls (1.2k input, 20 output tokens) | 0.0001 (included in the session's estimated $0.97, not added again) |
| Other sessions (milestone planning and implementation, M0 to M5) | Not recorded in the repo | unknown |

**Total of recorded costs: $0.97.** This is the session's estimated cost as reported by the tool. It is a lower bound: rows marked unknown are not counted and the true total is higher.

## Original session summary

```
Plan mode

Plan refinement 2

Session
Estimated cost:         $0.97
Total duration (API):   3m 39s
Total duration (wall):  23m 15s
Total code changes:     5 lines added, 3 lines removed
Usage by model:
claude-haiku-5-5:       1.2k input, 20 output, 0 cache read, 0 cache write ($0.0001)
claude-opus-5-5:        1.1k input, 21.5k output, 954.6k cache read, 68.5k cache write ($0.97)
Prompt cache (main):    20 requests, 93% of input tokens from cache
```
