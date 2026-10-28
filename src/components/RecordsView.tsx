"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { averageCaption, diffLabel, errorMessage, MESSAGES, recordCountLabel, recordDateLabel, recordTotalsLabel } from "@/lib/messages";
import { averageRecords, matchingRecords } from "@/lib/stats";
import { resultTotals, toSegmentResult } from "@/lib/timer";
import { api } from "@/services/api";
import type { RunRecord, Timer } from "@/types/timer";
import { AppBar } from "./AppBar";
import { AverageDiffChart } from "./AverageDiffChart";
import { AverageTable } from "./AverageTable";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { ResultTable } from "./ResultTable";

const copy = MESSAGES.records;
const verdictColor = { late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" };

export function RecordsView({ timerId }: { timerId: string }) {
  const router = useRouter();
  const viewId = useId();
  const [data, setData] = useState<{ timer: Timer; records: RunRecord[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
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
        setOpen(null);
        setNotFound(false);
        setError(null);
      }
    }).catch(() => { if (active) setError(MESSAGES.appError.title); });
    return () => { active = false; };
  }, [router, timerId]);

  async function deleteRecord(id: string) {
    if (deletingId) return;
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
      setOpen((current) => current === id ? null : current);
    } catch {
      setError(MESSAGES.appError.title);
    } finally {
      setDeletingId(null);
    }
  }

  const bar = <AppBar back="/timers" title={MESSAGES.timers.records} />;
  if (notFound) return <>
    {bar}
    <div className="page">
      <p role="alert" className="text-sm text-red-400">{MESSAGES.timers.notFound}</p>
      <Link href="/timers" className="btn btn-secondary self-start">{MESSAGES.timers.backToList}</Link>
    </div>
  </>;

  const rows = data ? averageRecords(data.timer, data.records) : null;
  return <>
    {bar}
    <div className="page">
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-soft">{MESSAGES.timers.loading}</p>}
      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="title">{data.timer.name}</h2>
          <Link href={`/timers/${timerId}/run`} className="btn btn-primary"><Icon name="play" size={18} />{MESSAGES.timers.start}</Link>
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2">
          {rows ? <section aria-labelledby={`${viewId}-average`} className="card">
            <div className="flex flex-col gap-1">
              <h3 id={`${viewId}-average`} className="heading">{copy.average}</h3>
              <p className="caption">{averageCaption(matchingRecords(data.timer, data.records).length)}</p>
            </div>
            <AverageDiffChart rows={rows} />
            <AverageTable rows={rows} />
          </section> : <div className="card"><p className="text-sm text-soft">{copy.averageEmpty}</p></div>}
          <div className="flex flex-col gap-2">
            <h3 className="label px-1">{recordCountLabel(data.records.length)}</h3>
            {data.records.length === 0 ? <div className="flex flex-col gap-1 px-1 text-sm text-soft">
              <p>{copy.empty}</p>
              <p>{copy.emptyDescription}</p>
            </div> : <ul className="flex flex-col gap-2">
              {data.records.map((record) => {
                const results = record.segments.map(toSegmentResult);
                const totals = resultTotals(results);
                const isOpen = open === record.id;
                const id = `${viewId}-${record.id}`;
                return <li key={record.id} className="card gap-0 p-0">
                  <button type="button" aria-expanded={isOpen} aria-controls={`${id}-result`} aria-labelledby={`${id}-date`} aria-describedby={`${id}-totals ${id}-diff`}
                    onClick={() => setOpen(isOpen ? null : record.id)}
                    className="focus-ring flex min-h-11 items-center gap-3 rounded-3xl px-5 py-4 text-left">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <time id={`${id}-date`} dateTime={new Date(record.startedAt).toISOString()} className="label tabular-nums">{recordDateLabel(record.startedAt)}</time>
                      <span id={`${id}-totals`} className="caption tabular-nums">{recordTotalsLabel(totals.actualMs, totals.plannedMs)}</span>
                    </span>
                    <span id={`${id}-diff`} className={`text-sm tabular-nums ${verdictColor[totals.verdict]}`}>{diffLabel(totals.diffMs)}</span>
                    <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={18} className="text-soft" />
                  </button>
                  {isOpen && <div id={`${id}-result`} className="flex flex-col gap-2 px-5 pb-4">
                    <ResultTable results={results} />
                    <div>
                      <button type="button" onClick={() => setDeleteTarget(record.id)} disabled={deletingId !== null} className="btn-text text-sm">{copy.delete}</button>
                    </div>
                  </div>}
                </li>;
              })}
            </ul>}
          </div>
        </div>
      </>}
    </div>
    {deleteTarget && <ConfirmDialog title={copy.deleteConfirm} description={copy.deleteDescription} confirmLabel={copy.confirmDelete}
      onCancel={() => setDeleteTarget(null)} onConfirm={() => { setDeleteTarget(null); void deleteRecord(deleteTarget); }} />}
  </>;
}
