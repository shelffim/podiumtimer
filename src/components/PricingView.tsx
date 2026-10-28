"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { errorMessage, MESSAGES, planLabel } from "@/lib/messages";
import { safeReturnTo } from "@/lib/validation";
import { api, dataMode } from "@/services/api";
import type { PlanStatus } from "@/types/api";

const copy = MESSAGES.pricing;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";
const primary = `inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-50 px-4 font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 ${focus}`;
const textLink = `inline-flex min-h-11 min-w-11 items-center rounded-md text-sm text-neutral-400 hover:text-neutral-200 ${focus}`;

export function PricingView({ returnTo }: { returnTo: string }) {
  const destination = safeReturnTo(returnTo, "/timers");
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let active = true;
    api.getPlanStatus().then((result) => {
      if (!active) return;
      if (result.ok) setStatus(result.data);
      else setError(errorMessage(result.code));
    }).catch(() => { if (active) setError(MESSAGES.appError.title); });
    return () => { active = false; };
  }, []);

  async function purchase() {
    if (purchasing) return;
    setPurchasing(true);
    setError(null);
    try {
      const result = await api.startCheckout(destination);
      if (result.ok) {
        window.location.assign(result.data.url);
        return;
      }
      setError(errorMessage(result.code));
    } catch {
      setError(MESSAGES.appError.title);
    }
    setPurchasing(false);
  }

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-50">{copy.title}</h1>
      <div className="space-y-3">
        {status ? <>
          <p className="text-sm text-neutral-300">{planLabel(status.plan, status.expiresAt)}</p>
          {status.plan === "pass" && <p className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">{copy.extension}</p>}
        </> : !error && <p className="text-sm text-neutral-400">{MESSAGES.timers.loading}</p>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>
      <table aria-label={copy.comparison} className="w-full table-fixed text-left text-sm text-neutral-300">
        <thead className="border-b border-neutral-800 text-xs text-neutral-400">
          <tr>
            <th scope="col" className="w-1/2 py-3 pr-2 font-medium">{copy.item}</th>
            <th scope="col" className="py-3 text-right font-medium">{MESSAGES.timers.free}</th>
            <th scope="col" className="py-3 text-right font-medium">{MESSAGES.timers.pass}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {copy.rows.map((row) => <tr key={row.label}>
            <th scope="row" className="break-words py-3 pr-2 font-normal">{row.label}</th>
            <td className="py-3 text-right tabular-nums">{row.free}</td>
            <td className="py-3 text-right tabular-nums">{row.pass}</td>
          </tr>)}
        </tbody>
      </table>
      <div className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums text-neutral-50">{copy.price}</p>
        <p className="text-sm text-neutral-400">{copy.duration}</p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={purchase} disabled={purchasing} className={primary}>{dataMode === "mock" ? copy.mockBuy : copy.buy}</button>
          <Link href={destination} className={textLink}>{copy.back}</Link>
        </div>
      </div>
    </section>
  );
}
