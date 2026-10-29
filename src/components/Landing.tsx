"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MESSAGES } from "@/lib/messages";
import { safeReturnTo } from "@/lib/validation";
import { api, dataMode } from "@/services/api";
import { AppBar } from "./AppBar";
import { Icon } from "./Icon";
import { FeatureCards } from "./FeatureCards";
import { PaceCompare } from "./PaceCompare";
import { LandingPreview } from "./LandingPreview";
import { useDemoFrame } from "./useDemoFrame";

const copy = MESSAGES.landing;
const inlineLink = "focus-ring rounded-sm text-white underline underline-offset-2";

export function Landing({ next }: { next?: string }) {
  const frame = useDemoFrame();
  const router = useRouter();
  const destination = safeReturnTo(next, "/timers");
  const [status, setStatus] = useState<"checking" | "ready" | "signingIn">("checking");
  const [failedAt, setFailedAt] = useState<"hero" | "closing" | null>(null);

  useEffect(() => {
    let active = true;

    api.getUser().then((user) => {
      if (!active) return;
      if (user) router.replace(destination);
      else setStatus("ready");
    }).catch(() => {
      if (!active) return;
      setFailedAt("hero");
      setStatus("ready");
    });

    return () => { active = false; };
  }, [destination, router]);

  async function signIn(source: "hero" | "closing") {
    if (status !== "ready") return;
    setStatus("signingIn");
    setFailedAt(null);
    try {
      await api.signIn(next);
      router.push(destination);
    } catch {
      setFailedAt(source);
      setStatus("ready");
    }
  }

  return <>
    <AppBar />
    <div className="page gap-[72px] md:gap-[72px] lg:gap-32">
      <section className="grid gap-8 pt-4 md:grid-cols-2 md:items-center md:gap-6 lg:min-h-[min(calc(100svh-128px),720px)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="flex flex-col gap-6">
          <h1 className="hero">
            {copy.headlineParts[0]}{" "}<span className="text-blue-400">{copy.headlineParts[1]}</span>{" "}<span className="text-red-400">{copy.headlineParts[2]}</span>
          </h1>
          <p className="text-pretty text-soft">{copy.description}</p>
          <div className="flex flex-col items-start gap-2.5">
            <button type="button" disabled={status !== "ready"} onClick={() => signIn("hero")} className="btn btn-primary btn-lg disabled:cursor-wait">
              <Icon name="log-in" />{dataMode === "mock" ? copy.mockSignIn : copy.googleSignIn}
            </button>
            {failedAt === "hero" && <p role="alert" className="text-sm text-red-400">{copy.signInFailed}</p>}
            <p className="caption">
              {MESSAGES.timers.free} · {copy.minimumAge} · {copy.consentLead} <Link className={inlineLink} href="/terms">{MESSAGES.terms.title}</Link>{copy.consentAnd}{" "}
              <Link className={inlineLink} href="/privacy">{MESSAGES.privacy.title}</Link>{copy.consentTail}
            </p>
          </div>
        </div>
        <LandingPreview frame={frame} />
      </section>
      <PaceCompare />
      <FeatureCards frame={frame} />
      <section className="card gap-6 rounded-[32px] p-7 md:flex-row md:items-center md:justify-between lg:p-16">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="display">{copy.closingTitle}</h2>
          <p className="caption">{[MESSAGES.timers.free, copy.minimumAge].join(MESSAGES.common.separator)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2.5">
          <button type="button" disabled={status !== "ready"} onClick={() => signIn("closing")} className="btn btn-primary btn-lg disabled:cursor-wait">
            <Icon name="log-in" />{dataMode === "mock" ? copy.mockSignIn : copy.googleSignIn}
          </button>
          {failedAt === "closing" && <p role="alert" className="text-sm text-red-400">{copy.signInFailed}</p>}
        </div>
      </section>
    </div>
  </>;
}
