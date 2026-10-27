import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MockBadge } from "@/components/MockBadge";
import { MESSAGES } from "@/lib/messages";
import { dataMode } from "@/services/api";
import "./globals.css";

export const metadata: Metadata = {
  title: MESSAGES.serviceName,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-[#0a0a0a] text-neutral-300">
        {children}
        <MockBadge mode={dataMode} />
      </body>
    </html>
  );
}
