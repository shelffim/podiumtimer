"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkTimerLimit, LIMITS } from "@/lib/billing";
import { MESSAGES, errorMessage, planLabel, planLimitMessage, timerSummary } from "@/lib/messages";
import { totalPlannedMs } from "@/lib/timer";
import { api } from "@/services/api";
import type { PlanStatus } from "@/types/api";
import type { Timer } from "@/types/timer";
import { AppBar } from "./AppBar";
import { Icon } from "./Icon";
import { LimitNotice } from "./LimitNotice";
import { TimelineBar } from "./TimelineBar";

const copy = MESSAGES.timers;

export function TimerList() {
  const router = useRouter();
  const [data, setData] = useState<{ timers: Timer[]; status: PlanStatus } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([api.listTimers(), api.getPlanStatus()]).then(([timers, status]) => {
      if (!active) return;
      if ((!timers.ok && timers.code === "UNAUTHENTICATED") || (!status.ok && status.code === "UNAUTHENTICATED")) {
        router.replace("/");
        return;
      }
      if (!timers.ok) setError(errorMessage(timers.code));
      else if (!status.ok) setError(errorMessage(status.code));
      else setData({ timers: timers.data, status: status.data });
    }).catch(() => { if (active) setError(MESSAGES.appError.title); });
    return () => { active = false; };
  }, [router, attempt]);

  function retry() {
    setError(null);
    setAttempt((count) => count + 1);
  }

  function createTimer() {
    if (!data) return;
    const { plan, timerCount } = data.status;
    const code = checkTimerLimit({ plan, existingTimerCount: timerCount, segmentCount: 0, isNew: true });
    if (code === "PLAN_LIMIT_TIMERS" || code === "PLAN_LIMIT_SEGMENTS") setNotice(planLimitMessage(code, plan));
    else router.push("/timers/new");
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.signOut();
      router.replace("/");
    } catch {
      setError(MESSAGES.appError.title);
      setSigningOut(false);
    }
  }

  return <>
    <AppBar>
      {data && <>
        <span className="chip">{planLabel(data.status.plan, data.status.expiresAt)}</span>
        <Link href="/pricing?returnTo=/timers" className={`btn-text text-sm ${data.status.plan === "pass" ? "hidden sm:inline-flex" : ""}`}>{copy.buyPass}</Link>
        <button type="button" onClick={signOut} disabled={signingOut} aria-label={copy.signOut} title={copy.signOut} className="icon-btn">
          <Icon name="log-out" size={18} />
        </button>
      </>}
    </AppBar>
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title">{copy.title}</h1>
        {data && data.timers.length > 0 && <button type="button" className="btn btn-secondary" onClick={createTimer}>
          <Icon name="plus" size={18} />{copy.newTimer}
          {data.status.plan === "free" && <span className="font-medium text-soft tabular-nums">{data.status.timerCount}/{LIMITS.free.timers}</span>}
        </button>}
      </div>
      {error && <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-red-400">{error}</p>
        {!data && <button type="button" className="btn btn-secondary" onClick={retry}><Icon name="restart" size={18} />{MESSAGES.appError.retry}</button>}
      </div>}
      {!data && !error && <p className="text-sm text-soft">{copy.loading}</p>}
      {notice && <LimitNotice text={notice} pricingHref="/pricing?returnTo=/timers" />}
      {data && (data.timers.length === 0
        ? <div className="card items-start p-8">
          <span className="plate"><Icon name="clock" /></span>
          <div className="flex flex-col gap-1.5">
            <h2 className="heading">{copy.emptyTitle}</h2>
            <p className="text-sm text-soft">{copy.emptyDescription}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={createTimer}><Icon name="plus" size={18} />{copy.firstTimer}</button>
        </div>
        : <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.timers.map((timer) => <li key={timer.id} className="card">
            <div className="flex flex-col gap-1">
              <h2 className="heading">{timer.name}</h2>
              <p className="text-sm text-soft tabular-nums">{timerSummary(timer.segments.length, totalPlannedMs(timer.segments))}</p>
            </div>
            {timer.segments.length > 0 && <TimelineBar segments={timer.segments} segmentIndex={0} progressMs={0} done />}
            <div className="flex flex-wrap gap-2">
              <Link href={`/timers/${timer.id}/run`} className="btn btn-primary"><Icon name="play" size={18} />{copy.start}</Link>
              <Link href={`/timers/${timer.id}`} className="btn btn-secondary">{copy.edit}</Link>
              <Link href={`/timers/${timer.id}/records`} className="btn btn-secondary">{copy.records}</Link>
            </div>
          </li>)}
        </ul>)}
    </div>
  </>;
}
