"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { errorMessage, MESSAGES, progressLabel, resultSummaryLabel, savedLabel, seatCountLabel, segmentCountLabel, totalTimeLabel } from "@/lib/messages";
import { seatUsage } from "@/lib/seats";
import { buildResult, canResumeRun, computeTimer, createIdleRun, reduceRun, resultTotals, totalPlannedMs } from "@/lib/timer";
import { api, device } from "@/services/api";
import type { LocalRun, RunAction } from "@/types/run";
import type { Timer } from "@/types/timer";
import { AppBar } from "./AppBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { Footer } from "./Footer";
import { Icon } from "./Icon";
import { ResultTable } from "./ResultTable";
import { SegmentList } from "./SegmentList";
import { ShareHostPanel } from "./ShareHostPanel";
import { useShareHost } from "./useShareHost";
import { TimelineBar } from "./TimelineBar";
import { TimerFace } from "./TimerFace";
import { useAdvanceInput } from "./useAdvanceInput";
import { useNow } from "./useNow";
import { useWakeLock } from "./useWakeLock";

const copy = MESSAGES.run;
const idleRun = createIdleRun();
const noSegments: Timer["segments"] = [];
type Loaded = { timer: Timer; local: LocalRun; offset: number };

export function RunScreen({ timerId, contactEmail }: { timerId: string; contactEmail?: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [finishHint, setFinishHint] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [restarting, setRestarting] = useState(false);
  const [askAbort, setAskAbort] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintUntil = useRef(0);
  const saving = useRef(false);
  const restartPending = useRef(false);
  const generation = useRef(0);
  const createPending = useRef(false);
  const shareGeneration = useRef(0);
  const running = loaded?.timer.id === timerId && loaded.local.run.status === "running";
  const now = useNow(loaded?.offset ?? 0, running);
  useWakeLock(running);
  const share = useShareHost({
    code: loaded?.timer.id === timerId ? loaded.local.shareCode : null,
    run: loaded?.local.run ?? idleRun,
    segments: loaded?.local.segments ?? noSegments,
    offset: loaded?.offset ?? 0,
  });

  useEffect(() => {
    let active = true;
    Promise.all([api.getTimer(timerId), api.getServerOffset()]).then(([result, offset]) => {
      if (!active) return;
      if (!result.ok) {
        setLoadError(result.code === "NOT_FOUND" ? MESSAGES.timers.notFound : errorMessage(result.code));
        return;
      }
      let local = device.loadRun(timerId);
      if (local && !canResumeRun(local.run, Date.now() + offset)) {
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
      shareGeneration.current += 1;
      if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    };
  }, [timerId]);

  function clearHint() {
    if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    hintTimer.current = null;
    hintUntil.current = 0;
    setFinishHint(false);
  }

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
    shareGeneration.current += 1;
    clearHint();
    const local = { ...loaded.local, segments, run };
    persist(local);
    if (type === "next" && run.status === "finished") void saveRecord(local);
  }

  const advance = useAdvanceInput({
    enabled: running && !askAbort,
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

  async function createShare() {
    if (!loaded || loaded.local.run.status !== "idle" || loaded.local.shareCode || createPending.current) return;
    createPending.current = true;
    setActionError(null);
    const currentGeneration = shareGeneration.current;
    try {
      const result = await api.createShare(timerId);
      if (shareGeneration.current !== currentGeneration) return;
      if (!result.ok) { setActionError(errorMessage(result.code)); return; }
      persist({ ...loaded.local, shareCode: result.data.code });
    } catch {
      if (shareGeneration.current === currentGeneration) setActionError(MESSAGES.appError.title);
    } finally {
      createPending.current = false;
    }
  }

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

  const managed = (body: ReactNode, title?: string) => <div className="flex min-h-dvh flex-col pb-12">
    <AppBar back="/timers" title={title} />
    <main className="page page-narrow">{body}</main>
    <Footer contactEmail={contactEmail} />
  </div>;
  const errorAlert = actionError ? <p role="alert" className="text-sm text-red-400">{actionError}</p> : null;
  const restartButton = <button type="button" className="btn btn-primary" disabled={restarting || saveStatus === "saving"} onClick={() => void restart()}>
    <Icon name="restart" size={18} />{copy.restart}
  </button>;

  if (loadError) return managed(<>
    <p role="alert">{loadError}</p>
    <Link href="/timers" className="btn btn-secondary self-start">{MESSAGES.timers.backToList}</Link>
  </>);
  if (!loaded || loaded.timer.id !== timerId) return managed(<p role="status" className="text-sm text-soft">{MESSAGES.timers.loading}</p>);

  const { timer, local } = loaded;
  const { segments, run } = local;
  if (run.status === "running") {
    const view = computeTimer(segments, run, now);
    const usage = share.seatCap !== null ? seatUsage(share.members, share.seatCap) : null;
    return <main className="relative flex h-dvh touch-manipulation flex-col overflow-hidden select-none">
      <header data-no-advance className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="chip tabular-nums">{progressLabel(view.segmentIndex, segments.length)}</span>
        {local.shareCode && share.disconnected ? <span className="chip text-soft"><Icon name="wifi-off" size={14} />{MESSAGES.share.disconnected}</span> : null}
        {local.shareCode && !share.disconnected && usage && share.seatCap !== null ? <span className="chip font-medium tabular-nums">
          <Icon name="users" size={14} /><span className="sr-only">{MESSAGES.share.seats}</span>{seatCountLabel(usage.used, share.seatCap)}
        </span> : null}
        <span className="flex-1" />
        <button type="button" className="icon-btn" aria-label={copy.undo} title={copy.undo} disabled={run.transitions.length === 0} onClick={() => transition("undo")}>
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-btn" aria-label={copy.abort} title={copy.abort} onClick={() => setAskAbort(true)}>
          <Icon name="square" size={16} />
        </button>
      </header>
      <div ref={targetRef} className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col justify-center px-5 py-6">
          <TimerFace segments={segments} view={view} />
        </div>
        <div className="mx-auto w-full max-w-[1100px] px-5 pb-12">
          <p className="caption py-3 text-center pointer-fine:hidden">{copy.tapHint}</p>
          <div className="hidden items-center justify-center gap-4 pointer-fine:flex">
            <button type="button" className="btn btn-primary btn-lg min-w-60" onClick={advance}>
              {view.segmentIndex === segments.length - 1 ? copy.finish : copy.next}<Icon name="arrow-right" />
            </button>
            <span className="caption">{copy.keyHint} <kbd className="rounded-md border border-line px-2 py-0.5 font-sans text-xs text-white">{copy.spaceKey}</kbd></span>
          </div>
        </div>
      </div>
      {finishHint ? <p role="status" className="pointer-events-none absolute bottom-30 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-5 py-3 font-semibold whitespace-nowrap text-ink">
        {MESSAGES.timerFace.finishHint}
      </p> : null}
      {askAbort ? <ConfirmDialog title={copy.abortConfirm} description={copy.abortDescription} confirmLabel={copy.abort}
        onCancel={() => setAskAbort(false)} onConfirm={() => { setAskAbort(false); transition("abort"); }} /> : null}
    </main>;
  }

  if (run.status === "idle") return managed(<>
    {errorAlert}
    <section className="card gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="label">{segmentCountLabel(timer.segments.length)}</span>
        <span className="text-sm text-soft tabular-nums">{totalTimeLabel(totalPlannedMs(timer.segments))}</span>
      </div>
      {timer.segments.length > 0 ? <TimelineBar segments={timer.segments} segmentIndex={0} progressMs={0} done /> : null}
      <SegmentList segments={timer.segments} />
    </section>
    <ShareHostPanel timerId={timerId} code={local.shareCode} seatCap={share.seatCap} members={share.members} onCreate={() => void createShare()} />
    {timer.segments.length > 0 ? <div className="flex flex-col gap-2.5">
      <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => transition("start")}><Icon name="play" />{MESSAGES.timers.start}</button>
      <p className="caption text-center">{copy.startHint}</p>
    </div> : <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-soft">{copy.noSegments}</p>
      <Link href={`/timers/${timerId}`} className="btn btn-secondary">{MESSAGES.timers.edit}</Link>
    </div>}
  </>, timer.name);

  if (run.status === "aborted") return managed(<>
    {errorAlert}
    <h2 className="title">{copy.aborted}</h2>
    <div>{restartButton}</div>
  </>, timer.name);

  const results = buildResult(segments, run);
  const totals = resultTotals(results);
  return managed(<>
    {errorAlert}
    <div className="flex flex-col gap-2">
      <h2 className="title">{copy.finished}</h2>
      {run.startedAt !== null ? <p className="text-sm text-soft">{resultSummaryLabel(run.startedAt, totals.plannedMs, totals.actualMs)}</p> : null}
    </div>
    <div className="card"><ResultTable results={results} /></div>
    {saveStatus === "saved" ? <p role="status" className="caption flex items-center gap-1">
      <Icon name="check" size={14} />{savedLabel(local.shareCode !== null)}
    </p> : null}
    {saveStatus === "failed" ? <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-sm text-red-400">{copy.saveFailed}</p>
      <button type="button" className="btn btn-secondary" onClick={() => void saveRecord(local)}>{copy.retrySave}</button>
    </div> : null}
    <div className="flex flex-wrap gap-2">
      {restartButton}
      <Link href={`/timers/${timerId}/records`} className="btn btn-secondary">{copy.records}</Link>
      <Link href={`/timers/${timerId}`} className="btn btn-secondary">{copy.editSegments}</Link>
    </div>
  </>, timer.name);
}
