import { diffLabel, MESSAGES } from "@/lib/messages";
import { formatDuration } from "@/lib/timer";
import type { AverageRow } from "@/types/timer";

const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };

export function AverageTable({ rows }: { rows: AverageRow[] }) {
  return (
    <table className="w-full table-fixed text-left text-sm text-neutral-300">
      <thead className="border-b border-neutral-800 text-xs text-neutral-400">
        <tr>
          <th scope="col" className="w-1/3 py-3 pr-2 font-medium">{MESSAGES.results.segment}</th>
          <th scope="col" className="py-3 text-right font-medium">{MESSAGES.results.planned}</th>
          <th scope="col" className="py-3 text-right font-medium">{MESSAGES.records.averageActual}</th>
          <th scope="col" className="py-3 text-right font-medium">{MESSAGES.records.averageDifference}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800">
        {rows.map((row, index) => (
          <tr key={index}>
            <td className="break-words py-3 pr-2">{row.name}</td>
            <td className="py-3 text-right tabular-nums">{formatDuration(row.plannedMs)}</td>
            <td className="py-3 text-right tabular-nums">{formatDuration(row.actualMs)}</td>
            <td className={`py-3 text-right tabular-nums ${verdictColor[row.verdict]}`}>{diffLabel(row.diffMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
