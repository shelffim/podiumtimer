import Link from "next/link";
import { MESSAGES } from "@/lib/messages";

export function Footer({ contactEmail }: { contactEmail?: string }) {
  const email = contactEmail?.trim();
  const linkClass = "inline-flex min-h-11 min-w-11 items-center rounded-md hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

  return (
    <footer className="flex flex-wrap items-center gap-x-2 border-t border-neutral-800 pt-4 text-xs text-neutral-500">
      <Link className={linkClass} href="/privacy">{MESSAGES.privacy.title}</Link>
      <span aria-hidden="true">{MESSAGES.footer.separator}</span>
      <Link className={linkClass} href="/terms">{MESSAGES.terms.title}</Link>
      {email && (
        <>
          <span aria-hidden="true">{MESSAGES.footer.separator}</span>
          <a className={linkClass} href={`mailto:${email}`}>{MESSAGES.footer.contact}</a>
        </>
      )}
    </footer>
  );
}
