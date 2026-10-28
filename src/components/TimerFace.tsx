import { diffLabel, MESSAGES, nextSegmentLabel, totalRemainingLabel } from "@/lib/messages";
import { formatClock, isOvertime } from "@/lib/timer";
import type { TimerView } from "@/types/run";
import type { Segment } from "@/types/timer";
import { TimelineBar } from "./TimelineBar";

const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };

export function TimerFace({ segments, view, finishHint = false }: {
  segments: Segment[];
  view: TimerView;
  finishHint?: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <p className="text-xl font-medium text-neutral-50">{segments[view.segmentIndex]?.name}</p>
      <p className={`text-[clamp(5rem,28vw,12rem)] font-semibold tabular-nums leading-none ${isOvertime(view.segmentRemainingMs) ? "text-red-400" : "text-neutral-50"}`}>
        {formatClock(view.segmentRemainingMs)}
      </p>
      {finishHint ? <p className="text-base text-neutral-300">{MESSAGES.timerFace.finishHint}</p> : null}
      <TimelineBar segments={segments} segmentIndex={view.segmentIndex} progressMs={view.progressMs} />
      <p className={`text-3xl font-medium tabular-nums ${isOvertime(view.totalRemainingMs) ? "text-red-400" : "text-neutral-300"}`}>
        {totalRemainingLabel(view.totalRemainingMs)}
      </p>
      {view.lastResult ? (
        <p className={`text-base tabular-nums ${verdictColor[view.lastResult.verdict]}`}>
          {MESSAGES.timerFace.lastResult} {diffLabel(view.lastResult.diffMs)}
        </p>
      ) : null}
      <p className="text-base text-neutral-400">{nextSegmentLabel(segments[view.segmentIndex + 1]?.name)}</p>
    </div>
  );
}
