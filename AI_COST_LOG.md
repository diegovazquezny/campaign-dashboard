# AI cost log

One row per AI session whose cost is recorded. Costs are each session's "Estimated cost" as reported by the tool. The "Plan refinement 2" row comes from the usage summary kept in a standalone file, now folded in here and removed (the original is in git history at commit `344ef04`). The milestone 1 to 4 and ui-improvements rows come from usage summaries supplied by the project owner. The cost column is the session total, so the small haiku amounts in the model column are already included and are not added again.

| Session | Models | Cost (USD) |
|---|---|---|
| Plan mode, "Plan refinement 2" | claude-opus-5-5 (+ haiku $0.0001) | 0.97 |
| milestone-1 implementation, session 1 | claude-sonnet-5-5 (+ haiku $0.0005) | 0.66 |
| milestone-1 implementation, session 2 | claude-sonnet-5-5 (+ haiku $0.0046) | 5.41 |
| milestone-2 implementation, session 1 | claude-sonnet-5-5 (+ haiku $0.0023) | 1.71 |
| milestone-2 implementation, session 2 | claude-sonnet-5-5 (+ haiku $0.0007) | 2.04 |
| milestone-2 implementation, session 3 | claude-sonnet-5-5 $0.3958, claude-sonnet-5 $0.1205 (+ haiku $0.0001) | 0.52 |
| milestone-3 implementation, session 1 | claude-sonnet-5-5 (+ haiku $0.0005) | 0.94 |
| milestone-3 implementation, session 2 | claude-sonnet-5-5 (+ haiku $0.0017) | 0.76 |
| milestone-3 implementation, session 3 | claude-sonnet-5-5 $0.74, claude-sonnet-5 $0.2369 (+ haiku $0.0002) | 0.98 |
| milestone-3 implementation, session 4 | claude-sonnet-5-5 $0.4969, claude-sonnet-5 $0.1174 (+ haiku $0.0001) | 0.61 |
| milestone-4 implementation, session 1 | claude-sonnet-5-5 (+ haiku $0.0005) | 0.83 |
| milestone-4 implementation, session 2 | claude-sonnet-5-5 (+ haiku $0.0020) | 1.39 |
| milestone-4 implementation, session 3 | claude-sonnet-5-5 (+ haiku $0.0001) | 0.71 |
| ui-improvements, session 1 | claude-sonnet-5-5 (+ haiku $0.0003) | 0.66 |
| ui-improvements, session 2 | claude-sonnet-5-5 (+ haiku $0.0009) | 3.63 |
| Other sessions (M0, milestone 5, UI improvements work after the figures above were captured, planning not listed) | Not recorded | unknown |

**Total of recorded costs: $21.82.** It is a lower bound: the unknown row is not counted, so the true total is higher.

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
