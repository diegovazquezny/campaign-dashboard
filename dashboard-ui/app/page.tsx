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

  // Fetch meta and metrics independently so a metrics failure (e.g. an unknown
  // location) never triggers a second meta request.
  const metaResult = getMeta().then(
    (value) => ({ value }),
    (err: unknown) => ({ err }),
  );
  const metricsResult =
    range.error === undefined
      ? getCampaignMetrics({
          from: range.from,
          to: range.to,
          locationId: location,
        }).then(
          (value) => ({ value }),
          (err: unknown) => ({ err }),
        )
      : null;
  const [metaOutcome, metricsOutcome] = await Promise.all([
    metaResult,
    metricsResult,
  ]);

  if ("err" in metaOutcome) {
    return (
      <main>
        <h1>Campaign Dashboard</h1>
        <p role="alert">{errorMessage(metaOutcome.err)}</p>
      </main>
    );
  }
  const meta: Meta = metaOutcome.value;
  let metrics: CampaignMetricsResponse | null = null;
  let apiError: string | null = null;
  if (metricsOutcome) {
    if ("err" in metricsOutcome) apiError = errorMessage(metricsOutcome.err);
    else metrics = metricsOutcome.value;
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
