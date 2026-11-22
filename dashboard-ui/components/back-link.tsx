import Link from "next/link";
import { overviewHref } from "../lib/filters";

type Props = {
  query?: string;
  /** Where to go instead of the overview, with the text to show. */
  to?: { href: string; label: string };
};

export function BackLink({ query = "", to }: Props) {
  return (
    <Link
      href={to?.href ?? overviewHref(query)}
      className="self-start text-[13px] font-medium text-muted hover:text-accent"
    >
      {to?.label ?? "← All campaigns"}
    </Link>
  );
}
