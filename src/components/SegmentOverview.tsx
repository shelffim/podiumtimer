import { segmentCountLabel, totalTimeLabel } from "@/lib/messages";
import { totalPlannedMs } from "@/lib/timer";
import type { Segment } from "@/types/timer";
import { SegmentList } from "./SegmentList";
import { TimelineBar } from "./TimelineBar";

// 시작 전(발표자)과 대기실(시청자)이 같은 모양으로 구간 구성을 보여줘요.
export function SegmentOverview({ segments }: { segments: Segment[] }) {
  return (
    <section className="card gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="label">{segmentCountLabel(segments.length)}</span>
        <span className="text-sm text-soft tabular-nums">{totalTimeLabel(totalPlannedMs(segments))}</span>
      </div>
      {segments.length > 0 ? <TimelineBar segments={segments} segmentIndex={0} progressMs={0} done /> : null}
      <SegmentList segments={segments} />
    </section>
  );
}
