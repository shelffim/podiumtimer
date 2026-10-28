import type { ReactNode } from "react";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-20 text-left">
      <main className="flex-1 space-y-8 py-8">{children}</main>
      <Footer contactEmail={process.env.CONTACT_EMAIL} />
    </div>
  );
}
