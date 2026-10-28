import type { RunAction, RunState, TimerView } from "@/types/run";
import type { Segment, SegmentResult, SegmentTime, Verdict } from "@/types/timer";

export const ON_TIME_TOLERANCE_MS = 1000;
export const STALE_RUN_MS = 12 * 60 * 60 * 1000;

export function createIdleRun(): RunState {
  return { status: "idle", startedAt: null, transitions: [], rev: 0 };
}

export function reduceRun(run: RunState, action: RunAction, segmentCount: number): RunState | null {
  if (action.type === "start") {
    if (run.status !== "idle" || segmentCount < 1) return null;
    return { status: "running", startedAt: action.at, transitions: [], rev: run.rev + 1 };
  }

  if (run.status !== "running") return null;

  switch (action.type) {
    case "next": {
      const transitions = [...run.transitions, action.at];
      return {
        ...run,
        status: transitions.length === segmentCount ? "finished" : "running",
        transitions,
        rev: run.rev + 1,
      };
    }
    case "undo":
      if (run.transitions.length === 0) return null;
      return { ...run, transitions: run.transitions.slice(0, -1), rev: run.rev + 1 };
    case "abort":
      return { ...run, status: "aborted", rev: run.rev + 1 };
  }
}

export function isStaleRun(run: RunState, nowMs: number): boolean {
  return run.status === "running" && run.startedAt !== null && nowMs - run.startedAt > STALE_RUN_MS;
}

export function computeTimer(segments: Segment[], run: RunState, nowMs: number): TimerView {
  const total = totalPlannedMs(segments);
  if (run.status === "idle" || segments.length === 0) {
    return {
      segmentIndex: 0,
      segmentRemainingMs: (segments[0]?.durationSec ?? 0) * 1000,
      totalRemainingMs: total,
      progressMs: 0,
      lastResult: null,
    };
  }

  const results = buildResult(segments, run);
  const startedAt = run.startedAt ?? 0;
  const lastTransition = run.transitions[run.transitions.length - 1] ?? startedAt;
  const isFinished = run.status === "finished";
  const segmentIndex = isFinished ? segments.length - 1 : run.transitions.length;
  const segmentStart = segmentIndex === 0 ? startedAt : run.transitions[segmentIndex - 1];
  const effectiveNow = isFinished || run.status === "aborted" ? lastTransition : nowMs;
  const elapsed = Math.max(0, effectiveNow - segmentStart);
  const planned = segments[segmentIndex].durationSec * 1000;

  return {
    segmentIndex,
    segmentRemainingMs: planned - elapsed,
    totalRemainingMs: total - Math.max(0, effectiveNow - startedAt),
    progressMs: isFinished
      ? total
      : totalPlannedMs(segments.slice(0, segmentIndex)) + Math.min(elapsed, planned),
    lastResult: results[results.length - 1] ?? null,
  };
}

export function buildResult(segments: Segment[], run: RunState): SegmentResult[] {
  if (run.status === "idle" || run.startedAt === null) return [];
  const startedAt = run.startedAt;
  return segments.slice(0, run.transitions.length).map((segment, index) => toSegmentResult({
    name: segment.name,
    plannedMs: segment.durationSec * 1000,
    actualMs: run.transitions[index] - (index === 0 ? startedAt : run.transitions[index - 1]),
  }));
}

export function toSegmentResult(time: SegmentTime): SegmentResult {
  const diffMs = time.actualMs - time.plannedMs;
  return { ...time, diffMs, verdict: verdictOf(diffMs) };
}

export function verdictOf(diffMs: number): Verdict {
  if (Math.abs(diffMs) <= ON_TIME_TOLERANCE_MS) return "on_time";
  return diffMs > 0 ? "late" : "early";
}

export function totalPlannedMs(segments: Segment[]): number {
  return segments.reduce((sum, segment) => sum + segment.durationSec * 1000, 0);
}

/** Maps computeTimer's planned progress to block-local display percentages. */
export function timelineLayout(segments: Segment[], segmentIndex: number, progressMs: number, done = false) {
  const total = totalPlannedMs(segments);
  let startMs = 0;
  return segments.map((segment, index) => {
    const plannedMs = totalPlannedMs([segment]);
    const completed = done || index < segmentIndex;
    const current = index === segmentIndex;
    const fillPercent = completed ? 100 : current
      ? Math.max(0, Math.min(100, (progressMs - startMs) / plannedMs * 100)) : 0;
    const markerPercent = done ? (index === segments.length - 1 ? 100 : null) : current ? fillPercent : null;
    startMs += plannedMs;
    return { widthPercent: plannedMs / total * 100, fillPercent, completed, markerPercent };
  });
}

function clockFromSeconds(seconds: number): string {
  const absolute = Math.abs(seconds);
  return `${seconds < 0 ? "-" : ""}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
}

export function formatClock(ms: number): string {
  return clockFromSeconds(Math.ceil(ms / 1000));
}

export function isOvertime(ms: number): boolean {
  return formatClock(ms).startsWith("-");
}

export function formatDuration(ms: number): string {
  return clockFromSeconds(Math.round(Math.abs(ms) / 1000));
}
