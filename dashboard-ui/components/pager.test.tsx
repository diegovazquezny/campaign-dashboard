import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pager } from "./pager";

afterEach(cleanup);

const props = {
  label: "Items 1–25 of 60",
  ariaLabel: "Item pages",
  prevLabel: "Previous",
  nextLabel: "Next",
};

describe("Pager", () => {
  it("renders nothing for a single page", () => {
    render(<Pager {...props} page={1} pageCount={1} onChange={() => {}} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("is a labelled nav with a live range label", () => {
    render(<Pager {...props} page={1} pageCount={3} onChange={() => {}} />);
    expect(screen.getByRole("navigation", { name: "Item pages" })).toBeTruthy();
    expect(screen.getByText("Items 1–25 of 60").getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("calls onChange with the neighbouring page", () => {
    const onChange = vi.fn();
    render(<Pager {...props} page={2} pageCount={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onChange.mock.calls).toEqual([[1], [3]]);
  });

  it("ignores clicks on the disabled ends but keeps the buttons focusable", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Pager {...props} page={1} pageCount={3} onChange={onChange} />,
    );
    const prev = screen.getByRole("button", { name: "Previous" });
    fireEvent.click(prev);
    expect(prev.getAttribute("aria-disabled")).toBe("true");
    expect((prev as HTMLButtonElement).disabled).toBe(false);
    rerender(<Pager {...props} page={3} pageCount={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
