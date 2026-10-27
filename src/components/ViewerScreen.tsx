"use client";

import { useEffect, useState } from "react";
import { errorMessage, MESSAGES, progressLabel, viewerFullLabel } from "@/lib/messages";
import { buildResult, computeTimer } from "@/lib/timer";
import { nicknameSchema, sanitizeNickname } from "@/lib/validation";
import { api, device } from "@/services/api";
import type { ShareView } from "@/types/share";
import { ResultTable } from "./ResultTable";
import { SegmentList } from "./SegmentList";
import { TimerFace } from "./TimerFace";
import { useNow } from "./useNow";
import { useShareViewer } from "./useShareViewer";

const copy = MESSAGES.viewer;
const column = "mx-auto flex h-dvh w-full max-w-xl flex-col gap-4 overflow-hidden px-4 pt-8 pb-16";
type Entry = { code: string; share: ShareView; offset: number; nickname: string | null; draft: string };

export function ViewerScreen({ code }: { code: string }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const current = entry?.code === code ? entry : null;
  const viewer = useShareViewer({ code, nickname: current?.nickname ?? null, offset: current?.offset ?? 0 });
  const share = viewer.share;
  const now = useNow(current?.offset ?? 0, current?.nickname !== null && share?.state.status === "running");

  useEffect(() => {
    let active = true;
    Promise.all([api.getServerOffset(), api.getShare(code)]).then(([offset, result]) => {
      if (!active) return;
      if (!result.ok) {
        setLoadError({ code, message: result.code === "NOT_FOUND" ? copy.notFound : errorMessage(result.code) });
        return;
      }
      const draft = device.loadNickname() ?? "";
      const parsed = nicknameSchema.safeParse(draft);
      const nickname = device.hasJoined(code) && parsed.success ? parsed.data : null;
      setLoadError(null);
      setNicknameError(null);
      setEntry({ code, share: result.data, offset, nickname, draft });
    }).catch(() => { if (active) setLoadError({ code, message: MESSAGES.appError.title }); });
    return () => { active = false; };
  }, [code]);

  function enter() {
    if (!current) return;
    const parsed = nicknameSchema.safeParse(sanitizeNickname(current.draft));
    if (!parsed.success) { setNicknameError(parsed.error.issues[0].message); return; }
    device.saveNickname(parsed.data);
    device.markJoined(code);
    setNicknameError(null);
    setEntry({ ...current, nickname: parsed.data });
  }

  const disconnected = viewer.disconnected
    ? <span role="status" className="absolute top-3 right-4 text-xs text-neutral-400">{copy.disconnected}</span>
    : null;
  if (loadError?.code === code) return <main className={column}><p role="alert">{loadError.message}</p></main>;
  if (!current) return <main className={column}><p role="status">{MESSAGES.timers.loading}</p></main>;
  if (current.nickname === null) return <main className={column}>
    <h1 className="text-2xl font-semibold text-neutral-50 break-words">{current.share.timerName}</h1>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); enter(); }}>
      <div className="space-y-2">
        <label htmlFor="viewer-nickname" className="block text-xs text-neutral-400">{copy.nickname}</label>
        <input id="viewer-nickname" value={current.draft}
          onChange={(event) => { setEntry({ ...current, draft: event.target.value }); setNicknameError(null); }}
          aria-invalid={nicknameError !== null} aria-describedby={nicknameError ? "viewer-nickname-error" : undefined}
          className="h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400" />
        {nicknameError ? <p id="viewer-nickname-error" role="alert" className="text-sm text-red-400">{nicknameError}</p> : null}
      </div>
      <button type="submit" className="h-11 w-full rounded-md bg-neutral-50 px-4 font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">{copy.enter}</button>
    </form>
  </main>;
  if (viewer.status === "not_found") return <main className={column}><p role="alert">{copy.notFound}</p></main>;
  if (viewer.status === "full" && share) return <main className={column}><p role="alert">{viewerFullLabel(share.seatCap)}</p></main>;
  if (!share) return <main className={`relative ${column}`}>{disconnected}<p role="status">{MESSAGES.timers.loading}</p></main>;
  if (share.state.status === "running") {
    const view = computeTimer(share.segments, share.state, now);
    return <main className="relative flex h-dvh touch-manipulation flex-col overflow-hidden select-none">
      {disconnected}
      <header className="shrink-0 px-4 pt-3 text-center text-sm tabular-nums text-neutral-400">{progressLabel(view.segmentIndex, share.segments.length)}</header>
      <div className="flex min-h-0 flex-1 items-center px-4 pb-16"><TimerFace segments={share.segments} view={view} /></div>
    </main>;
  }
  return <main className={`relative ${column}`}>
    {disconnected}
    <h1 className="text-2xl font-semibold text-neutral-50 break-words">{share.timerName}</h1>
    {share.state.status === "idle" ? <>
      <SegmentList segments={share.segments} />
      <p className="text-sm text-neutral-300">{copy.waiting}</p>
    </> : share.state.status === "finished"
      ? <ResultTable results={buildResult(share.segments, share.state)} />
      : <p className="text-sm text-neutral-300">{copy.aborted}</p>}
  </main>;
}
