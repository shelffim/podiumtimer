"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MESSAGES } from "@/lib/messages";
import { safeReturnTo } from "@/lib/validation";
import { api, dataMode } from "@/services/api";
import { AppBar } from "./AppBar";
import { Icon, type IconName } from "./Icon";
import { LandingPreview } from "./LandingPreview";
import { useDemoFrame } from "./useDemoFrame";

const copy = MESSAGES.landing;
const featureIcons: IconName[] = ["gauge", "link", "chart"];
const inlineLink = "focus-ring rounded-sm text-white underline underline-offset-2";

export function Landing({ next }: { next?: string }) {
  const frame = useDemoFrame();
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
        <LandingPreview frame={frame} />
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
