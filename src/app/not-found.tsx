import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { MESSAGES } from "@/lib/messages";

export default function NotFoundPage() {
  return (
    <PageShell>
      <AppBar />
      <div className="page page-narrow">
        <h1 className="title">{MESSAGES.notFound.title}</h1>
        <Link href="/" className="btn btn-primary self-start">{MESSAGES.notFound.home}</Link>
      </div>
    </PageShell>
  );
}
