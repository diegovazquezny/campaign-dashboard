import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignMetricsResponse, Meta } from "../lib/api-types";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, getMeta: vi.fn(), getCampaignMetrics: vi.fn() };
});

import { ApiRequestError, getCampaignMetrics, getMeta } from "../lib/api";
import Home from "./page";

const meta: Meta = {
  data_coverage: { from: "2026-08-31", to: "2026-10-29" },
  freshness: {
    latest_update_at: "2026-11-01T00:00:00Z",
    outcomes_may_be_incomplete_from: "2026-10-26",
  },
  locations: [{ id: "loc1", name: "Downtown", timezone: "America/New_York" }],
  campaigns: [],
};

function metrics(calls: number): CampaignMetricsResponse {
  const m = {
    calls,
    unique_callers: calls,
    new_callers: 0,
    booked: 0,
    booking_rate: null,
    unanswered_rate: null,
    awaiting_outcome: 0,
    revenue_cents: 0,
    spend_cents: null,
  };
  return {
    range: { from: "2026-07-01", to: "2026-09-30" },
    rows: [
      {
        campaign_id: "a",
        name: "Alpha",
        channel: "radio",
        revenue_per_spend: null,
        spend_per_booking_cents: null,
        ...m,
      },
    ],
    totals: {
      ...m,
      paid: {
        revenue_cents: 0,
        booked: 0,
        spend_cents: null,
        revenue_per_spend: null,
        spend_per_booking_cents: null,
      },
    },
  };
}

async function renderHome(params: Record<string, string>) {
  render(await Home({ searchParams: Promise.resolve(params) }));
}

describe("Home", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T12:00:00Z"));
    vi.mocked(getMeta).mockResolvedValue(meta);
    vi.mocked(getCampaignMetrics).mockResolvedValue(metrics(5));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses the last-quarter range by default and renders the table", async () => {
    await renderHome({});
    expect(getCampaignMetrics).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-09-30",
      locationId: undefined,
    });
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("passes the location param to the API", async () => {
    await renderHome({ location: "loc1" });
    expect(getCampaignMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc1" }),
    );
    expect(screen.getByText(/allocated by call share/)).toBeTruthy();
  });

  it("shows the empty state when there are no calls", async () => {
    vi.mocked(getCampaignMetrics).mockResolvedValue(metrics(0));
    await renderHome({});
    expect(
      screen.getByText("No calls in this range — data covers Aug 31 – Oct 29"),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("shows No data loaded when coverage is null and there are no calls", async () => {
    vi.mocked(getMeta).mockResolvedValue({
      ...meta,
      data_coverage: null,
      freshness: null,
    });
    vi.mocked(getCampaignMetrics).mockResolvedValue(metrics(0));
    await renderHome({});
    expect(screen.getAllByText("No data loaded").length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders an API error inline and keeps the filter bar", async () => {
    vi.mocked(getCampaignMetrics).mockRejectedValue(
      new ApiRequestError(404, "not_found", "Location not found"),
    );
    await renderHome({ location: "nope" });
    expect(screen.getByRole("alert").textContent).toBe("Location not found");
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("makes no metrics call for an invalid custom range", async () => {
    await renderHome({ preset: "custom", from: "2026-01-01" });
    expect(getCampaignMetrics).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
