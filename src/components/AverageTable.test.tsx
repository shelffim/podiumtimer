import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { toSegmentResult } from "@/lib/timer";
import { AverageTable } from "./AverageTable";

afterEach(cleanup);

describe("AverageTable", () => {
  it("shows average headers, rounded durations and verdicts with color only in difference cells", () => {
    const rows = [
      toSegmentResult({ name: "도입", plannedMs: 60_000, actualMs: 72_500 }),
      toSegmentResult({ name: "본론", plannedMs: 120_000, actualMs: 112_000 }),
      toSegmentResult({ name: "결론", plannedMs: 30_000, actualMs: 30_500 }),
    ];
    render(<AverageTable rows={rows} />);
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["구간", "계획", "평균 실제", "평균 차이"]);
    const expected = [["도입", "1:00", "1:13", "0:13 늦음"], ["본론", "2:00", "1:52", "0:08 빠름"], ["결론", "0:30", "0:31", "정시"]];
    screen.getAllByRole("row").slice(1).forEach((row, index) => {
      const cells = within(row).getAllByRole("cell");
      expect(cells.map((cell) => cell.textContent)).toEqual(expected[index]);
      cells.slice(1).forEach((cell) => expect(cell).toHaveClass("tabular-nums"));
      cells.slice(0, 3).forEach((cell) => expect(cell.className).not.toMatch(/text-(?:red|blue|green)-/));
      expect(cells[3]).toHaveClass(["text-red-400", "text-blue-400", "text-neutral-300"][index]);
    });
  });

  it("keeps the headers for an empty set of rows", () => {
    render(<AverageTable rows={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
