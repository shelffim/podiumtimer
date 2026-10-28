import { formatDuration, totalPlannedMs } from "@/lib/timer";
import type { Segment } from "@/types/timer";

export function SegmentList({ segments }: { segments: Segment[] }) {
  return (
    <ol className="flex w-full flex-col gap-1.5 text-sm">
      {segments.map((segment, index) => (
        <li key={segment.id} className="flex items-start justify-between gap-4">
          <span className="flex min-w-0 text-soft">
            <span className="w-6 shrink-0 tabular-nums">{index + 1}</span>
            <span className="min-w-0 break-words">{segment.name}</span>
          </span>
          <span className="shrink-0 text-white tabular-nums">{formatDuration(totalPlannedMs([segment]))}</span>
        </li>
      ))}
    </ol>
  );
}
