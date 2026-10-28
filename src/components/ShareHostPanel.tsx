"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/billing";
import { MESSAGES, seatLabel, seatsFullLabel } from "@/lib/messages";
import { seatUsage } from "@/lib/seats";
import type { PresenceMember } from "@/types/share";
import { Icon } from "./Icon";
import { LimitNotice } from "./LimitNotice";

const copy = MESSAGES.share;

export function ShareHostPanel({ timerId, code, seatCap, members, onCreate }: {
  timerId: string;
  code: string | null;
  seatCap: number | null;
  members: PresenceMember[];
  onCreate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const usage = seatCap === null ? null : seatUsage(members, seatCap);
  const viewers = members.filter((member) => member.role === "viewer").sort((a, b) => a.joinedAt - b.joinedAt);

  async function copyLink() {
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(`${location.origin}/s/${code}`);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  return <section className="card">
    <div className="flex flex-col gap-1">
      <h2 className="heading">{copy.title}</h2>
      <p className="text-sm text-soft">{code === null ? copy.createHint : copy.linkHint}</p>
    </div>
    {code === null ? <div>
      <button type="button" className="btn btn-secondary" onClick={onCreate}><Icon name="link" size={18} />{copy.create}</button>
    </div> : <>
      <div className="flex items-center gap-2">
        <p className="field flex items-center overflow-hidden text-sm whitespace-nowrap tabular-nums">
          <span className="text-soft">/s/</span><span className="truncate">{code}</span>
        </p>
        <button type="button" className="btn btn-secondary shrink-0" onClick={() => void copyLink()}>
          <Icon name={copied ? "check" : "copy"} size={18} />{copied ? copy.copied : copy.copy}
        </button>
      </div>
      {copyFailed ? <p role="alert" className="text-sm text-red-400">{copy.copyFailed}</p> : null}
      {usage && seatCap !== null ? <>
        <div className="flex flex-col gap-2">
          <p className="text-sm tabular-nums">{seatLabel(usage.used, seatCap)} <span className="text-soft">{copy.includesHost}</span></p>
          <ul className="flex flex-wrap gap-1.5">
            <li className="chip"><Icon name="mic" size={14} />{copy.hostSelf}</li>
            {viewers.map((member) => <li key={member.clientId} className="chip font-medium">{member.nickname}</li>)}
          </ul>
        </div>
        {usage.full ? (seatCap < LIMITS.pass.seats
          ? <LimitNotice text={seatsFullLabel(true)} pricingHref={`/pricing?returnTo=/timers/${timerId}/run`} />
          : <LimitNotice text={seatsFullLabel(false)} />) : null}
      </> : null}
    </>}
  </section>;
}
