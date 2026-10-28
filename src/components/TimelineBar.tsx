import { timelineLayout } from "@/lib/timer";
import type { Segment } from "@/types/timer";

export function TimelineBar({ segments, segmentIndex, progressMs, done = false }: {
  segments: Segment[];
  segmentIndex: number;
  progressMs: number;
  done?: boolean;
}) {
  const layout = timelineLayout(segments, segmentIndex, progressMs, done);
  return (
    <div className="flex w-full gap-[3px]">
      {segments.map((segment, index) => {
        const block = layout[index];
        const tone = block.completed ? "bg-[#4a4f57]" : index === segmentIndex ? "bg-[#6b717b]" : "bg-line";
        return (
          <div key={segment.id} data-block className={`relative h-2.5 min-w-[3px] rounded-sm ${tone}`} style={{ flexGrow: block.widthPercent, flexBasis: 0 }}>
            {!done && block.markerPercent !== null ? (
              <div aria-hidden="true" data-marker className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${block.markerPercent}%` }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
