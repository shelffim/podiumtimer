"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { errorMessage, MESSAGES, progressLabel } from "@/lib/messages";
import { buildResult, computeTimer, createIdleRun, isStaleRun, reduceRun } from "@/lib/timer";
import { api, device } from "@/services/api";
import type { LocalRun, RunAction } from "@/types/run";
import type { Timer } from "@/types/timer";
import { ResultTable } from "./ResultTable";
import { SegmentList } from "./SegmentList";
import { TimerFace } from "./TimerFace";
import { useAdvanceInput } from "./useAdvanceInput";
import { useNow } from "./useNow";
import { useWakeLock } from "./useWakeLock";

const copy = MESSAGES.run;
const button = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:text-neutral-500";
const primary = `${button} bg-neutral-50 font-medium text-neutral-950 hover:bg-neutral-200`;
const secondary = `${button} border border-neutral-700 text-neutral-100 hover:bg-neutral-900`;
const column = "mx-auto min-h-dvh max-w-xl space-y-8 px-4 pt-8 pb-20";
type Loaded = { timer: Timer; local: LocalRun; offset: number };

export function RunScreen({ timerId }: { timerId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [finishHint, setFinishHint] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [restarting, setRestarting] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintUntil = useRef(0);
  const saving = useRef(false);
  const restartPending = useRef(false);
  const generation = useRef(0);
  const running = loaded?.timer.id === timerId && loaded.local.run.status === "running";
  const now = useNow(loaded?.offset ?? 0, running);
  useWakeLock(running);

  useEffect(() => {
    let active = true;
    Promise.all([api.getTimer(timerId), api.getServerOffset()]).then(([result, offset]) => {
      if (!active) return;
      if (!result.ok) {
        setLoadError(result.code === "NOT_FOUND" ? MESSAGES.timers.notFound : errorMessage(result.code));
        return;
      }
      let local = device.loadRun(timerId);
      if (local && isStaleRun(local.run, Date.now() + offset)) {
        device.clearRun(timerId);
        local = null;
      }
      if (!local || local.run.status === "idle") {
        local = { segments: result.data.segments, run: local?.run ?? createIdleRun(), shareCode: local?.shareCode ?? null };
      }
      setLoaded({ timer: result.data, local, offset });
    }).catch(() => { if (active) setLoadError(MESSAGES.appError.title); });
    return () => {
      active = false;
      generation.current += 1;
      if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    };
  }, [timerId]);

  function clearHint() {
    if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    hintTimer.current = null;
    hintUntil.current = 0;
    setFinishHint(false);
  }

  // Step 9 can observe these persisted transitions to synchronize the share.
  function persist(local: LocalRun) {
    if (!loaded) return;
    device.saveRun(timerId, local);
    setLoaded({ ...loaded, local });
  }

  async function saveRecord(local: LocalRun) {
    if (saving.current || local.run.startedAt === null) return;
    saving.current = true;
    const currentGeneration = generation.current;
    setSaveStatus("saving");
    try {
      const result = await api.saveRecord(timerId, local.run.startedAt, buildResult(local.segments, local.run));
      if (generation.current === currentGeneration) setSaveStatus(result.ok ? "saved" : "failed");
    } catch {
      if (generation.current === currentGeneration) setSaveStatus("failed");
    } finally {
      saving.current = false;
    }
  }

  function transition(type: RunAction["type"]) {
    if (!loaded) return;
    const segments = type === "start" ? loaded.timer.segments.map((segment) => ({ ...segment })) : loaded.local.segments;
    const run = reduceRun(loaded.local.run, { type, at: Date.now() + loaded.offset }, segments.length);
    if (!run) return;
    clearHint();
    const local = { ...loaded.local, segments, run };
    persist(local);
    if (type === "next" && run.status === "finished") void saveRecord(local);
  }

  useAdvanceInput({
    enabled: running,
    targetRef,
    onAdvance() {
      if (!loaded) return;
      const view = computeTimer(loaded.local.segments, loaded.local.run, Date.now() + loaded.offset);
      if (view.segmentIndex === loaded.local.segments.length - 1 && Date.now() >= hintUntil.current) {
        clearHint();
        hintUntil.current = Date.now() + 3_000;
        setFinishHint(true);
        hintTimer.current = setTimeout(clearHint, 3_000);
        return;
      }
      transition("next");
    },
  });

  async function restart() {
    if (restartPending.current) return;
    restartPending.current = true;
    setRestarting(true);
    setActionError(null);
    const currentGeneration = ++generation.current;
    try {
      const result = await api.getTimer(timerId);
      if (generation.current !== currentGeneration) return;
      if (!result.ok) {
        setActionError(result.code === "NOT_FOUND" ? MESSAGES.timers.notFound : errorMessage(result.code));
        return;
      }
      const local = { segments: result.data.segments, run: createIdleRun(), shareCode: null };
      device.saveRun(timerId, local);
      setLoaded({ timer: result.data, local, offset: loaded?.offset ?? 0 });
      clearHint();
      setSaveStatus("idle");
    } catch {
      if (generation.current === currentGeneration) setActionError(MESSAGES.appError.title);
    } finally {
      restartPending.current = false;
      if (generation.current === currentGeneration) setRestarting(false);
    }
  }

  if (loadError) return <main className={column}>
    <p role="alert">{loadError}</p>
    <Link href="/timers" className={secondary}>{MESSAGES.timers.backToList}</Link>
  </main>;
  if (!loaded || loaded.timer.id !== timerId) return <main className={column}><p role="status">{MESSAGES.timers.loading}</p></main>;

  const { timer, local } = loaded;
  const { segments, run } = local;
  if (run.status === "running") {
    const view = computeTimer(segments, run, now);
    return <main className="flex h-dvh touch-manipulation flex-col overflow-hidden select-none">
      <header data-no-advance className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
        <button type="button" className={secondary} disabled={run.transitions.length === 0} onClick={() => transition("undo")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12" /></svg>
          {copy.undo}
        </button>
        <span className="text-sm tabular-nums text-neutral-400">{progressLabel(view.segmentIndex, segments.length)}</span>
        <button type="button" className={`${button} border border-red-500/40 text-red-400 hover:bg-red-500/10`} onClick={() => { if (window.confirm(copy.abortConfirm)) transition("abort"); }}>{copy.abort}</button>
      </header>
      <div ref={targetRef} className="flex min-h-0 flex-1 items-center px-4 pb-16">
        <TimerFace segments={segments} view={view} finishHint={finishHint} />
      </div>
    </main>;
  }

  return <main className={column}>
    <h1 className="text-2xl font-semibold text-neutral-50">{timer.name}</h1>
    {actionError ? <p role="alert" className="text-sm text-red-400">{actionError}</p> : null}
    {run.status === "idle" ? <>
      <SegmentList segments={timer.segments} />
      {timer.segments.length > 0
        ? <button type="button" className={`${primary} w-full`} onClick={() => transition("start")}>{MESSAGES.timers.start}</button>
        : <p className="text-sm text-neutral-300">{copy.noSegments}</p>}
      <div className="flex flex-wrap gap-3">
        <Link href={`/timers/${timerId}`} className={secondary}>{MESSAGES.timers.edit}</Link>
        <Link href={`/timers/${timerId}/records`} className={secondary}>{MESSAGES.timers.records}</Link>
      </div>
    </> : <>
      {run.status === "finished" ? <>
        <ResultTable results={buildResult(segments, run)} />
        {saveStatus === "saved" ? <p role="status" className="text-xs text-neutral-400">{copy.saved}</p> : null}
        {saveStatus === "failed" ? <div className="space-y-3">
          <p role="alert" className="text-sm text-red-400">{copy.saveFailed}</p>
          <button type="button" className={secondary} onClick={() => void saveRecord(local)}>{copy.retrySave}</button>
        </div> : null}
      </> : <p>{copy.aborted}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={primary} disabled={restarting || saveStatus === "saving"} onClick={() => void restart()}>{copy.restart}</button>
        {run.status === "finished" ? <Link href={`/timers/${timerId}/records`} className={secondary}>{copy.records}</Link> : null}
      </div>
    </>}
  </main>;
}
