import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

const cov = { from: "2026-08-31", to: "2026-10-29" };
const fresh = {
  latest_update_at: "2026-11-01T00:00:00Z",
  outcomes_may_be_incomplete_from: "2026-10-26",
};
const today = new Date("2026-11-22T00:00:00Z");

describe("PageHeader", () => {
  afterEach(cleanup);

  it("renders both badges", () => {
    render(
      <PageHeader
        today={today}
        coverage={cov}
        freshness={fresh}
        range={{ from: "2026-07-01", to: "2026-10-30" }}
      />,
    );
    expect(screen.getByText("Data covers Aug 31 – Oct 29")).toBeTruthy();
    expect(
      screen.getByText(
        "Bookings and revenue from Oct 26 onward may be incomplete.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Selected range extends outside available data (covers Aug 31 – Oct 29).",
      ),
    ).toBeTruthy();
  });

  it("renders only the freshness badge", () => {
    render(
      <PageHeader
        today={today}
        coverage={cov}
        freshness={fresh}
        range={{ from: "2026-10-01", to: "2026-10-29" }}
      />,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText(/from Oct 26 onward/)).toBeTruthy();
  });

  it("renders only the partial-range badge", () => {
    render(
      <PageHeader
        today={today}
        coverage={cov}
        freshness={fresh}
        range={{ from: "2026-07-01", to: "2026-10-20" }}
      />,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText(/extends outside available data/)).toBeTruthy();
  });

  it("renders no badges inside coverage and before freshness", () => {
    render(
      <PageHeader
        today={today}
        coverage={cov}
        freshness={fresh}
        range={{ from: "2026-09-01", to: "2026-10-01" }}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("includes years when coverage is not in the current year", () => {
    render(
      <PageHeader
        today={new Date("2027-03-01T00:00:00Z")}
        coverage={cov}
        freshness={null}
        range={{ from: "2026-09-01", to: "2026-10-01" }}
      />,
    );
    expect(
      screen.getByText("Data covers Aug 31, 2026 – Oct 29, 2026"),
    ).toBeTruthy();
  });

  it("shows No data loaded with null coverage", () => {
    render(
      <PageHeader
        today={today}
        coverage={null}
        freshness={null}
        range={{ from: "2026-09-01", to: "2026-10-01" }}
      />,
    );
    expect(screen.getByText("No data loaded")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides the freshness badge when coverage is null", () => {
    render(
      <PageHeader
        today={today}
        coverage={null}
        freshness={fresh}
        range={{ from: "2026-10-01", to: "2026-10-29" }}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
