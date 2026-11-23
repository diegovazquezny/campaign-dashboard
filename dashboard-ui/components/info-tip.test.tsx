import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfoTip } from "./info-tip";

const TEXT = "Booked ÷ calls.";

function setup() {
  render(<InfoTip label="Booking rate" text={TEXT} />);
  return {
    button: screen.getByRole("button", { name: "About Booking rate" }),
    tip: () => screen.getByText(TEXT),
  };
}

const isOpen = (el: HTMLElement) => !el.classList.contains("hidden");

// Run the close delay.
const settle = () => act(() => void vi.advanceTimersByTime(200));

// jsdom has no layout; give the icon and the bubble sizes.
function mockLayout(
  button: HTMLElement,
  rect: Partial<DOMRect>,
  tip = [200, 40],
) {
  button.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 24,
      bottom: 24,
      width: 24,
      height: 24,
      ...rect,
    }) as DOMRect;
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => tip[0],
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => tip[1],
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.innerWidth = 1000;
  window.innerHeight = 800;
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  // @ts-expect-error restore jsdom's own getters
  delete HTMLElement.prototype.offsetWidth;
  // @ts-expect-error restore jsdom's own getters
  delete HTMLElement.prototype.offsetHeight;
});

describe("InfoTip", () => {
  it("keeps the text in the DOM, hidden, and wires aria", () => {
    const { button, tip } = setup();

    expect(isOpen(tip())).toBe(false);
    expect(tip().getAttribute("role")).toBe("tooltip");
    expect(button.getAttribute("aria-describedby")).toBe(tip().id);
  });

  it("opens on mouse hover and closes on leave", () => {
    const { button, tip } = setup();

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(isOpen(tip())).toBe(true);
    // the open bubble keeps the same id, so aria-describedby still resolves
    expect(button.getAttribute("aria-describedby")).toBe(tip().id);

    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    settle();
    expect(isOpen(tip())).toBe(false);
  });

  it("stays open while the mouse moves from the icon onto the bubble", () => {
    const { button, tip } = setup();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });

    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(50));
    fireEvent.pointerEnter(tip(), { pointerType: "mouse" });
    settle();
    expect(isOpen(tip())).toBe(true);

    fireEvent.pointerLeave(tip(), { pointerType: "mouse" });
    settle();
    expect(isOpen(tip())).toBe(false);
  });

  it("keeps the closed text out of the label (display: none, not screen-reader-only)", () => {
    const { tip } = setup();
    expect(tip().classList.contains("hidden")).toBe(true);
    expect(tip().classList.contains("sr-only")).toBe(false);
  });

  it("opens on keyboard focus and closes on blur", () => {
    const { button, tip } = setup();

    act(() => button.focus());
    expect(isOpen(tip())).toBe(true);

    act(() => button.blur());
    expect(isOpen(tip())).toBe(false);
  });

  it("toggles on tap", () => {
    const { button, tip } = setup();

    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.click(button);
    expect(isOpen(tip())).toBe(true);

    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.click(button);
    expect(isOpen(tip())).toBe(false);
  });

  it("a mouse click does not close a tip that hover opened", () => {
    const { button, tip } = setup();

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.click(button);
    expect(isOpen(tip())).toBe(true);
  });

  it("closes on Escape", () => {
    const { button, tip } = setup();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(isOpen(tip())).toBe(false);
  });

  it("closes on a press outside, but not on the tip itself", () => {
    const { button, tip } = setup();
    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.click(button);

    fireEvent.pointerDown(tip());
    expect(isOpen(tip())).toBe(true);

    fireEvent.pointerDown(document.body);
    expect(isOpen(tip())).toBe(false);
  });

  it("follows the icon on scroll and resize instead of closing", () => {
    const { button, tip } = setup();
    mockLayout(button, { left: 400, top: 300, right: 424, bottom: 324 });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(tip().style.top).toBe("252px");

    mockLayout(button, { left: 400, top: 200, right: 424, bottom: 224 });
    fireEvent.scroll(window);
    expect(isOpen(tip())).toBe(true);
    expect(tip().style.top).toBe("152px");

    mockLayout(button, { left: 100, top: 200, right: 124, bottom: 224 });
    fireEvent.resize(window);
    expect(isOpen(tip())).toBe(true);
    expect(tip().style.left).toBe("12px"); // 112 - 100
  });

  it("sits above the icon, centred", () => {
    const { button, tip } = setup();
    mockLayout(button, { left: 400, top: 300, right: 424, bottom: 324 });

    fireEvent.pointerEnter(button, { pointerType: "mouse" });

    expect(tip().style.top).toBe("252px"); // 300 - 40 - 8
    expect(tip().style.left).toBe("312px"); // 412 - 100
  });

  it("flips below when there is no room above", () => {
    const { button, tip } = setup();
    mockLayout(button, { left: 400, top: 10, right: 424, bottom: 34 });

    fireEvent.pointerEnter(button, { pointerType: "mouse" });

    expect(tip().style.top).toBe("42px"); // 34 + 8
  });

  it("stays inside the viewport at both edges", () => {
    const { button, tip } = setup();

    mockLayout(button, { left: 0, top: 300, right: 24, bottom: 324 });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(tip().style.left).toBe("8px");
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    settle();

    mockLayout(button, { left: 976, top: 300, right: 1000, bottom: 324 });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(tip().style.left).toBe("792px"); // 1000 - 200 - 8
  });
});
