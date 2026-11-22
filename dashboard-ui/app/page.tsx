import { connection } from "next/server";
import { CampaignTable } from "../components/campaign-table";
import { FilterBar } from "../components/filter-bar";
import { PageHeader } from "../components/page-header";
import { ApiRequestError, getCampaignMetrics, getMeta } from "../lib/api";
import type { CampaignMetricsResponse, Meta } from "../lib/api-types";
import { formatDateSpan } from "../lib/badges";
import { resolveRange, type SearchParams } from "../lib/date-ranges";

function first(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  throw err;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Request-time rendering: API_URL is read at runtime, nothing is prerendered.
  await connection();
  const params = await searchParams;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const range = resolveRange(params, today);
  const location = first(params.location);

  let meta: Meta;
  let metrics: CampaignMetricsResponse | null = null;
  let apiError: string | null = null;

  try {
    if (range.error === undefined) {
      [meta, metrics] = await Promise.all([
        getMeta(),
        getCampaignMetrics({
          from: range.from,
          to: range.to,
          locationId: location,
        }),
      ]);
    } else {
      meta = await getMeta();
    }
  } catch (err) {
    apiError = errorMessage(err);
    // Metrics failed (e.g. unknown location): keep the filter bar usable.
    try {
      meta = await getMeta();
    } catch {
      return (
        <main>
          <h1>Campaign Dashboard</h1>
          <p role="alert">{apiError}</p>
        </main>
      );
    }
  }

  const coverageText = meta.data_coverage
    ? formatDateSpan(
        meta.data_coverage.from,
        meta.data_coverage.to,
        now.getUTCFullYear(),
      )
    : null;

  return (
    <main>
      <h1>Campaign Dashboard</h1>
      <PageHeader
        coverage={meta.data_coverage}
        // An invalid custom range has no dates to compare, so show no badges.
        freshness={range.error === undefined ? meta.freshness : null}
        range={
          range.error === undefined
            ? range
            : (meta.data_coverage ?? { from: "", to: "" })
        }
        today={now}
      />
      <FilterBar meta={meta} range={range} />
      {apiError ? (
        <p role="alert">{apiError}</p>
      ) : metrics && metrics.totals.calls === 0 ? (
        <p>
          {coverageText
            ? `No calls in this range — data covers ${coverageText}`
            : "No data loaded"}
        </p>
      ) : metrics ? (
        <CampaignTable
          rows={metrics.rows}
          totals={metrics.totals}
          locationSelected={Boolean(location)}
        />
      ) : null}
    </main>
  );
}
