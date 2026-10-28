"use client";

import { AppBar } from "@/components/AppBar";
import { Footer } from "@/components/Footer";
import { MESSAGES } from "@/lib/messages";

// 클라이언트 경계라 서버 전용 문의 이메일은 읽지 못하고 약관 링크만 보여요.
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col pb-12">
      <AppBar />
      <main className="page page-narrow">
        <h1 className="title">{MESSAGES.appError.title}</h1>
        <button type="button" onClick={reset} className="btn btn-primary self-start">{MESSAGES.appError.retry}</button>
      </main>
      <Footer />
    </div>
  );
}
