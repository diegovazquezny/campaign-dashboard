import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CampaignRow, Totals } from "../lib/api-types";
import { CampaignTable } from "./campaign-table";

function row(over: Partial<CampaignRow>): CampaignRow {
  return {
    campaign_id: "x",
    name: "X",
    channel: "radio",
    calls: 10,
    unique_callers: 8,
    new_callers: 4,
    booked: 2,
    booking_rate: 0.2,
    unanswered_rate: 0.1,
    awaiting_outcome: 1,
    revenue_cents: 100000,
    spend_cents: 50000,
    revenue_per_spend: 2,
    spend_per_booking_cents: 25000,
    ...over,
  };
}

const rows: CampaignRow[] = [
  row({ campaign_id: "a", name: "Alpha", revenue_cents: 100000 }),
  row({ campaign_id: "b", name: "Beta", revenue_cents: 300000 }),
  row({
    campaign_id: "z",
    name: "Zero",
    channel: "tv",
    calls: 0,
    revenue_cents: 0,
    booking_rate: null,
    revenue_per_spend: null,
    spend_per_booking_cents: null,
  }),
  row({
    campaign_id: null,
    name: "No campaign",
    channel: "none",
    spend_cents: null,
    revenue_per_spend: null,
    spend_per_booking_cents: null,
    revenue_cents: 999999999,
    channel_breakdown: [
      { channel: "organic", calls: 7, booked: 0, revenue_cents: 0 },
      { channel: "direct", calls: 3, booked: 0, revenue_cents: 0 },
    ],
  }),
];

const totals: Totals = {
  calls: 1234,
  unique_callers: 777,
  new_callers: 5,
  booked: 9,
  booking_rate: 0.5,
  unanswered_rate: 0.1,
  missed: 0,
  voicemail: 0,
  awaiting_outcome: 2,
  revenue_cents: 500000,
  spend_cents: 250000,
  paid: {
    revenue_cents: 400000,
    booked: 4,
    spend_cents: 250000,
    revenue_per_spend: 1.6,
    spend_per_booking_cents: 62500,
  },
};

function names(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => r.querySelector("td, th")?.textContent ?? "");
}

describe("CampaignTable", () => {
  afterEach(cleanup);

  it("sorts by revenue descending by default, then No campaign, then totals", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    const n = names();
    expect(n.slice(0, 5).map((s) => s.slice(0, 4))).toEqual([
      "Beta",
      "Alph",
      "Zero",
      "No c",
      "Tota",
    ]);
  });

  it("flips direction and keeps No campaign above totals", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    fireEvent.click(
      screen.getByRole("button", { name: /^Revenue$|^Revenue ▼$/ }),
    );
    expect(names()[0]).toMatch(/^Zero/);
    const n = names();
    expect(n[n.length - 2]).toMatch(/^No campaign/);
    expect(n[n.length - 1]).toMatch(/^Totals/);
  });

  it("first click is ascending for text and sets aria-sort", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    fireEvent.click(screen.getByRole("button", { name: "Campaign" }));
    expect(names()[0]).toMatch(/^Alpha/);
    expect(
      screen
        .getByRole("columnheader", { name: /Campaign/ })
        .getAttribute("aria-sort"),
    ).toBe("ascending");
  });

  it("puts zero-call campaigns last under a ratio sort", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    fireEvent.click(screen.getByRole("button", { name: "Revenue ÷ spend" }));
    expect(names()[2]).toMatch(/^Zero/);
  });

  it("shows — for null cells and no spend for No campaign", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    const cells = screen.getByTestId("no-campaign-row").querySelectorAll("td");
    expect(cells[10].textContent).toBe("—");
    expect(cells[11].textContent).toBe("—");
  });

  it("describes the channel breakdown on the No campaign row", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    const tr = screen.getByTestId("no-campaign-row");
    const text = document.getElementById(
      tr.getAttribute("aria-describedby")!,
    )!.textContent;
    expect(text).toBe("Calls by channel: organic 7, direct 3");
    expect(tr.getAttribute("title")).toBe(text);
  });

  it("describes the New callers header", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    const th = screen.getByRole("columnheader", { name: /New callers/ });
    expect(
      document.getElementById(th.getAttribute("aria-describedby")!)!
        .textContent,
    ).toBe("First seen since data starts (Sep 1)");
  });

  it("totals row uses totals values and paid ratios", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    const tr = screen.getByTestId("totals-row");
    expect(tr.textContent).toContain(
      "Totals (spend ratios: paid campaigns only)",
    );
    const cells = tr.querySelectorAll("td");
    expect(cells[1].textContent).toBe("777");
    expect(cells[7].textContent).toBe("$5,000");
    expect(cells[8].textContent).toBe("$2,500");
    expect(cells[9].textContent).toBe("1.60×");
    expect(cells[10].textContent).toBe("$625");
  });

  it("shows the allocation label only with a location", () => {
    const { rerender } = render(<CampaignTable rows={rows} totals={totals} />);
    expect(screen.queryByText(/allocated by call share/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Budgeted spend (est.)" }),
    ).toBeTruthy();
    rerender(<CampaignTable rows={rows} totals={totals} locationSelected />);
    expect(
      screen.getByRole("button", {
        name: "Budgeted spend (est.), allocated by call share",
      }),
    ).toBeTruthy();
  });

  it("links ranked rows to the detail page with the query carried", () => {
    render(
      <CampaignTable
        rows={rows}
        totals={totals}
        detailQuery="preset=last_30_days&location=loc1"
      />,
    );
    const link = screen.getByRole("link", { name: "Beta" });
    expect(link.getAttribute("href")).toMatch(
      /^\/campaigns\/.+\?preset=last_30_days&location=loc1$/,
    );
  });

  it("does not link the No campaign row", () => {
    render(<CampaignTable rows={rows} totals={totals} />);
    const cell = screen.getByTestId("no-campaign-row");
    expect(cell.querySelector("a")).toBeNull();
  });
});
