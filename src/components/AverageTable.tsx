import { diffLabel, MESSAGES } from "@/lib/messages";
import { formatDuration } from "@/lib/timer";
import type { AverageRow } from "@/types/timer";

const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };

export function AverageTable({ rows }: { rows: AverageRow[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col" className="w-1/3">{MESSAGES.results.segment}</th>
          <th scope="col">{MESSAGES.results.planned}</th>
          <th scope="col">{MESSAGES.records.averageActual}</th>
          <th scope="col">{MESSAGES.records.averageDifference}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td>{row.name}</td>
            <td className="tabular-nums text-soft">{formatDuration(row.plannedMs)}</td>
            <td className="tabular-nums">{formatDuration(row.actualMs)}</td>
            <td className={`tabular-nums ${verdictColor[row.verdict]}`}>{diffLabel(row.diffMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
