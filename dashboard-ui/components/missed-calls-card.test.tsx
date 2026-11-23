import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Totals } from "../lib/api-types";
import { HELP } from "../lib/help-text";
import { MissedCallsCard } from "./missed-calls-card";

afterEach(cleanup);

const totals = {
  calls: 40,
  missed: 5,
  voicemail: 3,
  unanswered_rate: 0.2,
} as Totals;

describe("MissedCallsCard", () => {
  it("shows missed, voicemail and the unanswered rate", () => {
    render(<MissedCallsCard totals={totals} />);
    expect(screen.getByText("20.0%")).toBeTruthy();
    expect(screen.getByText("Missed").nextElementSibling?.textContent).toBe(
      "5",
    );
    expect(screen.getByText("Voicemail").nextElementSibling?.textContent).toBe(
      "3",
    );
  });

  it("explains the card with an info icon", () => {
    render(<MissedCallsCard totals={totals} />);
    const button = screen.getByRole("button", { name: "About Missed calls" });
    expect(
      document.getElementById(button.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe(HELP.missedCalls);
  });

  it("agrees with the rate: missed + voicemail = rate × calls", () => {
    expect(totals.missed! + totals.voicemail!).toBe(
      totals.unanswered_rate! * totals.calls!,
    );
  });

  it("shows dashes when there are no calls", () => {
    render(
      <MissedCallsCard
        totals={{
          ...totals,
          missed: null,
          voicemail: null,
          unanswered_rate: null,
        }}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
