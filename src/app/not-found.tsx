import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { MESSAGES } from "@/lib/messages";

export default function NotFoundPage() {
  return (
    <PageShell>
      <h1 className="text-2xl font-semibold text-neutral-50">{MESSAGES.notFound.title}</h1>
      <Link
        href="/"
        className="inline-flex h-11 items-center rounded-md bg-neutral-50 px-4 font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
      >
        {MESSAGES.notFound.home}
      </Link>
    </PageShell>
  );
}
