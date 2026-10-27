"use client";

import { MESSAGES } from "@/lib/messages";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-50">{MESSAGES.appError.title}</h1>
      <button
        type="button"
        onClick={reset}
        className="h-11 rounded-md bg-neutral-50 px-4 font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
      >
        {MESSAGES.appError.retry}
      </button>
    </main>
  );
}
