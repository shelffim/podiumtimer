"use client";

import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;
    let disposed = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    const release = (sentinel: WakeLockSentinel | null) => { void sentinel?.release().catch(() => {}); };

    async function request() {
      if (disposed || pending || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      pending = true;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (disposed || document.visibilityState !== "visible") release(sentinel);
        else lock = sentinel;
      } catch {
        // 지원 여부와 사용자 환경에 따라 실패할 수 있어요.
      } finally {
        pending = false;
      }
    }
    function visibility() {
      if (document.visibilityState === "visible") void request();
      else { release(lock); lock = null; }
    }
    void request();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visibility);
      release(lock);
      lock = null;
    };
  }, [active]);
}
