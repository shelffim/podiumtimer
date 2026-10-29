import { diffLabel, lastResultLabel, MESSAGES, nextSegmentLabel } from "@/lib/messages";
import { formatClock, isOvertime } from "@/lib/timer";
import type { TimerView } from "@/types/run";
import type { Segment } from "@/types/timer";
import { TimelineBar } from "./TimelineBar";
import { verdictTone } from "./verdictColor";

// compact는 랜딩 미리보기용이에요. 구성은 같고 크기만 줄여요.
export function TimerFace({ segments, view, compact = false }: { segments: Segment[]; view: TimerView; compact?: boolean }) {
  return (
    <div className={`flex w-full flex-col ${compact ? "gap-5" : "gap-7"}`}>
      <div className="flex flex-col gap-1.5">
        <p className={compact ? "heading" : "title"}>{segments[view.segmentIndex]?.name}</p>
        <p className="caption">{nextSegmentLabel(segments[view.segmentIndex + 1]?.name)}</p>
      </div>
      <p className={`leading-none font-medium tracking-[-0.04em] tabular-nums ${compact ? "text-[min(24vw,104px)] lg:text-[120px]" : "text-[min(30vw,200px)] md:text-[min(17vw,200px)]"} ${isOvertime(view.segmentRemainingMs) ? "text-red-400" : "text-neutral-50"}`}>
        {formatClock(view.segmentRemainingMs)}
      </p>
      {/* 구간이 바뀔 때 직전 구간 결과 한 줄만 읽어 줘요. 매초 바뀌는 숫자는 읽지 않아요. */}
      <p aria-live="polite" className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${compact ? "min-h-7 text-sm" : "min-h-9 text-base md:min-h-10 md:text-lg"}`}>
        {view.lastResult ? <>
          <span className="text-soft">{lastResultLabel(view.lastResult.name)}</span>
          <span key={diffLabel(view.lastResult.diffMs)} className={`verdict tabular-nums ${compact ? "motion-safe:animate-demo-verdict" : "verdict-lg"} ${verdictTone[view.lastResult.verdict]}`}>{diffLabel(view.lastResult.diffMs)}</span>
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
