import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BackLink } from "../../../components/back-link";
import { CallDetails } from "../../../components/call-details";
import { Notice } from "../../../components/notice";
import { PageShell } from "../../../components/page-shell";
import { PageTitle } from "../../../components/page-title";
import { ApiRequestError, getCall } from "../../../lib/api";
import type { CallDetail } from "../../../lib/api-types";
import { first, type SearchParams } from "../../../lib/date-ranges";
import { buildQuery, listHref, parsePage } from "../../../lib/filters";

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const { id } = await params;
  const query = await searchParams;

  let call: CallDetail;
  try {
    call = await getCall(id);
  } catch (err) {
    if (!(err instanceof ApiRequestError)) throw err;
    if (err.status === 404) notFound();
    return (
      <PageShell>
        <BackLink />
        <PageTitle>Call</PageTitle>
        <Notice role="alert">{err.message}</Notice>
      </PageShell>
    );
  }

  // Back to the list the call came from, at the same filters and page.
  const listQuery = buildQuery(
    {
      preset: first(query.preset),
      from: first(query.from),
      to: first(query.to),
      location: first(query.location),
      page: parsePage(query.page),
    },
    {},
  );
  const back = call.campaign
    ? {
        href: listHref(call.campaign.id, listQuery),
        label: `← ${call.campaign.name}`,
      }
    : { href: listHref(null, listQuery), label: "← No campaign" };

  return (
    <PageShell>
      <BackLink to={back} />
      <PageTitle>Call details</PageTitle>
      <CallDetails call={call} listQuery={listQuery} />
    </PageShell>
  );
}
