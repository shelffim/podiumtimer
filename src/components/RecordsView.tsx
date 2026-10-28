"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage, MESSAGES, recordDateLabel, recordsTitle } from "@/lib/messages";
import { averageRecords } from "@/lib/stats";
import { toSegmentResult } from "@/lib/timer";
import { api } from "@/services/api";
import type { RunRecord, Timer } from "@/types/timer";
import { AverageDiffChart } from "./AverageDiffChart";
import { AverageTable } from "./AverageTable";
import { ResultTable } from "./ResultTable";

const copy = MESSAGES.records;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";
const textLink = `inline-flex min-h-11 min-w-11 items-center rounded-md text-sm text-neutral-400 hover:text-neutral-200 ${focus}`;

export function RecordsView({ timerId }: { timerId: string }) {
  const router = useRouter();
  const viewId = useId();
  const [data, setData] = useState<{ timer: Timer; records: RunRecord[] } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.getTimer(timerId), api.listRecords(timerId)]).then(([timer, records]) => {
      if (!active) return;
      if ((!timer.ok && timer.code === "UNAUTHENTICATED") || (!records.ok && records.code === "UNAUTHENTICATED")) {
        router.replace("/");
        return;
      }
      if ((!timer.ok && timer.code === "NOT_FOUND") || (!records.ok && records.code === "NOT_FOUND")) {
        setNotFound(true);
        return;
      }
      if (!timer.ok) setError(errorMessage(timer.code));
      else if (!records.ok) setError(errorMessage(records.code));
      else {
        setData({ timer: timer.data, records: records.data });
        setExpanded([]);
        setNotFound(false);
        setError(null);
      }
    }).catch(() => { if (active) setError(MESSAGES.appError.title); });
    return () => { active = false; };
  }, [router, timerId]);

  async function deleteRecord(id: string) {
    if (deletingId || !window.confirm(copy.deleteConfirm)) return;
    setDeletingId(id);
    setError(null);
    try {
      const result = await api.deleteRecord(id);
      if (!result.ok) {
        if (result.code === "UNAUTHENTICATED") router.replace("/");
        else setError(errorMessage(result.code));
        return;
      }
      setData((current) => current && ({ ...current, records: current.records.filter((record) => record.id !== id) }));
      setExpanded((current) => current.filter((recordId) => recordId !== id));
    } catch {
      setError(MESSAGES.appError.title);
    } finally {
      setDeletingId(null);
    }
  }

  if (notFound) return <section className="space-y-4">
    <h1 className="text-2xl font-semibold text-neutral-50">{MESSAGES.timers.notFound}</h1>
    <Link href="/timers" className={textLink}>{MESSAGES.timers.backToList}</Link>
  </section>;

  const rows = data ? averageRecords(data.timer, data.records) : null;
  return (
    <section className="space-y-8">
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-neutral-400">{MESSAGES.timers.loading}</p>}
      {data && <>
        <header className="space-y-3">
          <h1 className="break-words text-2xl font-semibold text-neutral-50">{recordsTitle(data.timer.name)}</h1>
          <div className="flex gap-4">
            <Link href={`/timers/${timerId}/run`} className={textLink}>{MESSAGES.timers.start}</Link>
            <Link href={`/timers/${timerId}`} className={textLink}>{MESSAGES.timers.edit}</Link>
          </div>
        </header>
        {rows && <section aria-labelledby={`${viewId}-average`} className="space-y-4">
          <h2 id={`${viewId}-average`} className="text-sm font-medium text-neutral-400">{copy.average}</h2>
          <AverageTable rows={rows} />
          <AverageDiffChart rows={rows} />
        </section>}
        {data.records.length === 0 ? <div className="space-y-3 text-sm text-neutral-300">
          <p>{copy.empty}</p>
          <p className="text-neutral-400">{copy.emptyDescription}</p>
        </div> : <ul className="divide-y divide-neutral-800">
          {data.records.map((record) => {
            const open = expanded.includes(record.id);
            const resultId = `${viewId}-${record.id}`;
            return <li key={record.id} className="py-3">
              <div className="flex items-center gap-3">
                <button type="button" aria-expanded={open} aria-controls={resultId}
                  className={`min-h-11 min-w-0 flex-1 rounded-md py-2 text-left text-sm tabular-nums text-neutral-300 hover:text-neutral-50 ${focus}`}
                  onClick={() => setExpanded((current) => open ? current.filter((id) => id !== record.id) : [...current, record.id])}>
                  <time dateTime={new Date(record.startedAt).toISOString()}>{recordDateLabel(record.startedAt)}</time>
                </button>
                <button type="button" onClick={() => void deleteRecord(record.id)} disabled={deletingId !== null}
                  className={`${textLink} justify-center disabled:text-neutral-500`}>{copy.delete}</button>
              </div>
              {open && <div id={resultId}><ResultTable results={record.segments.map(toSegmentResult)} /></div>}
            </li>;
          })}
        </ul>}
      </>}
    </section>
  );
}
