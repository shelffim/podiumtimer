import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { toSegmentResult } from "@/lib/timer";
import { AverageDiffChart } from "./AverageDiffChart";

afterEach(cleanup);
const average = (name: string, diffMs: number) => toSegmentResult({ name, plannedMs: 60_000, actualMs: 60_000 + diffMs });

describe("AverageDiffChart", () => {
  it("puts late bars right in red and early bars left in blue, scaling the largest to 100% of a half", () => {
    render(<AverageDiffChart rows={[average("도입", 12_000), average("본론", -6_000), average("결론", 1_000)]} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("도입")).toBeInTheDocument();
    expect(within(rows[0]).getByText("0:12 늦음")).toBeInTheDocument();
    const late = rows[0].querySelector("[data-bar]")!;
    expect(late).toHaveClass("bg-red-400", "left-0");
    expect(late).toHaveStyle({ width: "100%" });
    expect(late.parentElement).toHaveClass("left-1/2", "w-1/2");
    const early = rows[1].querySelector("[data-bar]")!;
    expect(early).toHaveClass("bg-blue-400", "right-0");
    expect(early).toHaveStyle({ width: "50%" });
    expect(early.parentElement).toHaveClass("right-1/2", "w-1/2");
    expect(within(rows[1]).getByText("0:06 빠름")).toBeInTheDocument();
    expect(within(rows[2]).getByText("정시")).toBeInTheDocument();
    expect(rows[2].querySelector("[data-bar]")).toBeNull();
    rows.forEach((row) => expect(row.querySelector("[data-baseline]")).toHaveClass("left-1/2", "w-px"));
  });

  it("scales against the largest absolute difference even when it is early", () => {
    const { container } = render(<AverageDiffChart rows={[average("도입", 4_000), average("본론", -16_000)]} />);
    const bars = container.querySelectorAll("[data-bar]");
    expect(bars[0]).toHaveStyle({ width: "25%" });
    expect(bars[1]).toHaveStyle({ width: "100%" });
  });

  it("shows no bars for all zero differences", () => {
    const { container } = render(<AverageDiffChart rows={[average("도입", 0), average("본론", 0)]} />);
    expect(container.querySelectorAll("[data-bar]")).toHaveLength(0);
    expect(screen.getAllByText("정시")).toHaveLength(2);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
