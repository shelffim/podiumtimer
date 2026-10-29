import Link from "next/link";
import { MESSAGES } from "@/lib/messages";
import { Icon } from "./Icon";

export function LimitNotice({ text, pricingHref, onNavigate }: { text: string; pricingHref?: string; onNavigate?: () => void }) {
  return (
    <div role="status" className="notice">
      <Icon name="info" />
      <p className="min-w-0 flex-[1_1_200px] text-sm text-white">{text}</p>
      {pricingHref && <Link href={pricingHref} onClick={onNavigate} className="btn btn-primary">{MESSAGES.timers.viewPass}</Link>}
    </div>
  );
}
