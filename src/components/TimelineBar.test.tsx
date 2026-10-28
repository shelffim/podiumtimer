import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimelineBar } from "./TimelineBar";

afterEach(cleanup);
const segments = [
  { id: "a", name: "도입", durationSec: 10 },
  { id: "b", name: "긴 본론 이름", durationSec: 20 },
  { id: "c", name: "결론", durationSec: 10 },
];
const blocks = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>("[data-block]"));

describe("TimelineBar", () => {
  it("sizes unlabeled blocks by planned time and shades done, current and remaining blocks", () => {
    const { container } = render(<TimelineBar segments={segments} segmentIndex={1} progressMs={20_000} />);
    expect(container.firstElementChild).toHaveClass("flex", "w-full", "gap-[3px]");
    expect(blocks(container).map((block) => block.style.flexGrow)).toEqual(["25", "50", "25"]);
    expect(screen.queryByText("긴 본론 이름")).not.toBeInTheDocument();
    expect(blocks(container)[0]).toHaveClass("bg-[#4a4f57]");
    expect(blocks(container)[1]).toHaveClass("bg-[#6b717b]");
    expect(blocks(container)[2]).toHaveClass("bg-line");
    expect(container.querySelectorAll("[data-marker]")).toHaveLength(1);
    expect(blocks(container)[1].querySelector("[data-marker]")).toHaveStyle({ left: "50%" });
    expect(container.innerHTML).not.toMatch(/(?:red|blue|green)-|animate-|transition-/);
  });

  it("keeps the marker at the current block end during overtime, then moves on to the next block", () => {
    const { container, rerender } = render(<TimelineBar segments={segments} segmentIndex={1} progressMs={30_000} />);
    expect(container.querySelector("[data-marker]")).toHaveStyle({ left: "100%" });
    rerender(<TimelineBar segments={segments} segmentIndex={2} progressMs={30_000} />);
    expect(blocks(container)[2].querySelector("[data-marker]")).toHaveStyle({ left: "0%" });
    expect(container.querySelectorAll(".bg-\\[\\#4a4f57\\]")).toHaveLength(2);
  });

  it("shows every block as an overview without a marker when done", () => {
    const { container } = render(<TimelineBar segments={segments} segmentIndex={0} progressMs={0} done />);
    expect(blocks(container).every((block) => block.classList.contains("bg-[#4a4f57]"))).toBe(true);
    expect(container.querySelector("[data-marker]")).not.toBeInTheDocument();
  });

  it("handles an empty timeline without a marker", () => {
    const { container } = render(<TimelineBar segments={[]} segmentIndex={0} progressMs={0} />);
    expect(container.querySelector("[data-marker]")).not.toBeInTheDocument();
  });
});
