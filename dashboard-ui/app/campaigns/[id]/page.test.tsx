import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CallRow,
  CallsResponse,
  DailyResponse,
  Meta,
} from "../../../lib/api-types";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
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
  return {
    ...actual,
    getMeta: vi.fn(),
    getCampaignDaily: vi.fn(),
    getCalls: vi.fn(),
  };
});

import {
  ApiRequestError,
  getCalls,
  getCampaignDaily,
  getMeta,
} from "../../../lib/api";
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

const call = (over: Partial<CallRow> = {}): CallRow => ({
  call_id: "c1",
  started_at: "2026-09-02T15:00:00Z",
  ended_at: "2026-09-02T15:02:05Z",
  local_date: "2026-09-02",
  timezone: "America/Chicago",
  duration_seconds: 125,
  answered: true,
  outcome: "booked",
  revenue_cents: 9000,
  agent_id: "agent_01",
  tracking_number: "+15550000000",
  campaign: { id: "a", name: "Alpha" },
  channel: "paid_search",
  location: { id: "loc1", name: "Downtown" },
  ...over,
});

const callsPage = (over: Partial<CallsResponse> = {}): CallsResponse => ({
  page: 1,
  page_size: 25,
  total: 1,
  calls: [call()],
  ...over,
});

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
    vi.mocked(getCalls).mockResolvedValue(callsPage({ total: 0, calls: [] }));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses the last-90-days range by default and renders chart and table", async () => {
    await renderPage();
    expect(getCampaignDaily).toHaveBeenCalledWith("a", {
      from: "2026-08-25",
      to: "2026-11-22",
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

  describe("calls list", () => {
    beforeEach(() => {
      vi.mocked(getCalls).mockResolvedValue(callsPage());
    });

    it("fetches the page's calls with the same filters and renders them", async () => {
      await renderPage({ location: "loc1", page: "2" });
      expect(getCalls).toHaveBeenCalledWith({
        from: "2026-08-25",
        to: "2026-11-22",
        campaignId: "a",
        locationId: "loc1",
        page: 2,
      });
      const table = screen.getAllByRole("table")[1];
      expect(table.textContent).toContain("Sep 2, 10:00 AM CDT");
      expect(table.textContent).toContain("Booked");
      expect(table.textContent).toContain("2m 05s");
      expect(table.textContent).toContain("agent_01");
      expect(table.textContent).toContain("$90");
    });

    it("treats a bad page param as page 1", async () => {
      await renderPage({ page: "abc" });
      expect(getCalls).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });

    it("shows Awaiting outcome and dashes for a call with no outcome, agent or revenue", async () => {
      vi.mocked(getCalls).mockResolvedValue(
        callsPage({
          calls: [call({ outcome: null, revenue_cents: null, agent_id: null })],
        }),
      );
      await renderPage();
      const table = screen.getAllByRole("table")[1];
      expect(table.textContent).toContain("Awaiting outcome");
      expect(within(table).getAllByText("—").length).toBe(2);
    });

    it("shows an empty state when the range has no calls", async () => {
      vi.mocked(getCalls).mockResolvedValue(callsPage({ total: 0, calls: [] }));
      await renderPage();
      expect(screen.getByText("No calls in this range.")).toBeTruthy();
      expect(screen.getAllByRole("table").length).toBe(1);
    });

    it("shows a pager when there is more than one page", async () => {
      vi.mocked(getCalls).mockResolvedValue(callsPage({ total: 60 }));
      await renderPage();
      expect(
        screen.getByRole("navigation", { name: "Calls pages" }),
      ).toBeTruthy();
      expect(screen.getByText("Calls 1–1 of 60")).toBeTruthy();
    });

    it("redirects to the last page when the page is past the end", async () => {
      vi.mocked(getCalls).mockResolvedValue(
        callsPage({ page: 9, total: 30, calls: [] }),
      );
      await expect(renderPage({ page: "9", location: "loc1" })).rejects.toThrow(
        "NEXT_REDIRECT /campaigns/a?location=loc1&page=2",
      );
    });

    it("shows a calls error inline without hiding the chart and table", async () => {
      vi.mocked(getCalls).mockRejectedValue(
        new ApiRequestError(500, "http_error", "Calls unavailable"),
      );
      await renderPage();
      expect(screen.getByRole("alert").textContent).toBe("Calls unavailable");
      expect(screen.getByTestId("chart")).toBeTruthy();
    });

    it("does not fetch calls for an invalid custom range", async () => {
      await renderPage({
        preset: "custom",
        from: "2026-09-10",
        to: "2026-09-01",
      });
      expect(getCalls).not.toHaveBeenCalled();
    });
  });
});
