import { diffLabel, MESSAGES } from "@/lib/messages";
import type { AverageRow } from "@/types/timer";

const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };

export function AverageDiffChart({ rows }: { rows: AverageRow[] }) {
  const maxDifference = Math.max(0, ...rows.map((row) => Math.abs(row.diffMs)));
  return (
    <ul aria-label={MESSAGES.records.averageChart} className="space-y-4">
      {rows.map((row, index) => (
        <li key={index} className="space-y-2">
          <div className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-neutral-300">{row.name}</span>
            <span className={`shrink-0 tabular-nums ${verdictColor[row.verdict]}`}>{diffLabel(row.diffMs)}</span>
          </div>
          <div aria-hidden="true" className="relative h-4">
            <div data-baseline className="absolute inset-y-0 left-1/2 w-px bg-neutral-600" />
            {maxDifference > 0 && row.verdict !== "on_time" && (
              <div className={`absolute inset-y-0 w-1/2 ${row.verdict === "late" ? "left-1/2" : "right-1/2"}`}>
                <div data-bar className={`absolute inset-y-1 ${row.verdict === "late" ? "left-0 bg-red-400" : "right-0 bg-blue-400"}`}
                  style={{ width: `${Math.abs(row.diffMs) / maxDifference * 100}%` }} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
