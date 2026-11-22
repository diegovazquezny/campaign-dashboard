import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BackLink } from "../../../components/back-link";
import { CallsSection } from "../../../components/calls-section";
import { DailyChart } from "../../../components/daily-chart";
import { DailyTable } from "../../../components/daily-table";
import { FilterBar } from "../../../components/filter-bar";
import { PageHeader } from "../../../components/page-header";
import { Notice } from "../../../components/notice";
import { PageShell } from "../../../components/page-shell";
import { PageTitle } from "../../../components/page-title";
import { ApiRequestError, getCampaignDaily, getMeta } from "../../../lib/api";
import type { DailyResponse, Meta } from "../../../lib/api-types";
import { formatDateSpan } from "../../../lib/badges";
import { dailyTableKey, hasActivity } from "../../../lib/daily";
import { first, resolveRange, type SearchParams } from "../../../lib/date-ranges";
import { isPastEnd, loadCalls, pageCount } from "../../../lib/calls";
import { buildQuery, pageHref, parsePage } from "../../../lib/filters";

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  throw err;
}

export default async function CampaignDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Request-time rendering: API_URL is read at runtime, nothing is prerendered.
  await connection();
  // Next.js has already URL-decoded `id`; getCampaignDaily encodes it once.
  const { id } = await params;
  const query = await searchParams;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const range = resolveRange(query, today);
  const location = first(query.location);

  // Independent fetches: a daily 404 keeps the filter bar and never refetches meta.
  const metaResult = getMeta().then(
    (value) => ({ value }),
    (err: unknown) => ({ err }),
  );
  const dailyResult =
    range.error === undefined
      ? getCampaignDaily(id, {
          from: range.from,
          to: range.to,
          locationId: location,
        }).then(
          (value) => ({ value }),
          (err: unknown) => ({ err }),
        )
      : null;
  const page = parsePage(query.page);
  const callsResult =
    range.error === undefined
      ? loadCalls({
          from: range.from,
          to: range.to,
          campaignId: id,
          locationId: location,
          page,
        })
      : null;
  const [metaOutcome, dailyOutcome, calls] = await Promise.all([
    metaResult,
    dailyResult,
    callsResult,
  ]);

  let daily: DailyResponse | null = null;
  let apiError: string | null = null;
  if (dailyOutcome) {
    if ("err" in dailyOutcome) apiError = errorMessage(dailyOutcome.err);
    else daily = dailyOutcome.value;
  }

  const filters = {
    preset: first(query.preset),
    from: first(query.from),
    to: first(query.to),
    location,
  };
  const backQuery = buildQuery(filters, {});

  // A hand-edited page past the last one: go to the last page instead of an empty list.
  if (calls?.data && isPastEnd(calls.data)) {
    redirect(pageHref(`/campaigns/${encodeURIComponent(id)}`, filters, pageCount(calls.data)));
  }

  if ("err" in metaOutcome) {
    return (
      <PageShell>
        <BackLink query={backQuery} />
        <PageTitle>{daily?.campaign.name ?? "Campaign"}</PageTitle>
        <Notice role="alert">{errorMessage(metaOutcome.err)}</Notice>
      </PageShell>
    );
  }
  const meta: Meta = metaOutcome.value;

  const coverageText = meta.data_coverage
    ? formatDateSpan(
        meta.data_coverage.from,
        meta.data_coverage.to,
        now.getUTCFullYear(),
      )
    : null;

  return (
    <PageShell>
      <BackLink query={backQuery} />
      <PageTitle>{daily?.campaign.name ?? "Campaign"}</PageTitle>
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
      ) : daily && !hasActivity(daily.days) ? (
        <Notice>
          {coverageText
            ? `No calls in this range — data covers ${coverageText}`
            : "No data loaded"}
        </Notice>
      ) : daily ? (
        <>
          <DailyChart days={daily.days} locationSelected={Boolean(location)} />
          <DailyTable
            key={dailyTableKey(range, location)}
            days={daily.days}
            locationSelected={Boolean(location)}
          />
          {calls && <CallsSection result={calls} />}
        </>
      ) : null}
    </PageShell>
  );
}
