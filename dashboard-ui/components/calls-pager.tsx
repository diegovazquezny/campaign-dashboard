"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildQuery } from "../lib/filters";
import { Pager } from "./pager";

// Server-paged: the page lives in the URL (`?page=`), so changing it refetches.
// Other params are kept as they are.
export function CallsPager({
  page,
  pageCount,
  label,
}: {
  page: number;
  pageCount: number;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(next: number) {
    // buildQuery rebuilds the filter params from this state, so pass the current ones.
    const current = {
      preset: searchParams.get("preset") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      location: searchParams.get("location") ?? undefined,
    };
    const query = buildQuery(current, { page: next }, searchParams.toString());
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Pager
      page={page}
      pageCount={pageCount}
      onChange={go}
      label={label}
      ariaLabel="Calls pages"
      prevLabel="Previous calls"
      nextLabel="Next calls"
    />
  );
}
