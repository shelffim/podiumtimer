import type { ReactNode } from "react";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-12">
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer contactEmail={process.env.CONTACT_EMAIL} />
    </div>
  );
}
