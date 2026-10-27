import { totalTimeLabel } from "@/lib/messages";
import { formatDuration, totalPlannedMs } from "@/lib/timer";
import type { Segment } from "@/types/timer";

export function SegmentList({ segments }: { segments: Segment[] }) {
  return (
    <ul className="w-full divide-y divide-neutral-800 text-sm text-neutral-300">
      {segments.map((segment) => (
        <li key={segment.id} className="flex items-start justify-between gap-4 py-3">
          <span className="min-w-0 break-words">{segment.name}</span>
          <span className="shrink-0 tabular-nums">{formatDuration(totalPlannedMs([segment]))}</span>
        </li>
      ))}
      <li className="py-3 text-right font-medium tabular-nums">{totalTimeLabel(totalPlannedMs(segments))}</li>
    </ul>
  );
}
