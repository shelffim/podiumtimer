import { DEMO_SEGMENTS, type DemoFrame } from "@/lib/demo";
import { MESSAGES, progressLabel } from "@/lib/messages";
import { computeTimer } from "@/lib/timer";
import { Icon } from "./Icon";
import { TimerFace } from "./TimerFace";

export function LandingPreview({ frame }: { frame: DemoFrame }) {
  const view = computeTimer(DEMO_SEGMENTS, frame.run, frame.nowMs);
  const copy = MESSAGES.run;

  return (
    <div aria-hidden="true" className="card relative w-full max-w-[540px] gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <span className="chip tabular-nums">{progressLabel(view.segmentIndex, DEMO_SEGMENTS.length)}</span>
        <span className="flex-1" />
        <span className="plate size-9"><Icon name="undo" size={16} /></span>
        <span className="plate size-9"><Icon name="square" size={13} /></span>
      </div>
      <div className="px-5 pt-6 pb-5">
        <TimerFace segments={DEMO_SEGMENTS} view={view} compact />
      </div>
      <div className="border-t border-line px-5 py-4">
        <p className="caption py-3 text-center pointer-fine:hidden">{copy.tapHint}</p>
        <div className="hidden items-center justify-center gap-4 pointer-fine:flex">
          <span className={`btn btn-primary ${frame.pressed ? "scale-95 bg-neutral-200" : ""}`}>
            {copy.next}<Icon name="arrow-right" />
          </span>
          <span className="caption">{copy.keyHint} <kbd className={`rounded-md border px-2 py-0.5 font-sans text-xs text-white ${frame.pressed ? "border-white" : "border-line"}`}>{copy.spaceKey}</kbd></span>
        </div>
      </div>
      {frame.pressed ? <span data-demo-tap className="pointer-events-none absolute top-[46%] left-[68%] size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/10 pointer-fine:hidden" /> : null}
    </div>
  );
}
