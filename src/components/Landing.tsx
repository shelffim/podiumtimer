"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MESSAGES, progressLabel } from "@/lib/messages";
import { computeTimer } from "@/lib/timer";
import { safeReturnTo } from "@/lib/validation";
import { api, dataMode } from "@/services/api";
import { AppBar } from "./AppBar";
import { Icon, type IconName } from "./Icon";
import { TimerFace } from "./TimerFace";

const copy = MESSAGES.landing;
const featureIcons: IconName[] = ["gauge", "link", "chart"];
const previewSeconds = [30, 90, 120, 150, 60, 150];
const previewSegments = copy.previewSegments.map((name, index) => ({ id: String(index), name, durationSec: previewSeconds[index] }));
// 둘째 구간을 12초 늦게 넘기고 셋째 구간에서 36초가 지난 순간이에요(남은 1:24, 직전 구간 0:12 늦음).
const previewView = computeTimer(previewSegments, { status: "running", startedAt: 0, transitions: [30_000, 132_000], rev: 0 }, 168_000);
const inlineLink = "focus-ring rounded-sm text-white underline underline-offset-2";

// 가입 뒤 보게 될 진행 화면과 같은 구성(위쪽 바 + TimerFace)을 멈춘 채로 보여줘요.
function LandingPreview() {
  return (
    <div aria-hidden="true" className="card gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <span className="chip tabular-nums">{progressLabel(previewView.segmentIndex, previewSegments.length)}</span>
        <span className="flex-1" />
        <span className="plate size-9"><Icon name="undo" size={16} /></span>
        <span className="plate size-9"><Icon name="square" size={13} /></span>
      </div>
      <div className="px-5 pt-6 pb-5">
        <TimerFace segments={previewSegments} view={previewView} compact />
      </div>
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
              {MESSAGES.timers.free} · {copy.minimumAge} · {copy.consentLead} <Link className={inlineLink} href="/terms">{MESSAGES.terms.title}</Link>{copy.consentAnd}{" "}
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
