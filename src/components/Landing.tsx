"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MESSAGES } from "@/lib/messages";
import { safeReturnTo } from "@/lib/validation";
import { api, dataMode } from "@/services/api";

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

  const policyLinkClass = "inline-flex min-h-11 min-w-11 items-center rounded-md text-neutral-400 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-50">{MESSAGES.serviceName}</h1>
        <p className="text-sm leading-relaxed text-neutral-300">{MESSAGES.landing.description}</p>
      </div>
      <div className="space-y-4">
        <button
          type="button"
          disabled={status !== "ready"}
          onClick={signIn}
          className="h-11 w-full rounded-md bg-neutral-50 px-4 font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-wait"
        >
          {dataMode === "mock" ? MESSAGES.landing.mockSignIn : MESSAGES.landing.googleSignIn}
        </button>
        {failed && <p role="alert" className="text-sm text-red-400">{MESSAGES.landing.signInFailed}</p>}
        <div className="text-xs text-neutral-400">
          <p>{MESSAGES.landing.minimumAge}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className={policyLinkClass} href="/terms">{MESSAGES.terms.title}</Link>
            <Link className={policyLinkClass} href="/privacy">{MESSAGES.privacy.title}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
