"use client";

import { useEffect, useRef, useState } from "react";
import { MESSAGES } from "@/lib/messages";
import { api, device } from "@/services/api";
import { joinShareChannel } from "@/services/realtime";
import type { RunState } from "@/types/run";
import type { PresenceMember } from "@/types/share";
import type { Segment } from "@/types/timer";

type Options = { code: string | null; run: RunState; segments: Segment[]; offset: number };
type HostState = { members: PresenceMember[]; seatCap: number | null; disconnected: boolean };
const empty: HostState = { members: [], seatCap: null, disconnected: false };

export function useShareHost({ code, run, segments, offset }: Options): HostState {
  const [state, setState] = useState<HostState & { code: string | null }>({ ...empty, code: null });
  const latest = useRef({ run, segments, offset });
  const request = useRef<(() => void) | null>(null);

  useEffect(() => {
    const changed = latest.current.run.rev !== run.rev;
    latest.current = { run, segments, offset };
    if (changed) request.current?.();
  }, [run, segments, offset]);

  useEffect(() => {
    if (code === null) return;
    const channel = joinShareChannel(code, device.getClientId());
    let disposed = false;
    let busy = false;
    let pending = false;
    let initialized = false;
    let savedStartedAt: number | null = null;
    let refreshCap = false;
    let delay = 1_000;
    let retry: ReturnType<typeof setTimeout> | null = null;

    function patch(value: Partial<HostState>) {
      if (!disposed) setState((previous) => ({ ...(previous.code === code ? previous : empty), ...value, code }));
    }
    function clearRetry() {
      if (retry !== null) clearTimeout(retry);
      retry = null;
    }
    async function readShare() {
      const result = await api.getShare(code!);
      if (!result.ok) throw new Error(result.code);
      return result.data;
    }
    async function save() {
      if (disposed || busy) return;
      busy = true;
      pending = false;
      clearRetry();
      try {
        // 복원된 실행이 이미 시작 정보를 저장했는지 확인한 뒤에만 써요.
        if (!initialized) {
          const share = await readShare();
          if (disposed) return;
          savedStartedAt = share.state.startedAt;
          initialized = true;
          patch({ seatCap: share.seatCap });
        }
        const snapshot = latest.current;
        pending = false;
        if (snapshot.run.status !== "idle") {
          const start = savedStartedAt !== snapshot.run.startedAt ? { segments: snapshot.segments } : undefined;
          const result = await api.updateShareState(code!, snapshot.run, start);
          if (disposed) return;
          if (!result.ok) throw new Error(result.code);
          if (start) {
            savedStartedAt = snapshot.run.startedAt;
            refreshCap = true;
          }
          // 상태 자체는 보내지 않고, 저장에 성공한 rev만 힌트로 보내요.
          await channel.sendChanged(snapshot.run.rev);
          if (disposed) return;
        }
        if (refreshCap) {
          const share = await readShare();
          if (disposed) return;
          patch({ seatCap: share.seatCap });
          refreshCap = false;
        }
        delay = 1_000;
        patch({ disconnected: false });
      } catch {
        if (!disposed) {
          patch({ disconnected: true });
          retry = setTimeout(() => { retry = null; void save(); }, delay);
          delay = Math.min(delay * 2, 30_000);
        }
      } finally {
        busy = false;
        if (pending && !disposed) void save();
      }
    }
    function enqueue() {
      pending = true;
      void save();
    }
    function visibility() {
      if (document.visibilityState === "visible") enqueue();
    }
    const unsubscribe = channel.onPresence((members) => patch({ members }));
    void channel.track({ nickname: MESSAGES.share.hostName, role: "host", joinedAt: Date.now() + latest.current.offset })
      .catch(() => patch({ disconnected: true }));
    request.current = enqueue;
    void save();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", enqueue);
    return () => {
      disposed = true;
      request.current = null;
      clearRetry();
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", enqueue);
      void channel.leave().catch(() => {});
    };
  }, [code]);

  return state.code === code ? { members: state.members, seatCap: state.seatCap, disconnected: state.disconnected } : empty;
}
