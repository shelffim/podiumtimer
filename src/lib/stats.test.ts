import { describe, expect, it } from "vitest";
import type { RunRecord, SegmentTime, Timer } from "@/types/timer";
import { averageRecords, matchingRecords } from "./stats";

const timer: Timer = { id: "timer", name: "발표", segments: [
  { id: "a", name: "도입", durationSec: 5 },
  { id: "b", name: "본론", durationSec: 10 },
] };
const record = (segments: SegmentTime[]): RunRecord => ({ id: "record", timerId: timer.id, startedAt: 0, segments });
const first = record([{ name: "도입", plannedMs: 5_000, actualMs: 7_001 }, { name: "본론", plannedMs: 10_000, actualMs: 8_000 }]);
const second = record([{ name: "도입", plannedMs: 5_001, actualMs: 7_001 }, { name: "본론", plannedMs: 12_000, actualMs: 10_000 }]);

describe("matchingRecords", () => {
  it("keeps only records with the timer's segment count and name order", () => {
    const renamed = record([{ name: "도입", plannedMs: 5_000, actualMs: 5_000 }, { name: "결론", plannedMs: 10_000, actualMs: 10_000 }]);
    const shorter = record([{ name: "도입", plannedMs: 5_000, actualMs: 5_000 }]);
    expect(matchingRecords(timer, [first, renamed, second, shorter])).toEqual([first, second]);
  });
});

describe("averageRecords", () => {
  it("requires at least two matching records", () => {
    expect(averageRecords(timer, [])).toBeNull();
    expect(averageRecords(timer, [first])).toBeNull();
  });

  it("averages recorded plans and actuals separately, rounds, then subtracts", () => {
    const records = [first, second];
    records.forEach((item) => {
      item.segments.forEach(Object.freeze);
      Object.freeze(item.segments);
      Object.freeze(item);
    });
    Object.freeze(records);
    expect(averageRecords(timer, records)).toEqual([
      { name: "도입", plannedMs: 5_001, actualMs: 7_001, diffMs: 2_000, verdict: "late" },
      { name: "본론", plannedMs: 11_000, actualMs: 9_000, diffMs: -2_000, verdict: "early" },
    ]);
  });

  it("ignores different counts, reordered names, renamed segments and whitespace differences", () => {
    const mismatches = [
      record(first.segments.slice(0, 1)),
      record([...first.segments].reverse()),
      record(first.segments.map((segment) => ({ ...segment, name: `${segment.name} ` }))),
      record(first.segments.map((segment) => ({ ...segment, name: "결론" }))),
    ];
    expect(averageRecords(timer, [first, ...mismatches])).toBeNull();
    expect(averageRecords(timer, [first, ...mismatches, second])).toEqual(averageRecords(timer, [first, second]));
  });

  it("keeps plan plus difference equal to actual and uses the shared verdict boundary", () => {
    const records = [0, 1].map(() => record(first.segments.map((segment) => ({ ...segment, actualMs: segment.plannedMs + 1_000 }))));
    for (const row of averageRecords(timer, records)!) {
      expect(row.plannedMs + row.diffMs).toBe(row.actualMs);
      expect(row.verdict).toBe("on_time");
    }
  });
});
