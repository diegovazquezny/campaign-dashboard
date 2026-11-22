import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyResponse, Meta } from "../../../lib/api-types";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/campaigns/a",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../../components/daily-chart", () => ({
  DailyChart: ({ days }: { days: unknown[] }) => (
    <div data-testid="chart">{days.length} days</div>
  ),
}));
vi.mock("../../../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/api")>(
      "../../../lib/api",
    );
  return { ...actual, getMeta: vi.fn(), getCampaignDaily: vi.fn() };
});

import { ApiRequestError, getCampaignDaily, getMeta } from "../../../lib/api";
import CampaignDetail from "./page";

const meta: Meta = {
  data_coverage: { from: "2026-08-31", to: "2026-10-29" },
  freshness: {
    latest_update_at: "2026-11-01T00:00:00Z",
    outcomes_may_be_incomplete_from: "2026-10-26",
  },
  locations: [{ id: "loc1", name: "Downtown", timezone: "America/New_York" }],
  campaigns: [],
};

function daily(calls: number): DailyResponse {
  return {
    campaign: { id: "a", name: "Alpha" },
    days: [
      {
        date: "2026-09-01",
        calls,
        booked: 0,
        revenue_cents: 0,
        spend_cents: 100,
      },
      {
        date: "2026-09-02",
        calls,
        booked: 0,
        revenue_cents: 0,
        spend_cents: null,
      },
    ],
  };
}

async function renderPage(search: Record<string, string> = {}, id = "a") {
  render(
    await CampaignDetail({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(search),
    }),
  );
}

describe("CampaignDetail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T12:00:00Z"));
    vi.mocked(getMeta).mockResolvedValue(meta);
    vi.mocked(getCampaignDaily).mockResolvedValue(daily(3));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses the last-quarter range by default and renders chart and table", async () => {
    await renderPage();
    expect(getCampaignDaily).toHaveBeenCalledWith("a", {
      from: "2026-07-01",
      to: "2026-09-30",
      locationId: undefined,
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Alpha");
    expect(screen.getByTestId("chart")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /All campaigns/ }).getAttribute("href"),
    ).toBe("/");
  });

  it("passes the location to the API and labels spend as allocated", async () => {
    await renderPage({ location: "loc1", preset: "last_30_days" });
    expect(getCampaignDaily).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ locationId: "loc1" }),
    );
    expect(
      screen.getAllByText(/allocated by call share/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /All campaigns/ }).getAttribute("href"),
    ).toBe("/?preset=last_30_days&location=loc1");
  });

  it("passes the decoded id through unchanged", async () => {
    await renderPage({}, "a/b c");
    expect(getCampaignDaily).toHaveBeenCalledWith("a/b c", expect.anything());
  });

  it("shows the empty state when there are no calls", async () => {
    vi.mocked(getCampaignDaily).mockResolvedValue(daily(0));
    await renderPage();
    expect(
      screen.getByText("No calls in this range — data covers Aug 31 – Oct 29"),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByTestId("chart")).toBeNull();
  });

  it("renders an API error inline with a generic heading and the filter bar", async () => {
    vi.mocked(getCampaignDaily).mockRejectedValue(
      new ApiRequestError(404, "not_found", "Campaign not found"),
    );
    await renderPage();
    expect(screen.getByRole("alert").textContent).toBe("Campaign not found");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Campaign",
    );
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(getMeta).toHaveBeenCalledTimes(1);
  });

  it("makes no API call for an invalid custom range", async () => {
    await renderPage({
      preset: "custom",
      from: "2026-09-10",
      to: "2026-09-01",
    });
    expect(getCampaignDaily).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the heading and message alone when meta fails", async () => {
    vi.mocked(getMeta).mockRejectedValue(
      new ApiRequestError(0, "network_error", "Could not reach the API"),
    );
    await renderPage();
    expect(screen.getByRole("alert").textContent).toBe(
      "Could not reach the API",
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Alpha");
    expect(
      screen.getByRole("link", { name: /All campaigns/ }).getAttribute("href"),
    ).toBe("/");
  });
});
