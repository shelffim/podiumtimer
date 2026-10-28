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

const copy = MESSAGES.timers;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";
const primary = `inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-50 px-4 font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 ${focus}`;
const textLink = `inline-flex min-h-11 min-w-11 items-center rounded-md text-sm text-neutral-400 hover:text-neutral-200 ${focus}`;

export function TimerList() {
  const router = useRouter();
  const [data, setData] = useState<{ timers: Timer[]; status: PlanStatus } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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
  }, [router]);

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

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-50">{copy.title}</h1>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-neutral-400">{copy.loading}</p>}
      {data && <>
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">{planLabel(data.status.plan, data.status.expiresAt)}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/pricing?returnTo=/timers" className={textLink}>{copy.buyPass}</Link>
            <button type="button" onClick={signOut} disabled={signingOut} className={textLink}>{copy.signOut}</button>
          </div>
          <button type="button" className={primary} onClick={createTimer}>
            {copy.newTimer}{data.status.plan === "free" && <span className="ml-2 tabular-nums">{data.status.timerCount}/{LIMITS.free.timers}</span>}
          </button>
        </div>
        {notice && <div role="status" className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">
          <p>{notice}</p>
          <Link href="/pricing?returnTo=/timers" className={textLink}>{copy.viewPass}</Link>
        </div>}
        {data.timers.length === 0
          ? <button type="button" className={primary} onClick={createTimer}>{copy.firstTimer}</button>
          : <ul className="divide-y divide-neutral-800">
            {data.timers.map((timer) => <li key={timer.id} className="space-y-3 py-4">
              <h2 className="break-words font-medium text-neutral-50">{timer.name}</h2>
              <p className="text-sm tabular-nums text-neutral-400">{timerSummary(timer.segments.length, totalPlannedMs(timer.segments))}</p>
              <div className="flex flex-wrap gap-4">
                <Link href={`/timers/${timer.id}/run`} className={textLink}>{copy.start}</Link>
                <Link href={`/timers/${timer.id}`} className={textLink}>{copy.edit}</Link>
                <Link href={`/timers/${timer.id}/records`} className={textLink}>{copy.records}</Link>
              </div>
            </li>)}
          </ul>}
      </>}
    </section>
  );
}
