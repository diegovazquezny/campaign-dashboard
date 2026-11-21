# Import fixtures: known answers

Small CSVs with the same headers as `data/*.csv`. The base set is valid and is
always loaded first; each scenario directory holds only the files that differ,
and replaces the base file of the same name (see `with_import_dir` in
`spec/support/import_fixtures.rb`). Files use LF endings except `crlf/`.
Row counts are data rows (header excluded). Local dates are
`(started_at AT TIME ZONE location.timezone)::date`.

## Base set (all valid, 0 rejections)

- `locations.csv`: 3 rows. `loc_01` New_York, `loc_05` Denver, `loc_06` Phoenix.
- `campaigns.csv`: 3 rows. `cmp_01` paid_search $150.00, `cmp_04` social $120.00,
  `cmp_08` organic **$0.00 budget** (`daily_budget_cents` 0).
- `calls.csv`: 12 rows, 8 calls, 4 older versions dropped, 0 rejected.

| call_id | rows | latest state | local_date |
|---|---|---|---|
| `c_001` | 3 | `booked`, 29950 cents, `source_updated_at` 2026-09-03T10:05:00Z. Versions: no outcome, then a no-op re-write (`updated_at` only), then booked (late outcome) | 2026-09-01 |
| `c_002` | 2 | `qualified_lead`; the second row is a no-op re-write (only `updated_at` differs) | 2026-09-01 |
| `c_003` | 2 | `booked`, 12000 cents (late outcome: empty then booked with revenue) | 2026-09-01 |
| `c_004` | 1 | `not_qualified`, Phoenix, started 2026-09-01T06:30Z | **2026-08-31** |
| `c_005` | 1 | `not_qualified`, Denver, started 2026-09-01T06:30Z (same instant as `c_004`) | **2026-09-01** |
| `c_006` | 1 | unanswered `missed`, no campaign (`marketing_channel` direct) | 2026-09-01 |
| `c_007` | 1 | unanswered `voicemail`, `loc_05` | 2026-09-01 |
| `c_008` | 1 | answered, outcome empty (awaiting outcome) | 2026-09-01 |

Totals: 2 booked, 1 qualified_lead, 2 not_qualified, 1 missed, 1 voicemail, 1 awaiting.
Re-importing the base set changes nothing (0 inserted, 0 updated).

## `out_of_order/`

`calls.csv` (3 rows): the three versions of `c_001` with the newest first
(file order: booked 09-03, then 09-01T10:02:10Z, then the 09-01T10:30:00Z no-op).
Answer: 1 call, `booked`, 29950 cents, `source_updated_at` 2026-09-03T10:05:00Z,
2 older versions dropped, 0 rejected. Latest is max `updated_at`, not last row.

## `rejects/`

`calls.csv` (28 rows): 26 rejected rows (one per rule, ids named for the rule)
plus one exact duplicate pair `r_exact_dup`. Answer: 26 rejected, 1 call
(`r_exact_dup`) inserted, 1 exact-duplicate collapse (not rejected, not counted
as a dropped version). Rule order when several fail is defined by PR 5; each
row is built to violate the rule in its id.

- Field rules: `r_unans_agent`, `r_unans_bad_outcome`, `r_unans_blank_outcome`,
  `r_unans_revenue`, `r_ans_no_agent`, `r_ans_missed`, `r_rev_not_booked`,
  `r_booked_no_rev`, `r_ends_before_start` (duration -60), `r_duration_mismatch`.
- Blank required field: an empty `call_id` (first blank row), `r_blank_hash`,
  `r_blank_tracking`, `r_blank_started`, `r_blank_ended`.
- Bad format: `r_bad_timestamp`, `r_bad_channel`, `r_bad_outcome`, `r_bad_integer`,
  `r_integer_out_of_range`, `r_bad_boolean`, `r_revenue_exp` (`1e3`),
  `r_revenue_nan` (`NaN`), `r_revenue_3dp` (`10.123`).
- References: `r_unknown_location` (`loc_99`), `r_unknown_campaign` (`cmp_99`).

## `conflicting/`

`calls.csv` (4 rows): `c_conflict` appears twice, far apart, with the same
`updated_at` and different outcome (`qualified_lead` vs `not_qualified`),
around two valid calls (`c_after_conflict`, `c_between`). Answer: both
`c_conflict` rows rejected ("conflicting versions"), 2 calls inserted, 2 rejected.

## `newest_invalid/`

`calls.csv` (2 rows): `c_newest_bad` v1 valid (answered, no outcome, 09-02T10:02Z);
v2 (09-04) is `booked` with no revenue, so it is rejected. Answer: 1 rejected,
1 call inserted at its v1 state (outcome null, revenue null).

## `bad_references/`

Re-import scenario: import the base set first, then this directory.

- `locations.csv` (6 rows): `loc_01` valid; `loc_05` twice with different names
  (both rejected, conflicting versions); `loc_06` with timezone `Mars/Olympus`
  (rejected, unknown timezone); `loc_08` twice, identical (collapses, valid).
  Answer: 2 valid locations (`loc_01`, `loc_08`), 3 rejected, 1 collapse.
  `loc_05`/`loc_06` were valid in the base set, so their rows and their calls
  `c_004`, `c_005`, `c_007` remain; the DB is not pruned.
- `campaigns.csv` (5 rows): `cmp_01` valid; `cmp_04` twice with budgets
  120.00/125.00 (both rejected); `cmp_05` with channel `tv` (rejected);
  `cmp_08` valid ($0 budget). Answer: 2 valid, 3 rejected. Existing `cmp_04`
  stays unchanged.
- `calls.csv` (6 rows): valid `b_ok_loc_01`, `b_ok_loc_08`; rejected
  `b_loc_05_conflicting`, `b_loc_06_bad_tz`, `b_cmp_04_conflicting`,
  `b_cmp_05_bad_channel` (their location/campaign was rejected in this run).
  Answer: 2 calls inserted, 4 rejected.

## `crlf/`

`calls.csv` (2 rows, CRLF line endings, protected by `.gitattributes`): both
valid. Answer: 2 calls inserted, 0 rejected; line numbers are physical lines
(rows on lines 2 and 3).
