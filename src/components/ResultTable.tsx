import { diffLabel, MESSAGES } from "@/lib/messages";
import { formatDuration } from "@/lib/timer";
import type { SegmentResult } from "@/types/timer";

const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };
const copy = MESSAGES.results;

export function ResultTable({ results }: { results: SegmentResult[] }) {
  return (
    <table className="w-full table-fixed text-left text-sm text-neutral-300">
      <thead className="border-b border-neutral-800 text-xs text-neutral-400">
        <tr>
          <th scope="col" className="w-1/3 py-3 pr-2 font-medium">{copy.segment}</th>
          <th scope="col" className="py-3 text-right font-medium">{copy.planned}</th>
          <th scope="col" className="py-3 text-right font-medium">{copy.actual}</th>
          <th scope="col" className="py-3 text-right font-medium">{copy.difference}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800">
        {results.map((result, index) => (
          <tr key={index}>
            <td className="break-words py-3 pr-2">{result.name}</td>
            <td className="py-3 text-right tabular-nums">{formatDuration(result.plannedMs)}</td>
            <td className="py-3 text-right tabular-nums">{formatDuration(result.actualMs)}</td>
            <td className={`py-3 text-right tabular-nums ${verdictColor[result.verdict]}`}>{diffLabel(result.diffMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
