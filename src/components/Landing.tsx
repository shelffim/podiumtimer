"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { diffLabel, lastResultLabel, MESSAGES, nextSegmentLabel, progressLabel } from "@/lib/messages";
import { formatClock } from "@/lib/timer";
import { safeReturnTo } from "@/lib/validation";
import { api, dataMode } from "@/services/api";
import { AppBar } from "./AppBar";
import { Icon, type IconName } from "./Icon";
import { TimelineBar } from "./TimelineBar";

const copy = MESSAGES.landing;
const featureIcons: IconName[] = ["gauge", "link", "chart"];
const previewSeconds = [30, 90, 120, 150, 60, 150];
const previewSegments = copy.previewSegments.map((name, index) => ({ id: String(index), name, durationSec: previewSeconds[index] }));
const inlineLink = "focus-ring rounded-sm text-white underline underline-offset-2";

function LandingPreview() {
  return (
    <div aria-hidden="true" className="card gap-5">
      <div className="flex items-center gap-3">
        <span className="chip tabular-nums">{progressLabel(2, previewSegments.length)}</span>
        <span className="caption">{nextSegmentLabel(previewSegments[3].name)}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="heading">{previewSegments[2].name}</p>
        <p className="text-7xl leading-none font-medium tracking-[-0.04em] text-white tabular-nums">{formatClock(84_000)}</p>
      </div>
      <p className="text-sm text-white">{lastResultLabel(previewSegments[1].name)} <span className="text-red-400 tabular-nums">{diffLabel(12_000)}</span></p>
      <TimelineBar segments={previewSegments} segmentIndex={2} progressMs={156_000} />
    </div>
  );
}

export function Landing({ next }: { next?: string }) {
  const router = useRouter();
  const destination = safeReturnTo(next, "/timers");
  const [status, setStatus] = useState<"checking" | "ready" | "signingIn">("checking");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    api.getUser().then((user) => {
      if (!active) return;
      if (user) router.replace(destination);
      else setStatus("ready");
    }).catch(() => {
      if (!active) return;
      setFailed(true);
      setStatus("ready");
    });

    return () => { active = false; };
  }, [destination, router]);

  async function signIn() {
    if (status !== "ready") return;
    setStatus("signingIn");
    setFailed(false);
    try {
      await api.signIn(next);
      router.push(destination);
    } catch {
      setFailed(true);
      setStatus("ready");
    }
  }

  return <>
    <AppBar />
    <div className="page">
      <div className="grid gap-8 pt-4 md:grid-cols-2 md:items-start md:gap-6">
        <div className="flex flex-col gap-6">
          <h1 className="hero">{copy.headline}</h1>
          <p className="text-pretty text-soft">{copy.description}</p>
          <div className="flex flex-col items-start gap-2.5">
            <button type="button" disabled={status !== "ready"} onClick={signIn} className="btn btn-primary btn-lg disabled:cursor-wait">
              <Icon name="log-in" />{dataMode === "mock" ? copy.mockSignIn : copy.googleSignIn}
            </button>
            {failed && <p role="alert" className="text-sm text-red-400">{copy.signInFailed}</p>}
            <p className="caption">
              {copy.minimumAge} · {copy.consentLead} <Link className={inlineLink} href="/terms">{MESSAGES.terms.title}</Link>{copy.consentAnd}{" "}
              <Link className={inlineLink} href="/privacy">{MESSAGES.privacy.title}</Link>{copy.consentTail}
            </p>
          </div>
        </div>
        <LandingPreview />
      </div>
      <ul className="flex flex-col gap-4">
        {copy.features.map((feature, index) => <li key={feature.title} className="flex items-start gap-4">
          <span className="plate"><Icon name={featureIcons[index]} /></span>
          <div className="flex flex-col gap-0.5">
            <h2 className="label">{feature.title}</h2>
            <p className="text-sm text-soft">{feature.body}</p>
          </div>
        </li>)}
      </ul>
    </div>
  </>;
}
