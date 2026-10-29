import { describe, expect, it } from "vitest";
import type { RunAction, RunState, RunStatus } from "@/types/run";
import type { Segment } from "@/types/timer";
import {
  ON_TIME_TOLERANCE_MS,
  STALE_RUN_MS,
  buildResult,
  computeTimer,
  createIdleRun,
  formatClock,
  formatDuration,
  isOvertime,
  timelineLayout,
  canResumeRun,
  isStaleRun,
  reduceRun,
  resultTotals,
  toSegmentResult,
  totalPlannedMs,
  verdictOf,
} from "./timer";

const segments: Segment[] = [
  { id: "a", name: "도입", durationSec: 10 },
  { id: "b", name: "본론", durationSec: 20 },
  { id: "c", name: "결론", durationSec: 5 },
];

function running(transitions: number[] = []): RunState {
  return { status: "running", startedAt: 1_000, transitions, rev: 4 };
}

describe("createIdleRun", () => {
  it("creates independent idle states", () => {
    const first = createIdleRun();
    const second = createIdleRun();
    expect(first).toEqual({ status: "idle", startedAt: null, transitions: [], rev: 0 });
    expect(first).not.toBe(second);
    expect(first.transitions).not.toBe(second.transitions);
  });
});

describe("reduceRun", () => {
  const statuses: RunStatus[] = ["idle", "running", "finished", "aborted"];
  const actions: RunAction["type"][] = ["start", "next", "undo", "abort"];

  it.each(statuses.flatMap((status) => actions.map((type) => ({ status, type }))))(
    "$status + $type follows the transition table without mutating inputs",
    ({ status, type }) => {
      const run: RunState = {
        status,
        startedAt: status === "idle" ? null : 1_000,
        transitions: status === "idle" ? [] : [12_000],
        rev: 7,
      };
      const action: RunAction = { type, at: 20_000 };
      const before = { ...run, transitions: [...run.transitions] };
      Object.freeze(run.transitions);
      Object.freeze(run);
      Object.freeze(action);

      const result = reduceRun(run, action, 3);
      const allowed = status === "idle" ? type === "start" : status === "running" && type !== "start";
      if (!allowed) {
        expect(result).toBeNull();
      } else {
        const expected = type === "start"
          ? { status: "running", startedAt: 20_000, transitions: [], rev: 8 }
          : {
              status: type === "abort" ? "aborted" : "running",
              startedAt: 1_000,
              transitions: type === "next" ? [12_000, 20_000] : type === "undo" ? [] : [12_000],
              rev: 8,
            };
        expect(result).toEqual(expected);
        expect(result).not.toBe(run);
      }
      expect(run).toEqual(before);
      expect(action).toEqual({ type, at: 20_000 });
    },
  );

  it("rejects starting without segments", () => {
    expect(reduceRun(createIdleRun(), { type: "start", at: 0 }, 0)).toBeNull();
  });

  it("rejects undo before any next", () => {
    expect(reduceRun(running(), { type: "undo", at: 2_000 }, 3)).toBeNull();
  });

  it("allows consecutive undo actions and increments rev each time", () => {
    const once = reduceRun(running([12_000, 30_000]), { type: "undo", at: 31_000 }, 3);
    expect(once).toEqual({ ...running([12_000]), rev: 5 });
    const twice = reduceRun(once!, { type: "undo", at: 32_000 }, 3);
    expect(twice).toEqual({ ...running(), rev: 6 });
    expect(reduceRun(twice!, { type: "undo", at: 33_000 }, 3)).toBeNull();
  });

  it.each([1, 3])("finishes on the final next with %i segments", (segmentCount) => {
    let run = reduceRun(createIdleRun(), { type: "start", at: 0 }, segmentCount)!;
    for (let i = 1; i <= segmentCount; i += 1) {
      run = reduceRun(run, { type: "next", at: i * 10_000 }, segmentCount)!;
      expect(run.status).toBe(i === segmentCount ? "finished" : "running");
      expect(run.rev).toBe(i + 1);
    }
    expect(run.transitions).toHaveLength(segmentCount);
    expect(reduceRun(run, { type: "next", at: 50_000 }, segmentCount)).toBeNull();
  });
});

describe("isStaleRun", () => {
  it("uses a strict twelve-hour boundary from the start, not the latest transition", () => {
    expect(STALE_RUN_MS).toBe(43_200_000);
    const run = running([43_200_000]);
    expect(isStaleRun(run, 1_000 + STALE_RUN_MS - 1)).toBe(false);
    expect(isStaleRun(run, 1_000 + STALE_RUN_MS)).toBe(false);
    expect(isStaleRun(run, 1_000 + STALE_RUN_MS + 1)).toBe(true);
  });

  it.each<RunStatus>(["idle", "finished", "aborted"])("never expires %s states", (status) => {
    expect(isStaleRun({ ...running(), status }, STALE_RUN_MS * 2)).toBe(false);
  });

  it("accepts an epoch-zero start and ignores a missing start", () => {
    expect(isStaleRun({ ...running(), startedAt: 0 }, STALE_RUN_MS + 1)).toBe(true);
    expect(isStaleRun({ ...running(), startedAt: null }, STALE_RUN_MS + 1)).toBe(false);
  });
});

describe("canResumeRun", () => {
  it.each<[RunStatus, boolean]>([["idle", true], ["running", true], ["finished", false], ["aborted", false]])(
    "resumes %s on reopen: %s", (status, expected) => {
      expect(canResumeRun({ ...running([2_000]), status }, 5_000)).toBe(expected);
    },
  );

  it("does not resume a running state older than twelve hours", () => {
    expect(canResumeRun(running(), 1_000 + STALE_RUN_MS)).toBe(true);
    expect(canResumeRun(running(), 1_000 + STALE_RUN_MS + 1)).toBe(false);
  });
});

describe("segment results", () => {
  it("sets the on-time tolerance to one second", () => {
    expect(ON_TIME_TOLERANCE_MS).toBe(1_000);
  });

  it.each([
    [-1_500, "early"], [-1_499, "on_time"], [-1_001, "on_time"], [0, "on_time"],
    [1_001, "on_time"], [1_499, "on_time"], [1_500, "late"],
  ] as const)("classifies a difference of %i ms by its displayed seconds as %s", (diffMs, verdict) => {
    expect(verdictOf(diffMs)).toBe(verdict);
    expect(toSegmentResult({ name: "도입", plannedMs: 10_000, actualMs: 10_000 + diffMs }))
      .toEqual({ name: "도입", plannedMs: 10_000, actualMs: 10_000 + diffMs, diffMs, verdict });
  });

  it("builds each actual duration from adjacent transitions, in segment order", () => {
    const run: RunState = { ...running([13_000, 31_000, 36_500]), status: "finished" };
    expect(buildResult(segments, run)).toEqual([
      { name: "도입", plannedMs: 10_000, actualMs: 12_000, diffMs: 2_000, verdict: "late" },
      { name: "본론", plannedMs: 20_000, actualMs: 18_000, diffMs: -2_000, verdict: "early" },
      { name: "결론", plannedMs: 5_000, actualMs: 5_500, diffMs: 500, verdict: "on_time" },
    ]);
  });

  it.each<RunStatus>(["running", "aborted"])("includes only completed segments when %s", (status) => {
    expect(buildResult(segments, { ...running([13_000]), status })).toEqual([
      { name: "도입", plannedMs: 10_000, actualMs: 12_000, diffMs: 2_000, verdict: "late" },
    ]);
  });

  it("returns no results for idle states or before the first next", () => {
    expect(buildResult(segments, createIdleRun())).toEqual([]);
    expect(buildResult(segments, running())).toEqual([]);
    expect(buildResult([], createIdleRun())).toEqual([]);
  });

  it("calculates the first actual duration with an epoch-zero start", () => {
    expect(buildResult(segments, { ...running([12_000]), startedAt: 0 })[0].actualMs).toBe(12_000);
  });
});

describe("resultTotals", () => {
  it("sums planned and actual times and judges the whole run with the shared boundary", () => {
    const results = [
      toSegmentResult({ name: "도입", plannedMs: 60_000, actualMs: 72_000 }),
      toSegmentResult({ name: "결론", plannedMs: 30_000, actualMs: 29_000 }),
    ];
    expect(resultTotals(results)).toEqual({ plannedMs: 90_000, actualMs: 101_000, diffMs: 11_000, verdict: "late" });
    expect(resultTotals([{ name: "도입", plannedMs: 60_000, actualMs: 61_000 }]).verdict).toBe("on_time");
    expect(resultTotals([{ name: "도입", plannedMs: 60_000, actualMs: 50_000 }]).verdict).toBe("early");
  });

  it("returns zero totals for no results", () => {
    expect(resultTotals([])).toEqual({ plannedMs: 0, actualMs: 0, diffMs: 0, verdict: "on_time" });
  });
});

describe("computeTimer", () => {
  it("shows the first segment and total plan when idle", () => {
    expect(computeTimer(segments, createIdleRun(), 999_999)).toEqual({
      segmentIndex: 0, segmentRemainingMs: 10_000, totalRemainingMs: 35_000,
      progressMs: 0, lastResult: null,
    });
    expect(computeTimer([], createIdleRun(), 999_999)).toEqual({
      segmentIndex: 0, segmentRemainingMs: 0, totalRemainingMs: 0,
      progressMs: 0, lastResult: null,
    });
  });

  it("computes the first running segment without a previous result", () => {
    expect(computeTimer(segments, running(), 5_000)).toEqual({
      segmentIndex: 0, segmentRemainingMs: 6_000, totalRemainingMs: 31_000,
      progressMs: 4_000, lastResult: null,
    });
  });

  it("uses the actual transition for elapsed time and the planned start for progress", () => {
    expect(computeTimer(segments, running([13_000]), 18_000)).toEqual({
      segmentIndex: 1, segmentRemainingMs: 15_000, totalRemainingMs: 18_000,
      progressMs: 15_000,
      lastResult: { name: "도입", plannedMs: 10_000, actualMs: 12_000, diffMs: 2_000, verdict: "late" },
    });
  });

  it("holds progress at the current block end while remaining time goes negative", () => {
    expect(computeTimer(segments, running([13_000]), 50_000)).toMatchObject({
      segmentIndex: 1, segmentRemainingMs: -17_000, totalRemainingMs: -14_000, progressMs: 30_000,
    });
    expect(computeTimer(segments, running(), 50_000).progressMs).toBe(10_000);
    expect(computeTimer(segments, running([13_000, 31_000]), 50_000).progressMs).toBe(35_000);
  });

  it("clamps negative elapsed time to zero", () => {
    expect(computeTimer(segments, running(), 0)).toMatchObject({
      segmentRemainingMs: 10_000, totalRemainingMs: 35_000, progressMs: 0,
    });
    expect(computeTimer(segments, running([13_000]), 12_000)).toMatchObject({
      segmentRemainingMs: 20_000, totalRemainingMs: 24_000, progressMs: 10_000,
    });
  });

  it("recomputes the previous segment and result after undo", () => {
    const run = reduceRun(running([13_000, 31_000]), { type: "undo", at: 32_000 }, 3)!;
    expect(computeTimer(segments, run, 32_000)).toMatchObject({
      segmentIndex: 1, segmentRemainingMs: 1_000, progressMs: 29_000,
      lastResult: { name: "도입", actualMs: 12_000 },
    });
  });

  it("freezes the finished view at the final transition", () => {
    const run: RunState = { ...running([13_000, 31_000, 38_000]), status: "finished" };
    const expected = {
      segmentIndex: 2, segmentRemainingMs: -2_000, totalRemainingMs: -2_000, progressMs: 35_000,
      lastResult: { name: "결론", plannedMs: 5_000, actualMs: 7_000, diffMs: 2_000, verdict: "late" },
    };
    expect(computeTimer(segments, run, 38_000)).toEqual(expected);
    expect(computeTimer(segments, run, 999_999)).toEqual(expected);
  });

  it("freezes a single-segment finish with positive remaining time", () => {
    const run: RunState = { ...running([8_000]), status: "finished" };
    expect(computeTimer(segments.slice(0, 1), run, 999_999)).toEqual({
      segmentIndex: 0, segmentRemainingMs: 3_000, totalRemainingMs: 3_000, progressMs: 10_000,
      lastResult: { name: "도입", plannedMs: 10_000, actualMs: 7_000, diffMs: -3_000, verdict: "early" },
    });
  });

  it("uses the latest transition or the start for an aborted view", () => {
    expect(computeTimer(segments, { ...running([13_000]), status: "aborted" }, 999_999)).toEqual({
      segmentIndex: 1, segmentRemainingMs: 20_000, totalRemainingMs: 23_000, progressMs: 10_000,
      lastResult: { name: "도입", plannedMs: 10_000, actualMs: 12_000, diffMs: 2_000, verdict: "late" },
    });
    expect(computeTimer(segments, { ...running(), status: "aborted" }, 999_999)).toEqual({
      segmentIndex: 0, segmentRemainingMs: 10_000, totalRemainingMs: 35_000, progressMs: 0, lastResult: null,
    });
    expect(() => computeTimer([], { ...createIdleRun(), status: "aborted" }, 0)).not.toThrow();
  });

  it("does not mutate segments or execution state", () => {
    const frozenSegments = segments.map((segment) => Object.freeze({ ...segment }));
    Object.freeze(frozenSegments);
    const run = running([13_000]);
    Object.freeze(run.transitions);
    Object.freeze(run);
    expect(computeTimer(frozenSegments, run, 18_000).progressMs).toBe(15_000);
    expect(buildResult(frozenSegments, run)).toHaveLength(1);
  });
});

describe("timelineLayout", () => {
  const blocks = [
    { id: "a", name: "도입", durationSec: 10 },
    { id: "b", name: "본론", durationSec: 20 },
    { id: "c", name: "결론", durationSec: 10 },
  ];

  it("converts the supplied progress to block proportions and one current-block dot", () => {
    expect(timelineLayout(blocks, 1, 20_000)).toEqual([
      { widthPercent: 25, fillPercent: 100, completed: true, markerPercent: null },
      { widthPercent: 50, fillPercent: 50, completed: false, markerPercent: 50 },
      { widthPercent: 25, fillPercent: 0, completed: false, markerPercent: null },
    ]);
  });

  it("clamps the current fill and dot to its block edges", () => {
    expect(timelineLayout(blocks, 1, 99_000)[1]).toMatchObject({ fillPercent: 100, markerPercent: 100 });
    expect(timelineLayout(blocks, 1, 0)[1]).toMatchObject({ fillPercent: 0, markerPercent: 0 });
  });

  it("marks all blocks completed when done and puts only one dot at the end", () => {
    const layout = timelineLayout(blocks, 2, 40_000, true);
    expect(layout.every((block) => block.completed && block.fillPercent === 100)).toBe(true);
    expect(layout.map((block) => block.markerPercent)).toEqual([null, null, 100]);
  });

  it("handles empty segments and a single segment", () => {
    expect(timelineLayout([], 0, 0)).toEqual([]);
    expect(timelineLayout(blocks.slice(0, 1), 0, 0)).toEqual([
      { widthPercent: 100, fillPercent: 0, completed: false, markerPercent: 0 },
    ]);
  });
});

describe("time formatting", () => {
  it("sums planned milliseconds, including an empty timer", () => {
    expect(totalPlannedMs(segments)).toBe(35_000);
    expect(totalPlannedMs([])).toBe(0);
  });

  it.each([
    [180_000, "3:00"], [179_001, "3:00"], [179_000, "2:59"],
    [1, "0:01"], [0, "0:00"], [-0, "0:00"], [-999, "0:00"],
    [-1_000, "-0:01"], [-65_000, "-1:05"], [7_500_000, "125:00"],
  ] as const)("formats %i ms as %s with ceiling seconds", (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
    expect(isOvertime(ms)).toBe(expected.startsWith("-"));
  });

  it.each([
    [12_400, "0:12"], [12_500, "0:13"], [-8_000, "0:08"], [1_001, "0:01"],
    [-12_500, "0:13"], [0, "0:00"], [59_500, "1:00"], [7_500_000, "125:00"],
  ] as const)("formats absolute duration %i ms as %s with rounded seconds", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});
