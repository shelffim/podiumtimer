import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MockBadge } from "@/components/MockBadge";
import { MESSAGES } from "@/lib/messages";
import { dataMode } from "@/services/api";
import "./globals.css";

// 단톡방 링크 미리보기가 시청자의 첫인상이라 서비스 이름과 한 줄 설명을 같이 둬요.
export const metadata: Metadata = {
  title: MESSAGES.serviceName,
  description: MESSAGES.meta.description,
  openGraph: { type: "website", locale: "ko_KR", siteName: MESSAGES.serviceName, title: MESSAGES.serviceName, description: MESSAGES.meta.description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0b0d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-surface text-white">
        {children}
        <MockBadge mode={dataMode} />
      </body>
    </html>
  );
}
