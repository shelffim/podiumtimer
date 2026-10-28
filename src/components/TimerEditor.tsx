"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MESSAGES, errorMessage, planLimitMessage, segmentFieldLabel, totalTimeLabel } from "@/lib/messages";
import { formatDuration, totalPlannedMs } from "@/lib/timer";
import { parseClock, timerInputSchema } from "@/lib/validation";
import { api } from "@/services/api";
import type { ErrorCode, Plan } from "@/types/api";
import type { TimerInput } from "@/types/timer";

// 새로 만들기 → 편집 경로 전환에서만 한 번 전달하는 화면 안내예요.
// 타이머 데이터는 이 값에 의존하지 않고 항상 api에서 읽어요.
let creationNoticeId: string | null = null;

const copy = MESSAGES.timers;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";
const button = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-4 transition-colors duration-150 ${focus}`;
const primary = `${button} bg-neutral-50 font-medium text-neutral-950 hover:bg-neutral-200`;
const secondary = `${button} border border-neutral-700 text-neutral-100 hover:bg-neutral-900`;
const textLink = `inline-flex min-h-11 min-w-11 items-center rounded-md text-sm text-neutral-400 hover:text-neutral-200 ${focus}`;
const inputClass = `h-11 w-full min-w-0 rounded-md border border-neutral-800 bg-neutral-900 px-3 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none ${focus}`;
const iconButton = `inline-flex h-11 w-11 items-center justify-center text-neutral-400 hover:text-neutral-200 disabled:text-neutral-500 ${focus}`;

export function TimerEditor({ timerId }: { timerId?: string }) {
  const router = useRouter();
  const formId = useId();
  const [form, setForm] = useState<{ name: string; segments: { id: string; name: string; clock: string }[] } | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [limit, setLimit] = useState<"PLAN_LIMIT_TIMERS" | "PLAN_LIMIT_SEGMENTS" | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.getPlanStatus(), timerId ? api.getTimer(timerId) : Promise.resolve(null)]).then(([status, timer]) => {
      if (!active) return;
      if ((!status.ok && status.code === "UNAUTHENTICATED") || (timer && !timer.ok && timer.code === "UNAUTHENTICATED")) {
        router.replace("/");
        return;
      }
      if (!status.ok) { setFailure(errorMessage(status.code)); return; }
      setPlan(status.data.plan);
      if (timer?.ok && creationNoticeId === timer.data.id) {
        setSavedId(timer.data.id);
        creationNoticeId = null;
      }
      if (timer && !timer.ok) {
        if (timer.code === "NOT_FOUND") setNotFound(true);
        else setFailure(errorMessage(timer.code));
        return;
      }
      setForm(timer?.ok ? {
        name: timer.data.name,
        segments: timer.data.segments.map((segment) => ({ id: segment.id, name: segment.name, clock: formatDuration(segment.durationSec * 1000) })),
      } : { name: "", segments: [{ id: crypto.randomUUID(), name: "", clock: "" }] });
    }).catch(() => { if (active) setFailure(MESSAGES.appError.title); });
    return () => { active = false; };
  }, [timerId, router]);

  function clearFeedback() {
    setFields({}); setFailure(null); setLimit(null); setSavedId(null);
  }

  function handleFailure(code: ErrorCode) {
    if (code === "UNAUTHENTICATED") router.replace("/");
    else if (code === "PLAN_LIMIT_TIMERS" || code === "PLAN_LIMIT_SEGMENTS") setLimit(code);
    else if (code === "NOT_FOUND") setNotFound(true);
    else setFailure(errorMessage(code));
  }

  function updateSegment(id: string, field: "name" | "clock", value: string) {
    clearFeedback();
    setForm((current) => current && ({ ...current, segments: current.segments.map((s) => s.id === id ? { ...s, [field]: value } : s) }));
  }

  function moveSegment(index: number, direction: -1 | 1) {
    clearFeedback();
    setForm((current) => {
      if (!current || index + direction < 0 || index + direction >= current.segments.length) return current;
      const segments = [...current.segments];
      [segments[index], segments[index + direction]] = [segments[index + direction], segments[index]];
      return { ...current, segments };
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    clearFeedback();
    const errors: Record<string, string> = {};
    const input: TimerInput = {
      name: form.name,
      segments: form.segments.map((segment, index) => {
        const durationSec = parseClock(segment.clock);
        if (durationSec === null) errors[`segments.${index}.durationSec`] = MESSAGES.validation.clockFormat;
        return { id: segment.id, name: segment.name, durationSec: durationSec ?? 0 };
      }),
    };
    if (Object.keys(errors).length) { setFields(errors); return; }
    const parsed = timerInputSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        errors[key] ??= issue.message;
      }
      setFields(errors);
      return;
    }
    setBusy(true);
    try {
      const id = timerId ?? savedId;
      const result = id ? await api.updateTimer(id, parsed.data) : await api.createTimer(parsed.data);
      if (!result.ok) { handleFailure(result.code); return; }
      setSavedId(result.data.id);
      if (!timerId) {
        creationNoticeId = result.data.id;
        router.replace(`/timers/${result.data.id}`);
      }
    } catch {
      setFailure(MESSAGES.appError.title);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTimer() {
    if (!timerId || busy || !window.confirm(copy.deleteConfirm)) return;
    clearFeedback(); setBusy(true);
    try {
      const result = await api.deleteTimer(timerId);
      if (!result.ok) handleFailure(result.code);
      else router.replace("/timers");
    } catch { setFailure(MESSAGES.appError.title); }
    finally { setBusy(false); }
  }

  const path = timerId ? `/timers/${timerId}` : "/timers/new";
  const total = form ? totalPlannedMs(form.segments.map((s) => ({ id: s.id, name: s.name, durationSec: parseClock(s.clock) ?? 0 }))) : 0;
  const fieldId = (key: string) => `${formId}-${key}`;

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Link href="/timers" className={textLink}>{copy.backToList}</Link>
        <h1 className="text-2xl font-semibold text-neutral-50">{timerId ? copy.editTitle : copy.createTitle}</h1>
      </div>
      {notFound ? <p role="alert" className="text-sm text-red-400">{copy.notFound}</p> : <>
        {failure && <p role="alert" className="text-sm text-red-400">{failure}</p>}
        {!form && !failure && <p className="text-sm text-neutral-400">{copy.loading}</p>}
        {limit && <div role="status" className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">
          <p>{planLimitMessage(limit, plan)}</p>
          {plan === "free" && <Link href={`/pricing?returnTo=${encodeURIComponent(path)}`} className={textLink}>{copy.viewPass}</Link>}
        </div>}
        {savedId && <div role="status" className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">
          <p>{copy.saved}</p>
          <Link href={`/timers/${savedId}/run`} className={textLink}>{copy.rehearse}</Link>
        </div>}
        {form && <form onSubmit={save} noValidate>
          <fieldset disabled={busy} className="min-w-0 space-y-8">
            <div className="space-y-2">
              <label htmlFor={fieldId("name")} className="text-xs text-neutral-400">{copy.timerName}</label>
              <input id={fieldId("name")} className={inputClass} value={form.name} onChange={(e) => { clearFeedback(); setForm({ ...form, name: e.target.value }); }} aria-invalid={!!fields.name} aria-describedby={fields.name ? fieldId("name-error") : undefined} />
              {fields.name && <p id={fieldId("name-error")} className="text-sm text-red-400">{fields.name}</p>}
            </div>
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-neutral-400">{copy.segments}</h2>
              <ol className="divide-y divide-neutral-800">
                {form.segments.map((segment, index) => {
                  const nameKey = `segments.${index}.name`;
                  const clockKey = `segments.${index}.durationSec`;
                  return <li key={segment.id} className="space-y-3 py-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
                      <div className="space-y-2">
                        <label htmlFor={fieldId(nameKey)} className="text-xs text-neutral-400">{segmentFieldLabel(index, "name")}</label>
                        <input id={fieldId(nameKey)} className={inputClass} value={segment.name} onChange={(e) => updateSegment(segment.id, "name", e.target.value)} aria-invalid={!!fields[nameKey]} aria-describedby={fields[nameKey] ? fieldId(`${nameKey}-error`) : undefined} />
                        {fields[nameKey] && <p id={fieldId(`${nameKey}-error`)} className="text-sm text-red-400">{fields[nameKey]}</p>}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor={fieldId(clockKey)} className="text-xs text-neutral-400">{segmentFieldLabel(index, "clock")}</label>
                        <input id={fieldId(clockKey)} className={`${inputClass} tabular-nums`} placeholder={copy.clockPlaceholder} value={segment.clock} onChange={(e) => updateSegment(segment.id, "clock", e.target.value)} aria-invalid={!!fields[clockKey]} aria-describedby={fields[clockKey] ? fieldId(`${clockKey}-error`) : undefined} />
                        {fields[clockKey] && <p id={fieldId(`${clockKey}-error`)} className="text-sm text-red-400">{fields[clockKey]}</p>}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" className={iconButton} aria-label={copy.moveUp} disabled={index === 0} onClick={() => moveSegment(index, -1)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 14 6-6 6 6" /></svg>
                      </button>
                      <button type="button" className={iconButton} aria-label={copy.moveDown} disabled={index === form.segments.length - 1} onClick={() => moveSegment(index, 1)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 10 6 6 6-6" /></svg>
                      </button>
                      <button type="button" className={iconButton} aria-label={copy.removeSegment} onClick={() => { clearFeedback(); setForm({ ...form, segments: form.segments.filter((s) => s.id !== segment.id) }); }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" /></svg>
                      </button>
                    </div>
                  </li>;
                })}
              </ol>
              {fields.segments && <p className="text-sm text-red-400">{fields.segments}</p>}
              <button type="button" className={secondary} onClick={() => { clearFeedback(); setForm({ ...form, segments: [...form.segments, { id: crypto.randomUUID(), name: "", clock: "" }] }); }}>{copy.addSegment}</button>
              <p className="text-sm tabular-nums text-neutral-300">{totalTimeLabel(total)}</p>
            </div>
            <button type="submit" className={primary}>{copy.save}</button>
          </fieldset>
        </form>}
        {timerId && form && <div className="flex flex-wrap items-center gap-4">
          <Link href={`/timers/${timerId}/run`} className={secondary}>{copy.start}</Link>
          <Link href={`/timers/${timerId}/records`} className={secondary}>{copy.records}</Link>
          <button type="button" disabled={busy} onClick={deleteTimer} className={`${button} border border-red-500/40 text-red-400 hover:bg-red-500/10`}>{copy.deleteTimer}</button>
        </div>}
      </>}
    </section>
  );
}
