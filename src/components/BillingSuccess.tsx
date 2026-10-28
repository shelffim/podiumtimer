"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MESSAGES } from "@/lib/messages";
import { safeReturnTo } from "@/lib/validation";
import { api } from "@/services/api";
import { AppBar } from "./AppBar";
import { Icon } from "./Icon";

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

  return <>
    <AppBar />
    <div className="page page-narrow justify-center">
      <div className="card items-start gap-5 p-8">
        {delayed ? <>
          <Icon name="clock" size={32} />
          <div role="status" className="flex flex-col gap-1.5">
            <h1 className="heading">{copy.delayed}</h1>
            <p className="text-sm text-soft">{copy.delayedDescription}</p>
          </div>
          <Link href="/timers" className="btn btn-primary">{copy.backToTimers}</Link>
        </> : <>
          <span aria-hidden="true" className="spinner" />
          <div className="flex flex-col gap-1.5">
            <h1 className="heading">{copy.pending}</h1>
            <p className="text-sm text-soft">{copy.pendingDescription}</p>
          </div>
        </>}
      </div>
    </div>
  </>;
}
