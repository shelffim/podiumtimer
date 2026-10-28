import Link from "next/link";
import type { ReactNode } from "react";
import { MESSAGES } from "@/lib/messages";
import { Icon } from "./Icon";

export function AppBar({ back, title, children }: { back?: string; title?: string; children?: ReactNode }) {
  return (
    <header className="mx-auto flex min-h-14 w-full max-w-[960px] items-center gap-3 px-5 py-2 md:px-8">
      {back
        ? <Link href={back} aria-label={MESSAGES.common.back} title={MESSAGES.common.back} className="icon-btn"><Icon name="arrow-left" /></Link>
        : <Link href="/" className="focus-ring rounded-md text-[17px] leading-none font-semibold tracking-[-0.5px] whitespace-nowrap text-white">{MESSAGES.serviceName}</Link>}
      {title && <h1 className="min-w-0 truncate text-lg font-semibold text-white">{title}</h1>}
      <span className="flex-1" />
      {children}
    </header>
  );
}
