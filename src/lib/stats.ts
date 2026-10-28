import type { AverageRow, RunRecord, Timer } from "@/types/timer";
import { verdictOf } from "./timer";

export function averageRecords(timer: Timer, records: RunRecord[]): AverageRow[] | null {
  const matching = records.filter((record) => record.segments.length === timer.segments.length
    && record.segments.every((segment, index) => segment.name === timer.segments[index].name));
  if (matching.length < 2) return null;

  return timer.segments.map((segment, index) => {
    const plannedMs = Math.round(matching.reduce((sum, record) => sum + record.segments[index].plannedMs, 0) / matching.length);
    const actualMs = Math.round(matching.reduce((sum, record) => sum + record.segments[index].actualMs, 0) / matching.length);
    const diffMs = actualMs - plannedMs;
    return { name: segment.name, plannedMs, actualMs, diffMs, verdict: verdictOf(diffMs) };
  });
}
