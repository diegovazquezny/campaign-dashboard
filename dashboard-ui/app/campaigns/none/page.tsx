import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BackLink } from "../../../components/back-link";
import { CallsSection } from "../../../components/calls-section";
import { FilterBar } from "../../../components/filter-bar";
import { Notice } from "../../../components/notice";
import { PageHeader } from "../../../components/page-header";
import { PageShell } from "../../../components/page-shell";
import { PageTitle } from "../../../components/page-title";
import { ApiRequestError, getMeta } from "../../../lib/api";
import type { Meta } from "../../../lib/api-types";
import { isPastEnd, loadCalls, pageCount } from "../../../lib/calls";
import { resolveRange, type SearchParams } from "../../../lib/date-ranges";
import { buildQuery, pageHref, parsePage } from "../../../lib/filters";

function first(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

// Calls with no campaign. A static route, so it wins over /campaigns/[id]. There is
// no daily chart or table: /api/campaigns/:id/daily has no "none" campaign.
export default async function NoCampaignCalls({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const query = await searchParams;
  const now = new Date();
  const range = resolveRange(query, now.toISOString().slice(0, 10));
  const location = first(query.location);
  const page = parsePage(query.page);
  const filters = {
    preset: first(query.preset),
    from: first(query.from),
    to: first(query.to),
    location,
  };

  const [metaOutcome, calls] = await Promise.all([
    getMeta().then(
      (value) => ({ value }),
      (err: unknown) => ({ err }),
    ),
    range.error === undefined
      ? loadCalls({
          from: range.from,
          to: range.to,
          campaignId: "none",
          locationId: location,
          page,
        })
      : null,
  ]);

  const backQuery = buildQuery(filters, {});

  if (calls?.data && isPastEnd(calls.data)) {
    redirect(pageHref("/campaigns/none", filters, pageCount(calls.data)));
  }

  if ("err" in metaOutcome) {
    if (!(metaOutcome.err instanceof ApiRequestError)) throw metaOutcome.err;
    return (
      <PageShell>
        <BackLink query={backQuery} />
        <PageTitle>No campaign</PageTitle>
        <Notice role="alert">{metaOutcome.err.message}</Notice>
      </PageShell>
    );
  }
  const meta: Meta = metaOutcome.value;

  return (
    <PageShell>
      <BackLink query={backQuery} />
      <PageTitle>No campaign</PageTitle>
      <PageHeader
        coverage={meta.data_coverage}
        freshness={range.error === undefined ? meta.freshness : null}
        range={
          range.error === undefined
            ? range
            : (meta.data_coverage ?? { from: "", to: "" })
        }
        today={now}
      />
      <FilterBar meta={meta} range={range} />
      {calls && <CallsSection result={calls} />}
    </PageShell>
  );
}
