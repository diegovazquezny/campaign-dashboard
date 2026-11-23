import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { dailyTableKey, type Day } from "../lib/daily";
import { HELP } from "../lib/help-text";
import { DailyTable } from "./daily-table";

afterEach(cleanup);

// The text an info icon points at with aria-describedby.
const tipText = (icon: HTMLElement) =>
  document.getElementById(icon.getAttribute("aria-describedby")!)?.textContent;

const day = (date: string, over: Partial<Day> = {}): Day => ({
  date,
  calls: 1,
  booked: 1,
  revenue_cents: 10000,
  spend_cents: 5000,
  ...over,
});

function bodyRows() {
  const body = screen.getAllByRole("rowgroup")[1];
  return within(body).getAllByRole("row");
}

function cellTexts(row: HTMLElement) {
  return within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent);
}

describe("DailyTable", () => {
  it("renders rows in date order", () => {
    render(
      <DailyTable
        days={[day("2025-10-03"), day("2025-10-01"), day("2025-10-02")]}
      />,
    );
    const dates = bodyRows().map(
      (r) => within(r).getByRole("rowheader").textContent,
    );
    expect(dates).toEqual(["2025-10-01", "2025-10-02", "2025-10-03"]);
  });

  it("shows — for null spend, including the totals when all are null", () => {
    render(
      <DailyTable
        days={[
          day("2025-10-01", { spend_cents: null }),
          day("2025-10-02", { spend_cents: null }),
        ]}
      />,
    );
    for (const r of bodyRows()) expect(cellTexts(r)[3]).toBe("—");
    expect(cellTexts(screen.getByTestId("totals-row"))[3]).toBe("—");
  });

  it("shows zero-filled days as zeros", () => {
    render(
      <DailyTable
        days={[
          day("2025-10-01", {
            calls: 0,
            booked: 0,
            revenue_cents: 0,
            spend_cents: 0,
          }),
        ]}
      />,
    );
    expect(cellTexts(bodyRows()[0])).toEqual(["0", "0", "$0", "$0"]);
  });

  it("totals row equals the sum of the rows", () => {
    render(
      <DailyTable
        days={[
          day("2025-10-01", {
            calls: 2,
            booked: 1,
            revenue_cents: 10000,
            spend_cents: 5000,
          }),
          day("2025-10-02", {
            calls: 3,
            booked: 2,
            revenue_cents: 20000,
            spend_cents: null,
          }),
          day("2025-10-03", {
            calls: 5,
            booked: 0,
            revenue_cents: 5000,
            spend_cents: 2500,
          }),
        ]}
      />,
    );
    expect(cellTexts(screen.getByTestId("totals-row"))).toEqual([
      "10",
      "3",
      "$350",
      "$75",
    ]);
  });

  it("shows the location label only when a location is selected", () => {
    const { rerender } = render(<DailyTable days={[day("2025-10-01")]} />);
    expect(
      screen.getByRole("button", { name: "About Budgeted spend (est.)" }),
    ).toBeTruthy();
    expect(screen.queryByText(/allocated by call share/)).toBeNull();
    rerender(<DailyTable days={[day("2025-10-01")]} locationSelected />);
    expect(screen.getByText(/allocated by call share/)).toBeTruthy();
  });

  it("gives every header an info icon with its explanation", () => {
    const { rerender } = render(<DailyTable days={[day("2025-10-01")]} />);
    const expected: [string, string][] = [
      ["Date", HELP.date],
      ["Calls", HELP.calls],
      ["Booked", HELP.booked],
      ["Revenue", HELP.revenue],
      ["Budgeted spend (est.)", HELP.spend],
    ];
    for (const [label, text] of expected) {
      expect(
        tipText(screen.getByRole("button", { name: `About ${label}` })),
      ).toBe(text);
    }
    rerender(<DailyTable days={[day("2025-10-01")]} locationSelected />);
    expect(
      tipText(
        screen.getByRole("button", {
          name: "About Budgeted spend (est.), allocated by call share",
        }),
      ),
    ).toBe(HELP.spendByLocation);
  });

  it("renders nothing when there are no days", () => {
    const { container } = render(<DailyTable days={[]} />);
    expect(container.querySelector("table")).toBeNull();
  });

  describe("paging", () => {
    // n consecutive days starting 2025-01-01; calls = day number so totals differ per page.
    const run = (n: number): Day[] =>
      Array.from({ length: n }, (_, i) => {
        const d = new Date(Date.UTC(2025, 0, 1 + i));
        return day(d.toISOString().slice(0, 10), { calls: i + 1 });
      });
    const firstAndLast = () => {
      const r = bodyRows();
      const date = (row: HTMLElement) =>
        within(row).getByRole("rowheader").textContent;
      return [r.length, date(r[0]), date(r[r.length - 1])] as const;
    };
    const next = () =>
      fireEvent.click(screen.getByRole("button", { name: "Next 30 days" }));
    const prev = () =>
      fireEvent.click(screen.getByRole("button", { name: "Previous 30 days" }));

    it("pages 90 days into 3 pages of 30", () => {
      render(<DailyTable days={run(90)} />);
      expect(firstAndLast()).toEqual([30, "2025-01-01", "2025-01-30"]);
      expect(screen.getByText("Days 1–30 of 90")).toBeTruthy();
      next();
      next();
      expect(firstAndLast()).toEqual([30, "2025-03-02", "2025-03-31"]);
      expect(screen.getByText("Days 61–90 of 90")).toBeTruthy();
    });

    it("shows no pager for 30 days or fewer", () => {
      render(<DailyTable days={run(30)} />);
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(bodyRows()).toHaveLength(30);
    });

    it("shows the remainder on an uneven last page", () => {
      render(<DailyTable days={run(45)} />);
      next();
      expect(bodyRows()).toHaveLength(15);
      expect(screen.getByText("Days 31–45 of 45")).toBeTruthy();
    });

    it("marks Previous disabled on the first page and Next on the last", () => {
      render(<DailyTable days={run(45)} />);
      const p = screen.getByRole("button", {
        name: "Previous 30 days",
      }) as HTMLButtonElement;
      const n = screen.getByRole("button", {
        name: "Next 30 days",
      }) as HTMLButtonElement;
      expect([p.ariaDisabled, n.ariaDisabled]).toEqual(["true", "false"]);
      next();
      expect([p.ariaDisabled, n.ariaDisabled]).toEqual(["false", "true"]);
      prev();
      expect([p.ariaDisabled, n.ariaDisabled]).toEqual(["true", "false"]);
    });

    it("keeps the totals row covering all days on every page", () => {
      render(<DailyTable days={run(45)} />);
      const before = cellTexts(screen.getByTestId("totals-row"));
      // 1 + 2 + ... + 45 = 1035 calls
      expect(
        within(screen.getByTestId("totals-row")).getByRole("rowheader")
          .textContent,
      ).toBe("Totals (all 45 days)");
      expect(before[0]).toBe("1,035");
      next();
      expect(cellTexts(screen.getByTestId("totals-row"))).toEqual(before);
    });

    it("resets to page 1 when remounted with a new key", () => {
      const { rerender } = render(<DailyTable key="a" days={run(90)} />);
      next();
      expect(screen.getByText("Days 31–60 of 90")).toBeTruthy();
      rerender(<DailyTable key="b" days={run(90)} />);
      expect(screen.getByText("Days 1–30 of 90")).toBeTruthy();
    });

    it("clamps to the last page if the days shrink under the same key", () => {
      const { rerender } = render(<DailyTable days={run(90)} />);
      next();
      next();
      rerender(<DailyTable days={run(45)} />);
      expect(screen.getByText("Days 31–45 of 45")).toBeTruthy();
      expect(bodyRows()).toHaveLength(15);
    });

    it("builds the key from from, to and location", () => {
      const a = dailyTableKey({ from: "2025-01-01", to: "2025-03-31" }, "o1");
      expect(a).not.toBe(
        dailyTableKey({ from: "2025-01-02", to: "2025-03-31" }, "o1"),
      );
      expect(a).not.toBe(
        dailyTableKey({ from: "2025-01-01", to: "2025-04-01" }, "o1"),
      );
      expect(a).not.toBe(
        dailyTableKey({ from: "2025-01-01", to: "2025-03-31" }, undefined),
      );
    });
  });
});
