"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MESSAGES } from "@/lib/messages";
import { safeReturnTo } from "@/lib/validation";
import { api } from "@/services/api";

const copy = MESSAGES.billingSuccess;

export function BillingSuccess({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const destination = safeReturnTo(returnTo, "/timers");
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function checkPlan() {
      attempts += 1;
      try {
        const result = await api.getPlanStatus();
        if (!active) return;
        if (result.ok && result.data.plan === "pass") {
          router.replace(destination);
          return;
        }
      } catch {
        // 조회 실패도 확인 횟수에 포함하고 같은 한도까지 재시도해요.
      }
      if (!active) return;
      if (attempts < 10) timer = setTimeout(() => { void checkPlan(); }, 2_000);
      else {
        setDelayed(true);
        timer = setTimeout(() => { router.replace("/timers"); }, 3_000);
      }
    }

    void checkPlan();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [destination, router]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-50">{copy.pending}</h1>
      {delayed && <>
        <p role="status" className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">{copy.delayed}</p>
        <Link href="/timers" className="inline-flex min-h-11 min-w-11 items-center rounded-md text-sm text-neutral-400 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">{copy.backToTimers}</Link>
      </>}
    </section>
  );
}
