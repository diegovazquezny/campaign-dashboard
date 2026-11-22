import { connection } from "next/server";
import { CampaignTable } from "../components/campaign-table";
import { ChannelChart } from "../components/channel-chart";
import { FilterBar } from "../components/filter-bar";
import { KpiCards } from "../components/kpi-cards";
import { MissedCallsCard } from "../components/missed-calls-card";
import { OverviewChart } from "../components/overview-chart";
import { PageHeader } from "../components/page-header";
import { Notice } from "../components/notice";
import { PageShell } from "../components/page-shell";
import { PageTitle } from "../components/page-title";
import {
  ApiRequestError,
  getAccountDaily,
  getCampaignMetrics,
  getMeta,
} from "../lib/api";
import type {
  AccountDailyResponse,
  CampaignMetricsResponse,
  Meta,
} from "../lib/api-types";
import { formatDateSpan } from "../lib/badges";
import { first, resolveRange, type SearchParams } from "../lib/date-ranges";
import { aggregateChannels } from "../lib/channels";
import { buildQuery } from "../lib/filters";

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
  const dailyResult =
    range.error === undefined
      ? getAccountDaily({
          from: range.from,
          to: range.to,
          locationId: location,
        }).then(
          (value) => ({ value }),
          (err: unknown) => ({ err }),
        )
      : null;
  const [metaOutcome, metricsOutcome, dailyOutcome] = await Promise.all([
    metaResult,
    metricsResult,
    dailyResult,
  ]);

  if ("err" in metaOutcome) {
    return (
      <PageShell>
        <PageTitle>Campaign Dashboard</PageTitle>
        <Notice role="alert">{errorMessage(metaOutcome.err)}</Notice>
      </PageShell>
    );
  }
  const meta: Meta = metaOutcome.value;
  let metrics: CampaignMetricsResponse | null = null;
  let apiError: string | null = null;
  if (metricsOutcome) {
    if ("err" in metricsOutcome) apiError = errorMessage(metricsOutcome.err);
    else metrics = metricsOutcome.value;
  }

  let daily: AccountDailyResponse | null = null;
  let dailyError: string | null = null;
  if (dailyOutcome) {
    if ("err" in dailyOutcome) dailyError = errorMessage(dailyOutcome.err);
    else daily = dailyOutcome.value;
  }

  const detailQuery = buildQuery(
    {
      preset: first(params.preset),
      from: first(params.from),
      to: first(params.to),
      location,
    },
    {},
  );

  const coverageText = meta.data_coverage
    ? formatDateSpan(
        meta.data_coverage.from,
        meta.data_coverage.to,
        now.getUTCFullYear(),
      )
    : null;

  return (
    <PageShell>
      <PageTitle>Campaign Dashboard</PageTitle>
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
        <Notice role="alert">{apiError}</Notice>
      ) : metrics && metrics.totals.calls === 0 ? (
        <Notice>
          {coverageText
            ? `No calls in this range — data covers ${coverageText}`
            : "No data loaded"}
        </Notice>
      ) : metrics ? (
        <>
          <KpiCards
            totals={metrics.totals}
            range={metrics.range}
            freshness={meta.freshness}
          />
          {dailyError ? (
            <Notice role="alert">{dailyError}</Notice>
          ) : daily ? (
            <OverviewChart
              days={daily.days}
              incompleteFrom={
                meta.freshness?.outcomes_may_be_incomplete_from ?? null
              }
            />
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <ChannelChart channels={aggregateChannels(metrics.rows)} />
            <MissedCallsCard totals={metrics.totals} />
          </div>
          <CampaignTable
            rows={metrics.rows}
            totals={metrics.totals}
            locationSelected={Boolean(location)}
            detailQuery={detailQuery}
          />
        </>
      ) : null}
    </PageShell>
  );
}
