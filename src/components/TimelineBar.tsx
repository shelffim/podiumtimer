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
    <div className="flex w-full gap-0.5">
      {segments.map((segment, index) => {
        const block = layout[index];
        return (
          <div key={segment.id} className="min-w-0" style={{ width: `${block.widthPercent}%` }}>
            <div className="mb-1 truncate text-left text-xs text-neutral-500">{segment.name}</div>
            <div className={`relative h-2 ${block.completed ? "bg-neutral-500" : "bg-neutral-800"}`}>
              {!block.completed && block.markerPercent !== null ? (
                <div className="h-full bg-neutral-50" style={{ width: `${block.fillPercent}%` }} />
              ) : null}
              {block.markerPercent !== null ? (
                <div aria-hidden="true" data-marker className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${block.markerPercent}%` }} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
