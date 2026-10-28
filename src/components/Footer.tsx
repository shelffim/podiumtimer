import Link from "next/link";
import { MESSAGES } from "@/lib/messages";

export function Footer({ contactEmail }: { contactEmail?: string }) {
  const email = contactEmail?.trim();
  const linkClass = "focus-ring inline-flex min-h-11 items-center rounded-md text-soft hover:text-white";

  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 px-5 py-4 text-[13px] text-muted">
      <Link className={linkClass} href="/privacy">{MESSAGES.privacy.title}</Link>
      <Link className={linkClass} href="/terms">{MESSAGES.terms.title}</Link>
      {email && <a className={linkClass} href={`mailto:${email}`}>{email}</a>}
    </footer>
  );
}
