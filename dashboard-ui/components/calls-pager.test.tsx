import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/campaigns/a",
  useSearchParams: () => new URLSearchParams(search),
}));

import { CallsPager } from "./calls-pager";

afterEach(() => {
  cleanup();
  push.mockClear();
  search = "";
});

describe("CallsPager", () => {
  it("goes to the next page, keeping the filters", () => {
    search = "preset=last_30_days&location=loc1";
    render(<CallsPager page={1} pageCount={3} label="Calls 1–25 of 60" />);
    fireEvent.click(screen.getByRole("button", { name: "Next calls" }));
    expect(push).toHaveBeenCalledWith(
      "/campaigns/a?preset=last_30_days&location=loc1&page=2",
    );
  });

  it("drops the page param when going back to page 1", () => {
    search = "location=loc1&page=2";
    render(<CallsPager page={2} pageCount={3} label="Calls 26–50 of 60" />);
    fireEvent.click(screen.getByRole("button", { name: "Previous calls" }));
    expect(push).toHaveBeenCalledWith("/campaigns/a?location=loc1");
  });

  it("renders nothing for a single page", () => {
    render(<CallsPager page={1} pageCount={1} label="x" />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
