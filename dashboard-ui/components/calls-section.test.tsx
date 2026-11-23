import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// The pager under the table reads the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => "/campaigns/x",
  useSearchParams: () => new URLSearchParams(),
}));

import type { CallRow } from "../lib/api-types";
import { HELP } from "../lib/help-text";
import { CallsSection } from "./calls-section";

afterEach(cleanup);

const call: CallRow = {
  call_id: "c1",
  started_at: "2026-10-01T15:00:00Z",
  ended_at: "2026-10-01T15:05:00Z",
  local_date: "2026-10-01",
  timezone: "America/New_York",
  duration_seconds: 300,
  answered: true,
  outcome: "booked",
  revenue_cents: 12000,
  agent_id: "a1",
  tracking_number: "+15550100",
  campaign: { id: "x", name: "X" },
  channel: "paid_search",
  location: { id: "l1", name: "Office" },
};

const tipText = (icon: HTMLElement) =>
  document.getElementById(icon.getAttribute("aria-describedby")!)?.textContent;

describe("CallsSection", () => {
  it("gives every header an info icon with its explanation", () => {
    render(
      <CallsSection
        result={{
          data: { page: 1, page_size: 25, total: 1, calls: [call] },
          error: null,
        }}
        query=""
      />,
    );

    const expected: [string, string][] = [
      ["Time", HELP.time],
      ["Outcome", HELP.outcome],
      ["Duration", HELP.duration],
      ["Agent", HELP.agent],
      ["Revenue", HELP.revenue],
    ];
    for (const [label, text] of expected) {
      expect(
        tipText(screen.getByRole("button", { name: `About ${label}` })),
      ).toBe(text);
    }
  });

  it("shows no icons when there are no calls", () => {
    render(
      <CallsSection
        result={{
          data: { page: 1, page_size: 25, total: 0, calls: [] },
          error: null,
        }}
        query=""
      />,
    );
    expect(screen.queryByRole("button", { name: /^About / })).toBeNull();
  });
});
