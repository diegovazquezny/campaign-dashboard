"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Meta } from "../lib/api-types";
import type { Preset, ResolvedRange } from "../lib/date-ranges";
import { DEFAULT_PRESET } from "../lib/date-ranges";
import {
  buildQuery,
  type FilterChange,
  type FilterState,
} from "../lib/filters";

const PRESET_LABELS: [Preset, string][] = [
  ["last_quarter", "Last quarter"],
  ["this_quarter", "This quarter"],
  ["last_30_days", "Last 30 days"],
  ["last_90_days", "Last 90 days"],
  ["custom", "Custom"],
];

const LABEL =
  "inline-flex items-center gap-2 text-[13px] font-medium text-muted";
const FIELD = "rounded-ctl border border-border bg-card px-2.5 py-1.5 text-fg";

// Native date inputs emit partial values (e.g. year 0002) while typing. On
// change only push plausible 4-digit years; on blur accept any real date.
function isCompleteDate(value: string, final: boolean): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCFullYear(y);
  const valid = dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  return valid && (final || y >= 1000);
}

export function FilterBar({
  meta,
  range,
}: {
  meta: Meta;
  range: ResolvedRange;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const serverState: FilterState = {
    preset: range.preset,
    from: range.from,
    to: range.to,
    location: searchParams.get("location") ?? "",
  };

  // Server-resolved props lag behind navigation, so track the latest state we
  // pushed; it resets whenever the URL actually changes.
  const urlKey = searchParams.toString();
  const [latest, setLatest] = useState({ key: urlKey, state: serverState });
  if (latest.key !== urlKey) setLatest({ key: urlKey, state: serverState });
  const base = latest.key === urlKey ? latest.state : serverState;

  // In-progress date input values, resynced when the resolved range changes.
  const [drafts, setDrafts] = useState({
    from: range.from ?? "",
    to: range.to ?? "",
  });
  const [draftsFor, setDraftsFor] = useState(`${range.from}|${range.to}`);
  if (draftsFor !== `${range.from}|${range.to}`) {
    setDraftsFor(`${range.from}|${range.to}`);
    setDrafts({ from: range.from ?? "", to: range.to ?? "" });
  }

  function update(change: FilterChange) {
    const query = buildQuery(base, change, urlKey);
    const next = new URLSearchParams(query);
    setLatest({
      key: urlKey,
      state: {
        preset: next.get("preset") ?? DEFAULT_PRESET,
        from: next.get("from") ?? undefined,
        to: next.get("to") ?? undefined,
        location: next.get("location") ?? "",
      },
    });
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function editDate(field: "from" | "to", value: string, final: boolean) {
    setDrafts((d) => ({ ...d, [field]: value }));
    const ok = value === "" ? final : isCompleteDate(value, final);
    if (ok && value !== (base[field] ?? "")) update({ [field]: value });
  }

  function selectPreset(preset: Preset) {
    // Custom prefills with the currently resolved range so it never starts empty.
    update(
      preset === "custom" && range.preset !== "custom"
        ? { preset, from: range.from, to: range.to }
        : { preset },
    );
  }

  return (
    <div
      aria-busy={isPending}
      className="flex flex-wrap items-center gap-x-5 gap-y-3 aria-busy:opacity-70"
    >
      <div
        role="group"
        aria-label="Date range"
        className="inline-flex gap-0.5 rounded-ctl border border-border bg-chip p-[3px]"
      >
        {PRESET_LABELS.map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            aria-pressed={range.preset === preset}
            className="cursor-pointer rounded-[calc(var(--radius)-3px)] px-3.5 py-1.5 font-medium text-muted transition-colors hover:text-fg aria-pressed:bg-accent aria-pressed:text-accent-fg aria-pressed:shadow-ctl aria-pressed:hover:text-accent-fg"
            onClick={() => selectPreset(preset)}
          >
            {label}
          </button>
        ))}
      </div>
      {range.preset === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className={LABEL}>
            From
            <input
              type="date"
              className={FIELD}
              value={drafts.from}
              onChange={(e) => editDate("from", e.target.value, false)}
              onBlur={(e) => editDate("from", e.target.value, true)}
            />
          </label>
          <label className={LABEL}>
            To
            <input
              type="date"
              className={FIELD}
              value={drafts.to}
              onChange={(e) => editDate("to", e.target.value, false)}
              onBlur={(e) => editDate("to", e.target.value, true)}
            />
          </label>
          {range.error && (
            <p role="alert" className="text-[13px] text-bad">
              {range.error}
            </p>
          )}
        </div>
      )}
      <label className={LABEL}>
        Office
        <select
          className={FIELD}
          value={serverState.location}
          onChange={(e) => update({ location: e.target.value })}
        >
          <option value="">All offices</option>
          {serverState.location &&
            !meta.locations.some((l) => l.id === serverState.location) && (
              <option value={serverState.location}>
                Unknown office ({serverState.location})
              </option>
            )}
          {meta.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {isPending && (
        <span role="status" className="text-[13px] text-muted">
          Updating…
        </span>
      )}
    </div>
  );
}
