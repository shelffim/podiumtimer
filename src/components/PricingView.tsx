"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { errorMessage, MESSAGES, planLabel } from "@/lib/messages";
import { safeReturnTo } from "@/lib/validation";
import { api, dataMode } from "@/services/api";
import type { PlanStatus } from "@/types/api";
import { AppBar } from "./AppBar";
import { Icon } from "./Icon";

const copy = MESSAGES.pricing;

function Tier({ name, price, period, features, children }: {
  name: string;
  price: string;
  period?: string;
  features: readonly string[];
  children?: ReactNode;
}) {
  const id = useId();
  return <section aria-labelledby={id} className="card gap-6 p-8">
    <h3 id={id} className="heading">{name}</h3>
    <p className="flex items-baseline gap-1.5">
      <span className="text-[44px] leading-none tracking-[-1px] text-white tabular-nums">{price}</span>
      {period && <span className="text-sm text-soft">{period}</span>}
    </p>
    <ul className="flex flex-1 flex-col gap-3">
      {features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm text-white">
        <Icon name="check" size={18} className="mt-px" /><span>{feature}</span>
      </li>)}
    </ul>
    {children}
  </section>;
}

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

  return <>
    <AppBar back={destination} title={copy.title}>
      {status && <span className="chip">{planLabel(status.plan, status.expiresAt)}</span>}
    </AppBar>
    <div className="page">
      <div className="flex flex-col gap-2">
        <h2 className="title">{copy.headline}</h2>
        <p className="text-sm text-soft">{copy.description}</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Tier name={MESSAGES.timers.free} price={copy.freePrice} features={copy.freeFeatures}>
          {status?.plan === "free" && <button type="button" disabled className="btn btn-secondary w-full">{copy.current}</button>}
        </Tier>
        <Tier name={MESSAGES.timers.pass} price={copy.price} period={copy.period} features={copy.passFeatures}>
          <button type="button" onClick={purchase} disabled={purchasing} className="btn btn-primary btn-lg w-full">
            {dataMode === "mock" ? copy.mockBuy : status?.plan === "pass" ? copy.extend : copy.buy}
          </button>
        </Tier>
      </div>
      <p className="caption">{copy.note} <Link href="/terms" className="focus-ring rounded-sm text-white underline underline-offset-2">{MESSAGES.terms.title}</Link>{copy.noteTail}</p>
    </div>
  </>;
}
