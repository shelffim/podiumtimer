import { diffLabel, MESSAGES } from "@/lib/messages";
import { formatDuration, resultTotals } from "@/lib/timer";
import type { SegmentResult } from "@/types/timer";

const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };
const copy = MESSAGES.results;

export function ResultTable({ results }: { results: SegmentResult[] }) {
  const totals = resultTotals(results);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col" className="w-1/3">{copy.segment}</th>
          <th scope="col">{copy.planned}</th>
          <th scope="col">{copy.actual}</th>
          <th scope="col">{copy.difference}</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result, index) => (
          <tr key={index}>
            <td>{result.name}</td>
            <td className="tabular-nums text-soft">{formatDuration(result.plannedMs)}</td>
            <td className="tabular-nums">{formatDuration(result.actualMs)}</td>
            <td className={`tabular-nums ${verdictColor[result.verdict]}`}>{diffLabel(result.diffMs)}</td>
          </tr>
        ))}
        {results.length > 0 && (
          <tr className="font-semibold [&>td]:border-b-0">
            <td>{copy.total}</td>
            <td className="tabular-nums text-soft">{formatDuration(totals.plannedMs)}</td>
            <td className="tabular-nums">{formatDuration(totals.actualMs)}</td>
            <td />
          </tr>
        )}
      </tbody>
    </table>
  );
}
