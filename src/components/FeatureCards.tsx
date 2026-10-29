import { DEMO_AVERAGE_COUNT, DEMO_AVERAGE_ROWS, DEMO_RESULTS, DEMO_SEGMENTS, type DemoFrame } from "@/lib/demo";
import { averageCaption, diffLabel, MESSAGES, seatCountLabel } from "@/lib/messages";
import { computeTimer, formatClock, isOvertime } from "@/lib/timer";
import { AverageDiffChart } from "./AverageDiffChart";
import { Icon, type IconName } from "./Icon";
import { TimelineBar } from "./TimelineBar";
import { verdictColor, verdictFill, verdictTone } from "./verdictColor";

const copy = MESSAGES.landing;
const featureIcons: IconName[] = ["gauge", "link", "chart"];
const panel = "flex min-h-[230px] flex-col justify-center rounded-[20px] bg-surface p-4";

export function FeatureCards({ frame }: { frame: DemoFrame }) {
  const view = computeTimer(DEMO_SEGMENTS, frame.run, frame.nowMs);
  const clock = formatClock(view.segmentRemainingMs);
  const clockTone = isOvertime(view.segmentRemainingMs) ? verdictColor.late : "text-white";

  const illustrations = [
    <div key="pace" aria-hidden="true" className={panel}>
      <ol className="relative flex flex-col gap-4 before:absolute before:inset-y-3 before:left-[5px] before:w-px before:bg-line">
        {DEMO_RESULTS.slice(0, 3).map((result) => <li key={result.name} className="relative flex items-center gap-3">
          <span className={`size-[11px] shrink-0 rounded-full ${verdictFill[result.verdict]}`} />
          <span className="min-w-0 flex-1 text-sm text-soft">{result.name}</span>
          <span className={`verdict tabular-nums ${verdictTone[result.verdict]}`}>{diffLabel(result.diffMs)}</span>
        </li>)}
        <li className="relative flex items-center gap-3">
          <span className="size-[11px] shrink-0 rounded-full border border-white bg-surface" />
          <span className="min-w-0 flex-1 text-sm">{DEMO_SEGMENTS[3].name}{MESSAGES.common.separator}{copy.inProgress}</span>
          <span className="text-sm tabular-nums">{formatClock(DEMO_SEGMENTS[3].durationSec * 1000)}</span>
        </li>
      </ol>
    </div>,
    <div key="share" aria-hidden="true" className={`${panel} gap-4`}>
      <div className="flex items-end justify-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex aspect-[16/10] flex-col justify-between gap-2 rounded-t-lg border-2 border-line p-2.5">
            <span className="truncate text-[10px] text-soft">{DEMO_SEGMENTS[view.segmentIndex].name}</span>
            <span className={`text-2xl leading-none font-medium tabular-nums ${clockTone}`}>{clock}</span>
            <TimelineBar segments={DEMO_SEGMENTS} segmentIndex={view.segmentIndex} progressMs={view.progressMs} />
          </div>
          <div className="-mx-1 h-1.5 rounded-b-md border-2 border-line" />
        </div>
        {copy.viewerNames.map((name) => <div key={name} className="flex aspect-[9/17] w-[19%] shrink-0 items-center justify-center rounded-lg border-2 border-line">
          <span className={`text-sm font-medium tabular-nums ${clockTone}`}>{clock}</span>
        </div>)}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <span className="chip">{MESSAGES.share.hostName}</span>
        {copy.viewerNames.map((name) => <span key={name} className="chip">{name}</span>)}
        <span className="chip tabular-nums"><Icon name="users" size={14} />{seatCountLabel(3, 3)}</span>
      </div>
    </div>,
    <div key="average" aria-hidden="true" className={`${panel} gap-4 [&_.grid]:grid-cols-[minmax(0,64px)_minmax(0,1fr)_64px]`}>
      <p className="caption">{averageCaption(DEMO_AVERAGE_COUNT)}</p>
      <AverageDiffChart rows={DEMO_AVERAGE_ROWS} />
    </div>,
  ];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <h2 className="display">{copy.featuresTitle}</h2>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {copy.features.map((feature, index) => <article key={feature.title} className="card min-w-0 gap-6">
          {illustrations[index]}
          <div className="flex items-start gap-3">
            <span className="plate"><Icon name={featureIcons[index]} /></span>
            <div className="flex flex-col gap-2">
              <h3 className="heading">{feature.title}</h3>
              <p className="text-sm text-soft">{feature.body}</p>
            </div>
          </div>
        </article>)}
      </div>
    </section>
  );
}
