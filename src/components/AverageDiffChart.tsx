import { diffLabel, MESSAGES } from "@/lib/messages";
import type { AverageRow } from "@/types/timer";
import { verdictColor } from "./verdictColor";

const grid = "grid grid-cols-[minmax(0,88px)_minmax(0,1fr)_64px] items-center gap-2.5 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)_80px]";

export function AverageDiffChart({ rows }: { rows: AverageRow[] }) {
  const maxDifference = Math.max(0, ...rows.map((row) => Math.abs(row.diffMs)));
  return (
    <div className="flex flex-col gap-2.5 text-[13px]">
      <ul aria-label={MESSAGES.records.averageChart} className="flex flex-col gap-2.5">
        {rows.map((row, index) => (
          <li key={index} className={grid}>
            <span className="truncate text-soft">{row.name}</span>
            <div aria-hidden="true" className="relative h-3.5">
              <div data-baseline className="absolute -inset-y-1 left-1/2 w-px bg-line" />
              {maxDifference > 0 && row.verdict !== "on_time" && (
                <div className={`absolute inset-y-0 w-1/2 ${row.verdict === "late" ? "left-1/2" : "right-1/2"}`}>
                  <div data-bar className={`absolute inset-y-0 rounded-sm ${row.verdict === "late" ? "left-0 bg-red-400" : "right-0 bg-blue-400"}`}
                    style={{ width: `${Math.abs(row.diffMs) / maxDifference * 100}%` }} />
                </div>
              )}
            </div>
            <span className={`text-right tabular-nums ${verdictColor[row.verdict]}`}>{diffLabel(row.diffMs)}</span>
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className={grid}>
        <span />
        <div className="flex justify-between">
          <span className="text-blue-400">{MESSAGES.records.earlier}</span>
          <span className="text-red-400">{MESSAGES.records.later}</span>
        </div>
        <span />
      </div>
    </div>
  );
}
