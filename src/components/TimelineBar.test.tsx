import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimelineBar } from "./TimelineBar";

afterEach(cleanup);
const segments = [
  { id: "a", name: "도입", durationSec: 10 },
  { id: "b", name: "긴 본론 이름", durationSec: 20 },
  { id: "c", name: "결론", durationSec: 10 },
];

describe("TimelineBar", () => {
  it("sizes blocks proportionally with 2px gaps, labels and a half-filled current block", () => {
    const { container } = render(<TimelineBar segments={segments} segmentIndex={1} progressMs={20_000} />);
    const columns = Array.from(container.firstElementChild!.children);
    expect(container.firstElementChild).toHaveClass("flex", "w-full", "gap-0.5");
    expect(columns.map((column) => (column as HTMLElement).style.width)).toEqual(["25%", "50%", "25%"]);
    expect(screen.getByText("긴 본론 이름")).toHaveClass("truncate", "text-xs", "text-neutral-500");
    expect(columns[0].querySelector(".h-2")).toHaveClass("bg-neutral-500");
    expect(columns[1].querySelector(".h-2")).toHaveClass("bg-neutral-800");
    expect(columns[1].querySelector(".bg-neutral-50")).toHaveStyle({ width: "50%" });
    expect(columns[2].querySelector(".h-2")).toHaveClass("bg-neutral-800");
    expect(container.querySelectorAll("[data-marker]")).toHaveLength(1);
    expect(columns[1].querySelector("[data-marker]")).toHaveStyle({ left: "50%" });
    expect(container.innerHTML).not.toMatch(/(?:red|blue|green)-|animate-|transition-/);
  });

  it("keeps the dot at the current block end during overtime, then moves on to the next block", () => {
    const { container, rerender } = render(<TimelineBar segments={segments} segmentIndex={1} progressMs={30_000} />);
    expect(container.querySelector("[data-marker]")).toHaveStyle({ left: "100%" });
    expect(container.querySelector(".bg-neutral-50")).toHaveStyle({ width: "100%" });
    rerender(<TimelineBar segments={segments} segmentIndex={2} progressMs={30_000} />);
    expect(container.querySelector("[data-marker]")).toHaveStyle({ left: "0%" });
    expect(container.querySelectorAll(".bg-neutral-500")).toHaveLength(2);
  });

  it("shows all blocks completed and a single dot at the end when done", () => {
    const { container } = render(<TimelineBar segments={segments} segmentIndex={2} progressMs={40_000} done />);
    expect(container.querySelectorAll(".bg-neutral-500")).toHaveLength(3);
    expect(container.querySelector(".bg-neutral-50")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-marker]")).toHaveLength(1);
    expect(container.querySelector("[data-marker]")).toHaveStyle({ left: "100%" });
  });

  it("handles an empty timeline without a dot", () => {
    const { container } = render(<TimelineBar segments={[]} segmentIndex={0} progressMs={0} />);
    expect(container.querySelector("[data-marker]")).not.toBeInTheDocument();
  });
});
