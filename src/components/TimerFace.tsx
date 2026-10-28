import { diffLabel, lastResultLabel, MESSAGES, nextSegmentLabel } from "@/lib/messages";
import { formatClock, isOvertime } from "@/lib/timer";
import type { TimerView } from "@/types/run";
import type { Segment } from "@/types/timer";
import { TimelineBar } from "./TimelineBar";

const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };

export function TimerFace({ segments, view }: { segments: Segment[]; view: TimerView }) {
  return (
    <div className="flex w-full flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="title">{segments[view.segmentIndex]?.name}</p>
        <p className="caption">{nextSegmentLabel(segments[view.segmentIndex + 1]?.name)}</p>
      </div>
      <p className={`text-[min(30vw,200px)] leading-none font-medium tracking-[-0.04em] tabular-nums md:text-[min(17vw,200px)] ${isOvertime(view.segmentRemainingMs) ? "text-red-400" : "text-neutral-50"}`}>
        {formatClock(view.segmentRemainingMs)}
      </p>
      <p className="min-h-[21px] text-sm text-white">
        {view.lastResult ? <>
          <span>{lastResultLabel(view.lastResult.name)}</span>{" "}
          <span className={`tabular-nums ${verdictColor[view.lastResult.verdict]}`}>{diffLabel(view.lastResult.diffMs)}</span>
        </> : <span className="text-soft">{MESSAGES.timerFace.firstSegment}</span>}
      </p>
      <div className="flex flex-col gap-3">
        <TimelineBar segments={segments} segmentIndex={view.segmentIndex} progressMs={view.progressMs} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-soft">{MESSAGES.timerFace.totalRemaining}</span>
          <span className={`text-lg tabular-nums ${isOvertime(view.totalRemainingMs) ? "text-red-400" : "text-white"}`}>{formatClock(view.totalRemainingMs)}</span>
        </div>
      </div>
    </div>
  );
}
