import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

const cov = { from: "2026-08-31", to: "2026-10-29" };
const fresh = {
  latest_update_at: "2026-11-01T00:00:00Z",
  outcomes_may_be_incomplete_from: "2026-10-26",
};

describe("PageHeader", () => {
  afterEach(cleanup);

  it("renders both badges", () => {
    render(
      <PageHeader
        coverage={cov}
        freshness={fresh}
        range={{ from: "2026-07-01", to: "2026-10-30" }}
      />,
    );
    expect(screen.getByText("Data covers Aug 31 – Oct 29")).toBeTruthy();
    expect(
      screen.getByText(
        /Outcomes can take up to 3 days to arrive; bookings and revenue after Oct 26 may be incomplete\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Data covers Aug 31 – Oct 29.")).toBeTruthy();
  });

  it("renders no badges inside coverage and before freshness", () => {
    render(
      <PageHeader
        coverage={cov}
        freshness={fresh}
        range={{ from: "2026-09-01", to: "2026-10-01" }}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows No data loaded with null coverage", () => {
    render(
      <PageHeader
        coverage={null}
        freshness={null}
        range={{ from: "2026-09-01", to: "2026-10-01" }}
      />,
    );
    expect(screen.getByText("No data loaded")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
