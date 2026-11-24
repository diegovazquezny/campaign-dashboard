# Trade-offs, shortcuts and what I'd do with more time

## Trade-offs

| Choice | Alternative | Why | What it costs |
|---|---|---|---|
| **Separate Rails API and Next.js app** | Rails full-stack, or Next.js only | Typed UI code and interactive charts fit Next.js, and the UI can be released separately from the data. Rails brings migrations and testing conventions for the import and SQL. | Two services to run and two test suites. |
| **PostgreSQL as the only store** | SQLite, or an analytics store (ClickHouse, BigQuery) | Strong timezone support, and it suits an API that may run on several instances. An analytics store is built for scale we don't have. | Postgres stores data by row, so large aggregations would eventually be slower than in a column-based analytics store. |
| **Hand-written SQL for the metrics** | ActiveRecord (Rails' query builder) | The metrics need several counts, empty days and a totals row, which ActiveRecord can't do in one query. Raw SQL does it in a single query, and one shared definition of "booked" and "missed" keeps the table and charts in agreement. | Harder to read than Ruby and tied to PostgreSQL. |
| **REST with a few purpose-built endpoints** | GraphQL, or raw calls with the math in the browser | There are only a handful of fixed views. GraphQL would add a schema and resolvers, and raw calls would ship thousands of rows and duplicate metric logic in the client. | A new view needs a new endpoint. |
| **Filters in the URL, pages rendered on the server** | Client-side state with React Query or SWR | Links reproduce a view exactly, so any view can be shared. | Every filter change is a page navigation. |
| **Recharts** | Chart.js, or D3 directly | It fits React's component model and covers every chart here without custom drawing. | Less control than D3. |

## Shortcuts

- **No caching, rollups or partitioning.** Every request counts raw calls.
- **Data is a CSV import**, not a feed. There is no run log or import history.
- **No auth or multi-tenancy** (out of scope), so there is no company id to key caches or shards on.
- **No AI features.** The core views don't need a model.

## With more time

1. **Live call feed**: ingest endpoint, queue, workers and a dead-letter queue, plus an import run log (design in [TECHNICAL.md](TECHNICAL.md)).
2. **Scaling path, in order:** Redis cache keyed by data version, read replicas, a daily rollup table, then monthly partitions of `calls`.
3. **Auth and companies**, which the cache and sharding steps depend on.
4. **AI features** that call the same data endpoints, so numbers always match the table.
