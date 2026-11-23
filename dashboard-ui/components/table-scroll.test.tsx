import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TableScroll } from "./table-scroll";

afterEach(cleanup);

describe("TableScroll", () => {
  it("is a labelled, keyboard-focusable region around its children", () => {
    render(
      <TableScroll label="Campaigns">
        <table>
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>,
    );
    const region = screen.getByRole("region", { name: "Campaigns" });
    // Without a tab stop, keyboard users cannot scroll a wide table sideways.
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.contains(screen.getByRole("table"))).toBe(true);
  });
});
