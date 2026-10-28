import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { computeTimer, createIdleRun, toSegmentResult } from "@/lib/timer";
import type { TimerView } from "@/types/run";
import { TimerFace } from "./TimerFace";

afterEach(cleanup);
const segments = [
  { id: "a", name: "찬성 입론", durationSec: 60 },
  { id: "b", name: "반대 입론", durationSec: 120 },
];
const view: TimerView = computeTimer(segments, createIdleRun(), 0);

describe("TimerFace", () => {
  it.each([[-5_000, "-0:05", "text-red-400"], [0, "0:00", "text-neutral-50"], [-999, "0:00", "text-neutral-50"], [59_001, "1:00", "text-neutral-50"]])(
    "renders remaining %i ms as %s with %s", (remaining, text, color) => {
      render(<TimerFace segments={segments} view={{ ...view, segmentRemainingMs: Number(remaining) }} />);
      expect(screen.getByText(String(text))).toHaveClass(String(color), "tabular-nums", "leading-none");
      if (color !== "text-red-400") expect(screen.getByText(String(text))).not.toHaveClass("text-red-400");
    },
  );

  it("shows the current name, next segment, timeline and total remaining without a first-segment result", () => {
    const { container } = render(<TimerFace segments={segments} view={view} />);
    expect(screen.getByText("찬성 입론")).toHaveClass("title");
    expect(screen.getByText("다음 · 반대 입론")).toHaveClass("caption");
    expect(screen.getByText("첫 구간")).toHaveClass("text-soft");
    expect(screen.getByText("전체 남은 시간")).toBeInTheDocument();
    expect(screen.getByText("3:00")).toHaveClass("tabular-nums");
    expect(screen.getByText("3:00")).not.toHaveClass("text-red-400");
    expect(container.querySelectorAll("[data-block]")).toHaveLength(2);
    expect(screen.queryByText("1 / 2")).not.toBeInTheDocument();
  });

  it.each([[12_000, "0:12 늦음", "text-red-400"], [-8_000, "0:08 빠름", "text-blue-400"], [1_000, "정시", "text-neutral-300"]] as const)(
    "colors only the verdict of the last result %i", (diff, text, color) => {
      const lastResult = toSegmentResult({ name: "찬성 입론", plannedMs: 60_000, actualMs: 60_000 + diff });
      render(<TimerFace segments={segments} view={{ ...view, segmentIndex: 1, lastResult }} />);
      expect(screen.getByText("직전 구간 · 찬성 입론")).not.toHaveClass(color);
      expect(screen.getByText(text)).toHaveClass(color, "tabular-nums");
      expect(screen.getByText("마지막 구간")).toBeInTheDocument();
    },
  );

  it("shows an overdue total in red", () => {
    render(<TimerFace segments={segments} view={{ ...view, totalRemainingMs: -80_000 }} />);
    expect(screen.getByText("-1:20")).toHaveClass("text-red-400");
  });
});
