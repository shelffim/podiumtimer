"use client";

import { AppBar } from "@/components/AppBar";
import { MESSAGES } from "@/lib/messages";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <AppBar />
      <main className="page page-narrow">
        <h1 className="title">{MESSAGES.appError.title}</h1>
        <button type="button" onClick={reset} className="btn btn-primary self-start">{MESSAGES.appError.retry}</button>
      </main>
    </>
  );
}
