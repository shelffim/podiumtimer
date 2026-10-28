"use client";

import { useEffect, useState } from "react";
import { admit } from "@/lib/seats";
import { api, device } from "@/services/api";
import { joinShareChannel } from "@/services/realtime";
import type { PresenceMember, ShareView } from "@/types/share";

type Options = { code: string; nickname: string | null; offset: number };
type ViewerState = { share: ShareView | null; status: "loading" | "not_found" | "full" | "ready"; disconnected: boolean };
const empty: ViewerState = { share: null, status: "loading", disconnected: false };

export function useShareViewer({ code, nickname, offset }: Options): ViewerState {
  const [state, setState] = useState<ViewerState & Options>({ ...empty, code, nickname, offset });

  useEffect(() => {
    if (nickname === null) return;
    const clientId = device.getClientId();
    const channel = joinShareChannel(code, clientId);
    const meta = { nickname, role: "viewer" as const, joinedAt: Date.now() + offset };
    let stopped = false;
    let busy = false;
    let pending = false;
    let tracked = false;
    let seenSelf = false;
    let members: PresenceMember[] = [];
    let share: ShareView | null = null;
    let delay = 1_000;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let changedTimer: ReturnType<typeof setTimeout> | null = null;
    let changedQueued = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let offChanged = () => {};
    let offPresence = () => {};

    function patch(value: Partial<ViewerState>) {
      if (!stopped) setState((previous) => ({
        ...(previous.code === code && previous.nickname === nickname && previous.offset === offset ? previous : empty),
        ...value, code, nickname, offset,
      }));
    }
    function clearRetry() {
      if (retry !== null) clearTimeout(retry);
      retry = null;
    }
    function stop() {
      if (stopped) return;
      stopped = true;
      clearRetry();
      if (changedTimer !== null) clearTimeout(changedTimer);
      if (poll !== null) clearInterval(poll);
      offChanged(); offPresence();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", enqueue);
      void channel.leave().catch(() => {});
    }
    function checkAdmission() {
      if (stopped || !share || !seenSelf) return;
      if (!admit(members, clientId, share.seatCap)) {
        patch({ share, status: "full", disconnected: false });
        stop();
      }
    }
    async function read() {
      if (stopped || busy) return;
      busy = true;
      pending = false;
      clearRetry();
      try {
        if (!tracked) {
          await channel.track(meta);
          if (stopped) return;
          tracked = true;
        }
        const result = await api.getShare(code);
        if (stopped) return;
        if (!result.ok) {
          if (result.code === "NOT_FOUND") {
            patch({ status: "not_found", disconnected: false });
            stop();
            return;
          }
          throw new Error(result.code);
        }
        if (!share || result.data.rev > share.rev) share = result.data;
        patch({ share, status: "ready", disconnected: false });
        delay = 1_000;
        checkAdmission();
      } catch {
        if (!stopped) {
          patch({ disconnected: true });
          retry = setTimeout(() => { retry = null; void read(); }, delay);
          delay = Math.min(delay * 2, 30_000);
        }
      } finally {
        busy = false;
        if (pending && !stopped) void read();
      }
    }
    function enqueue() {
      if (stopped) return;
      pending = true;
      void read();
    }
    function visibility() {
      if (document.visibilityState === "visible") enqueue();
    }

    // 첫 신호는 바로 읽고, 1초 안에 더 온 신호는 1초 뒤에 한 번만 읽어요.
    function onChangedSignal() {
      if (stopped) return;
      if (changedTimer !== null) { changedQueued = true; return; }
      enqueue();
      changedTimer = setTimeout(() => {
        changedTimer = null;
        if (changedQueued) { changedQueued = false; onChangedSignal(); }
      }, 1_000);
    }

    offChanged = channel.onChanged(onChangedSignal);
    offPresence = channel.onPresence((next) => {
      if (stopped) return;
      members = next;
      if (members.some((member) => member.clientId === clientId)) seenSelf = true;
      checkAdmission();
    });
    poll = setInterval(() => {
      if (document.visibilityState === "visible" && retry === null) enqueue();
    }, 10_000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", enqueue);
    void read();
    return stop;
  }, [code, nickname, offset]);

  return state.code === code && state.nickname === nickname && state.offset === offset
    ? { share: state.share, status: state.status, disconnected: state.disconnected }
    : empty;
}
