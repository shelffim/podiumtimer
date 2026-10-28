"use client";

import Link from "next/link";
import { useState } from "react";
import { LIMITS } from "@/lib/billing";
import { MESSAGES, seatLabel } from "@/lib/messages";
import { seatUsage } from "@/lib/seats";
import type { PresenceMember } from "@/types/share";

const copy = MESSAGES.share;
const secondary = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-neutral-700 px-4 text-neutral-100 transition-colors duration-150 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

export function ShareHostPanel({ timerId, code, seatCap, members, onCreate }: {
  timerId: string;
  code: string | null;
  seatCap: number | null;
  members: PresenceMember[];
  onCreate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (code === null) return <button type="button" className={secondary} onClick={onCreate}>{copy.create}</button>;

  const url = `${location.origin}/s/${code}`;
  const usage = seatCap === null ? null : seatUsage(members, seatCap);
  const viewers = members.filter((member) => member.role === "viewer").sort((a, b) => a.joinedAt - b.joinedAt);
  async function copyLink() {
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }
  return <section className="space-y-3">
    <div className="flex items-center gap-3">
      <p className="min-w-0 flex-1 break-all text-sm text-neutral-300">{url}</p>
      <button type="button" className={`${secondary} shrink-0`} onClick={() => void copyLink()}>{copy.copy}</button>
    </div>
    {copied ? <p role="status" className="text-sm text-neutral-300">{copy.copied}</p> : null}
    {copyFailed ? <p role="alert" className="text-sm text-red-400">{copy.copyFailed}</p> : null}
    {usage && seatCap !== null ? <>
      <p className="text-sm tabular-nums text-neutral-400">{seatLabel(usage.used, seatCap)}</p>
      {usage.full ? <div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">
        <p>{copy.full}</p>
        {seatCap < LIMITS.pass.seats ? <>
          <p>{copy.passSeats}</p>
          <Link href={`/pricing?returnTo=/timers/${timerId}/run`} className={secondary}>{MESSAGES.timers.viewPass}</Link>
        </> : null}
      </div> : null}
    </> : null}
    {viewers.length > 0 ? <ul className="divide-y divide-neutral-800 text-sm text-neutral-300">
      {viewers.map((member) => <li key={member.clientId} className="break-words py-2">{member.nickname}</li>)}
    </ul> : null}
  </section>;
}
