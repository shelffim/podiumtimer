import { DEMO_RESULTS } from "@/lib/demo";
import { diffLabel, MESSAGES } from "@/lib/messages";
import { formatClock, resultTotals } from "@/lib/timer";
import { verdictColor, verdictFill, verdictTone } from "./verdictColor";

const copy = MESSAGES.landing;
const totals = resultTotals(DEMO_RESULTS);
const latestSegments = DEMO_RESULTS.filter((result) => result.verdict === "late")
  .toSorted((a, b) => b.diffMs - a.diffMs).slice(0, 2);
const rowLayout = "grid gap-5 md:grid-cols-[160px_minmax(0,1fr)] lg:grid-cols-[180px_minmax(0,1fr)]";
const barLayout = "grid grid-cols-[minmax(0,1fr)_100px] items-center gap-3";

export function PaceCompare() {
  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <div className="flex max-w-[760px] flex-col gap-4">
        <h2 className="display">{copy.comparison.title}</h2>
        <p className="text-pretty text-soft">{copy.comparison.description}</p>
      </div>
      <div className="card gap-7 md:p-8">
        <div className={rowLayout}>
          <div>
            <h3 className="label">{copy.comparison.standardName}</h3>
            <p className="caption mt-1">{copy.comparison.standardCaption}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div className={barLayout}>
              <div aria-hidden="true" className="flex h-4 gap-0.5 overflow-hidden rounded-full">
                <div data-planned-bar className="bg-[#4a4f57]" style={{ flexGrow: totals.plannedMs, flexBasis: 0 }} />
                <div data-overtime-bar className={verdictFill.late} style={{ flexGrow: totals.diffMs, flexBasis: 0 }} />
              </div>
              <span className={`text-right text-xl font-semibold tabular-nums ${verdictColor.late}`}>{formatClock(totals.plannedMs - totals.actualMs)}</span>
            </div>
            <p className="caption">{copy.overtimeNote(totals.diffMs / 1000)}</p>
          </div>
        </div>
        <div className={`${rowLayout} border-t border-line pt-7`}>
          <div>
            <h3 className="label">{MESSAGES.serviceName}</h3>
            <p className="caption mt-1">{copy.comparison.podiumCaption}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <div className={barLayout}>
              <div aria-hidden="true" className="flex h-4 gap-0.5 overflow-hidden rounded-full">
                {DEMO_RESULTS.map((result) => <div key={result.name} data-result-bar className={verdictFill[result.verdict]}
                  style={{ flexGrow: result.actualMs, flexBasis: 0 }} />)}
              </div>
              <span className={`verdict justify-self-end tabular-nums ${verdictTone[totals.verdict]}`}>{diffLabel(totals.diffMs)}</span>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              {DEMO_RESULTS.map((result) => <li key={result.name} className="flex min-w-0 flex-col items-start gap-2">
                <span className="flex items-center gap-2 text-sm text-soft">
                  <span data-dot aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${verdictFill[result.verdict]}`} />{result.name}
                </span>
                <span className={`verdict tabular-nums ${verdictTone[result.verdict]}`}>{diffLabel(result.diffMs)}</span>
              </li>)}
            </ul>
            <p className="text-sm text-soft">{copy.lateSegmentsNote(latestSegments)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
