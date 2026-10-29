"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LIMITS } from "@/lib/billing";
import { MESSAGES, errorMessage, planLimitMessage, segmentFieldLabel, segmentPlaceholder, segmentUsageLabel } from "@/lib/messages";
import { formatDuration, totalPlannedMs } from "@/lib/timer";
import { parseClock, timerInputSchema } from "@/lib/validation";
import { api, device } from "@/services/api";
import type { ErrorCode, Plan } from "@/types/api";
import type { TimerDraft, TimerInput } from "@/types/timer";
import { AppBar } from "./AppBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { LimitNotice } from "./LimitNotice";

// 새로 만들기 → 편집 경로 전환에서만 한 번 전달하는 화면 안내예요.
// 타이머 데이터는 이 값에 의존하지 않고 항상 api에서 읽어요.
let creationNoticeId: string | null = null;

const copy = MESSAGES.timers;
const segmentGrid = "grid grid-cols-[44px_minmax(0,1fr)_96px_44px] items-center gap-2";

export function TimerEditor({ timerId }: { timerId?: string }) {
  const router = useRouter();
  const formId = useId();
  const [form, setForm] = useState<TimerDraft | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [limit, setLimit] = useState<"PLAN_LIMIT_TIMERS" | "PLAN_LIMIT_SEGMENTS" | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const focusGrip = useRef<string | null>(null);
  const path = timerId ? `/timers/${timerId}` : "/timers/new";

  useEffect(() => {
    if (focusGrip.current === null) return;
    document.querySelector<HTMLElement>(`[data-grip="${focusGrip.current}"]`)?.focus();
    focusGrip.current = null;
  });

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
      const draft = device.takeDraft(path);
      setForm(draft ?? (timer?.ok ? {
        name: timer.data.name,
        segments: timer.data.segments.map((segment) => ({ id: segment.id, name: segment.name, clock: formatDuration(segment.durationSec * 1000) })),
      } : { name: "", segments: [{ id: crypto.randomUUID(), name: "", clock: "" }] }));
    }).catch(() => { if (active) setFailure(MESSAGES.appError.title); });
    return () => { active = false; };
  }, [timerId, path, router]);

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

  // 읽을 수 있는 시간이면 칸을 나갈 때 m:ss로 바꿔 보여줘요(`3` → `3:00`). 에러 표시는 건드리지 않아요.
  function normalizeClock(id: string) {
    setForm((current) => current && ({
      ...current,
      segments: current.segments.map((s) => {
        const sec = s.id === id ? parseClock(s.clock) : null;
        return sec === null ? s : { ...s, clock: formatDuration(sec * 1000) };
      }),
    }));
  }

  function moveSegment(from: number, to: number) {
    clearFeedback();
    setForm((current) => {
      if (!current || from === to || to < 0 || to >= current.segments.length) return current;
      const segments = [...current.segments];
      const [moved] = segments.splice(from, 1);
      segments.splice(to, 0, moved);
      return { ...current, segments };
    });
  }

  function moveWithKey(event: KeyboardEvent<HTMLButtonElement>, index: number, id: string) {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    focusGrip.current = id;
    moveSegment(index, index + step);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    let from = index;
    function move(moveEvent: globalThis.PointerEvent) {
      const row = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<HTMLElement>("[data-seg]");
      const to = row ? Number(row.dataset.seg) : from;
      if (to === from) return;
      moveSegment(from, to);
      from = to;
    }
    function end() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
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
    // 시간 형식 오류가 먼저 들어가 있어서 같은 칸의 범위 오류는 덮어쓰지 않아요.
    const parsed = timerInputSchema.safeParse(input);
    if (!parsed.success || Object.keys(errors).length) {
      for (const issue of parsed.error?.issues ?? []) {
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
    if (!timerId || busy) return;
    clearFeedback(); setBusy(true);
    try {
      const result = await api.deleteTimer(timerId);
      if (!result.ok) handleFailure(result.code);
      else router.replace("/timers");
    } catch { setFailure(MESSAGES.appError.title); }
    finally { setBusy(false); }
  }

  const total = form ? totalPlannedMs(form.segments.map((s) => ({ id: s.id, name: s.name, durationSec: parseClock(s.clock) ?? 0 }))) : 0;
  const fieldId = (key: string) => `${formId}-${key}`;

  return <>
    <AppBar narrow back="/timers" title={timerId ? copy.editTitle : copy.createTitle} />
    <div className="page page-narrow">
      {notFound ? <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-red-400">{copy.notFound}</p>
        <Link href="/timers" className="btn btn-secondary">{copy.backToList}</Link>
      </div> : <>
        {failure && <p role="alert" className="text-sm text-red-400">{failure}</p>}
        {!form && !failure && <p className="text-sm text-soft">{copy.loading}</p>}
        {form && <form onSubmit={save} noValidate className="flex flex-col gap-6">
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor={fieldId("name")} className="label">{copy.timerName}</label>
              <input id={fieldId("name")} className="field" placeholder={copy.namePlaceholder} value={form.name}
                onChange={(e) => { clearFeedback(); setForm({ ...form, name: e.target.value }); }}
                aria-invalid={!!fields.name} aria-describedby={fields.name ? fieldId("name-error") : undefined} />
              {fields.name && <p id={fieldId("name-error")} className="text-[13px] text-red-400">{fields.name}</p>}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="label">{copy.segments}</h2>
                <span className="caption tabular-nums">{segmentUsageLabel(form.segments.length, plan === "free" ? LIMITS.free.segments : null, total)}</span>
              </div>
              <div aria-hidden="true" className={`${segmentGrid} -mb-1 caption`}>
                <span /><span>{copy.segmentName}</span><span className="text-right">{copy.clockColumn}</span><span />
              </div>
              <ol className="flex flex-col gap-3">
                {form.segments.map((segment, index) => {
                  const nameKey = `segments.${index}.name`;
                  const clockKey = `segments.${index}.durationSec`;
                  return <li key={segment.id} data-seg={index} className="flex flex-col gap-1">
                    <div className={segmentGrid}>
                      <button type="button" data-grip={segment.id} aria-label={segmentFieldLabel(index, "reorder")}
                        onPointerDown={(e) => startDrag(e, index)} onKeyDown={(e) => moveWithKey(e, index, segment.id)}
                        className="focus-ring flex size-11 cursor-grab touch-none items-center justify-center rounded-md text-muted active:cursor-grabbing">
                        <Icon name="grip" size={18} />
                      </button>
                      <input aria-label={segmentFieldLabel(index, "name")} className="field" placeholder={segmentPlaceholder(index)} value={segment.name}
                        onChange={(e) => updateSegment(segment.id, "name", e.target.value)}
                        aria-invalid={!!fields[nameKey]} aria-describedby={fields[nameKey] ? fieldId(`${nameKey}-error`) : undefined} />
                      <input aria-label={segmentFieldLabel(index, "clock")} className="field text-right tabular-nums" placeholder={copy.clockPlaceholder} value={segment.clock}
                        onChange={(e) => updateSegment(segment.id, "clock", e.target.value)} onBlur={() => normalizeClock(segment.id)}
                        aria-invalid={!!fields[clockKey]} aria-describedby={fields[clockKey] ? fieldId(`${clockKey}-error`) : undefined} />
                      <button type="button" aria-label={segmentFieldLabel(index, "remove")}
                        onClick={() => { clearFeedback(); setForm({ ...form, segments: form.segments.filter((s) => s.id !== segment.id) }); }}
                        className="focus-ring flex size-11 items-center justify-center rounded-md text-muted hover:text-white">
                        <Icon name="x" size={18} />
                      </button>
                    </div>
                    {(fields[nameKey] || fields[clockKey]) && <p className="pl-13 text-[13px] text-red-400">
                      {fields[nameKey] && <span id={fieldId(`${nameKey}-error`)}>{fields[nameKey]}</span>}
                      {fields[nameKey] && fields[clockKey] && MESSAGES.common.separator}
                      {fields[clockKey] && <span id={fieldId(`${clockKey}-error`)}>{fields[clockKey]}</span>}
                    </p>}
                  </li>;
                })}
              </ol>
              <button type="button" className="btn btn-secondary w-full" onClick={() => { clearFeedback(); setForm({ ...form, segments: [...form.segments, { id: crypto.randomUUID(), name: "", clock: "" }] }); }}>
                <Icon name="plus" size={18} />{copy.addSegment}
              </button>
              {fields.segments && <p className="text-[13px] text-red-400">{fields.segments}</p>}
            </div>
          </fieldset>
          {limit && <LimitNotice text={planLimitMessage(limit, plan)} pricingHref={plan === "free" ? `/pricing?returnTo=${encodeURIComponent(path)}` : undefined}
            onNavigate={() => device.saveDraft(path, form)} />}
          {savedId ? <div role="status" className="card items-start">
            <p className="label flex items-center gap-2"><Icon name="check" size={18} />{copy.saved}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/timers/${savedId}/run`} className="btn btn-primary"><Icon name="play" size={18} />{copy.rehearse}</Link>
              <Link href="/timers" className="btn btn-secondary">{copy.backToList}</Link>
            </div>
          </div> : <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">{copy.save}</button>}
        </form>}
        {timerId && form && <div>
          <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className="btn-text">{copy.deleteTimer}</button>
        </div>}
      </>}
    </div>
    {confirmingDelete && <ConfirmDialog title={copy.deleteConfirm} description={copy.deleteDescription} confirmLabel={copy.delete}
      onCancel={() => setConfirmingDelete(false)} onConfirm={() => { setConfirmingDelete(false); void deleteTimer(); }} />}
  </>;
}
