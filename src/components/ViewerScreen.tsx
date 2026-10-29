"use client";

import { useEffect, useState, type ReactNode } from "react";
import { errorMessage, MESSAGES, progressLabel, viewerFullLabel } from "@/lib/messages";
import { buildResult, computeTimer } from "@/lib/timer";
import { nicknameSchema, sanitizeNickname } from "@/lib/validation";
import { api, device } from "@/services/api";
import type { ShareView } from "@/types/share";
import { AppBar } from "./AppBar";
import { Footer } from "./Footer";
import { Icon, type IconName } from "./Icon";
import { ResultTable } from "./ResultTable";
import { SegmentOverview } from "./SegmentOverview";
import { TimerFace } from "./TimerFace";
import { useNow } from "./useNow";
import { useShareViewer } from "./useShareViewer";

const copy = MESSAGES.viewer;
type Entry = { code: string; share: ShareView; offset: number; nickname: string | null; draft: string };

export function ViewerScreen({ code, contactEmail }: { code: string; contactEmail?: string }) {
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
    ? <span role="status" className="chip text-soft"><Icon name="wifi-off" size={14} />{copy.disconnected}</span>
    : null;
  const shell = (content: ReactNode, mainClass = "") => <div className="flex min-h-dvh flex-col pb-12">
    <AppBar>{disconnected}{current?.nickname ? <span className="caption">{current.nickname}</span> : null}</AppBar>
    <main className={`page page-narrow ${mainClass}`}>{content}</main>
    <Footer contactEmail={contactEmail} />
  </div>;
  const notice = (icon: IconName, title: string, description?: string) => shell(<>
    <span className="plate size-14"><Icon name={icon} size={24} /></span>
    <div role="alert" className="flex flex-col gap-1.5">
      <h1 className="heading">{title}</h1>
      {description ? <p className="text-sm text-soft">{description}</p> : null}
    </div>
  </>, "items-center justify-center text-center");

  if (loadError?.code === code) return loadError.message === copy.notFound
    ? notice("link-off", copy.notFound, copy.notFoundHint)
    : notice("info", loadError.message);
  if (!current) return shell(<p role="status" className="text-sm text-soft">{MESSAGES.timers.loading}</p>);
  if (current.nickname === null) return shell(<>
    <div className="flex flex-col gap-1.5">
      <span className="caption">{copy.sharedTimer}</span>
      <h1 className="title">{current.share.timerName}</h1>
    </div>
    <form className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); enter(); }}>
      <div className="flex flex-col gap-2">
        <label htmlFor="viewer-nickname" className="label">{copy.nickname}</label>
        <input id="viewer-nickname" value={current.draft} placeholder={copy.nicknamePlaceholder}
          onChange={(event) => { setEntry({ ...current, draft: event.target.value }); setNicknameError(null); }}
          aria-invalid={nicknameError !== null} aria-describedby={nicknameError ? "viewer-nickname-error" : "viewer-nickname-hint"}
          className="field" />
        {nicknameError ? <p id="viewer-nickname-error" role="alert" className="text-[13px] text-red-400">{nicknameError}</p> : null}
        <p id="viewer-nickname-hint" className="caption">{copy.nicknameHint}</p>
      </div>
      <button type="submit" className="btn btn-primary btn-lg w-full">{copy.enter}</button>
    </form>
  </>, "justify-center");
  if (viewer.status === "not_found") return notice("link-off", copy.notFound, copy.notFoundHint);
  if (viewer.status === "full" && share) return notice("users", viewerFullLabel(share.seatCap), copy.fullHint);
  if (!share) return shell(<p role="status" className="text-sm text-soft">{MESSAGES.timers.loading}</p>);
  if (share.state.status === "running") {
    const view = computeTimer(share.segments, share.state, now);
    return <main className="relative flex h-dvh touch-manipulation flex-col overflow-hidden pb-12 select-none">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="chip tabular-nums">{progressLabel(view.segmentIndex, share.segments.length)}</span>
        <span className="flex-1" />
        {disconnected}
        <span className="caption">{current.nickname}</span>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col justify-center px-5 py-6">
        <TimerFace segments={share.segments} view={view} />
      </div>
    </main>;
  }
  if (share.state.status === "aborted") return notice("circle-stop", copy.aborted, copy.abortedHint);
  if (share.state.status === "finished") return shell(<>
    <div className="flex flex-col gap-1.5">
      <span className="caption">{share.timerName}</span>
      <h1 className="title">{MESSAGES.run.finished}</h1>
    </div>
    <div className="card"><ResultTable results={buildResult(share.segments, share.state)} /></div>
    <p className="caption">{copy.finishedHint}</p>
  </>);
  return shell(<>
    <div className="flex flex-col gap-1.5">
      <span className="caption">{copy.waitingRoom}</span>
      <h1 className="title">{share.timerName}</h1>
    </div>
    <div className="card items-center gap-3 p-8 text-center">
      <span aria-hidden="true" className="spinner" />
      <p className="text-sm">{copy.waiting}</p>
    </div>
    <SegmentOverview segments={share.segments} />
  </>);
}
