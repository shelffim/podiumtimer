import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Icon } from "./Icon";

afterEach(cleanup);

describe("Icon", () => {
  it("renders a decorative inline line icon in the current text color", () => {
    const { container } = render(<Icon name="undo" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });

  it("accepts a size and extra classes", () => {
    const { container } = render(<Icon name="check" size={14} className="text-soft" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "14");
    expect(svg).toHaveAttribute("height", "14");
    expect(svg).toHaveClass("shrink-0", "text-soft");
  });
});
