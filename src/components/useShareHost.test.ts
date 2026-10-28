import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { createIdleRun } from "@/lib/timer";
import { api } from "@/services/api";
import { joinShareChannel, type ShareChannel } from "@/services/realtime";
import type { Result } from "@/types/api";
import type { RunState } from "@/types/run";
import type { PresenceMember, ShareView } from "@/types/share";
import { useShareHost } from "./useShareHost";

vi.mock("@/services/api", () => ({
  api: { getShare: vi.fn(), updateShareState: vi.fn() },
  device: { getClientId: () => "host-device" },
}));
vi.mock("@/services/realtime", () => ({ joinShareChannel: vi.fn() }));
const segments = [{ id: "s1", name: "도입", durationSec: 60 }, { id: "s2", name: "결론", durationSec: 30 }];
const running: RunState = { status: "running", startedAt: 10_000, transitions: [], rev: 1 };
const next: RunState = { ...running, transitions: [20_000], rev: 2 };
const finished: RunState = { ...next, status: "finished", transitions: [20_000, 30_000], rev: 3 };
function share(state = createIdleRun(), seatCap = 3): Result<ShareView> {
  return { ok: true, data: { timerName: "발표", segments, seatCap, state, rev: state.rev } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let channel: ShareChannel;
let presence: (members: PresenceMember[]) => void;
const get = vi.mocked(api.getShare);
const update = vi.mocked(api.updateShareState);
async function flush() { await act(async () => {}); }
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function open(run = running, code: string | null = "code") {
  return renderHook((props) => useShareHost({ ...props, segments, offset: 200 }), { initialProps: { run, code } });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(50_000); vi.resetAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  channel = { onChanged: vi.fn(() => () => {}), onPresence: vi.fn((handler) => { presence = handler; return vi.fn(); }),
    track: vi.fn(async () => {}), sendChanged: vi.fn(async () => {}), leave: vi.fn(async () => {}) };
  vi.mocked(joinShareChannel).mockReturnValue(channel);
  get.mockResolvedValue(share()); update.mockResolvedValue({ ok: true, data: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useShareHost", () => {
  it("does nothing without a code; idle joins, tracks and reads without writing", async () => {
    const { rerender, result, unmount } = open(createIdleRun(), null); await flush();
    expect(joinShareChannel).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
    expect(result.current).toEqual({ members: [], seatCap: null, disconnected: false });
    rerender({ run: createIdleRun(), code: "code" }); await flush();
    expect(joinShareChannel).toHaveBeenCalledExactlyOnceWith("code", "host-device");
    expect(channel.track).toHaveBeenCalledWith({ nickname: MESSAGES.share.hostName, role: "host", joinedAt: 50_200 });
    expect(result.current.seatCap).toBe(3); expect(update).not.toHaveBeenCalled();
    const members: PresenceMember[] = [{ clientId: "v", nickname: "학생", role: "viewer", joinedAt: 5 }];
    act(() => presence(members)); expect(result.current.members).toEqual(members);
    unmount(); expect(channel.leave).toHaveBeenCalledOnce();
  });
  it("sends only a revision hint after successful persistence and refreshes the starting seat cap", async () => {
    const pending = deferred<Result<null>>(); update.mockReturnValueOnce(pending.promise);
    get.mockResolvedValueOnce(share()).mockResolvedValueOnce(share(running, 10));
    const { result } = open(); await flush();
    expect(update).toHaveBeenCalledExactlyOnceWith("code", running, { segments });
    expect(channel.sendChanged).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ ok: true, data: null }));
    expect(channel.sendChanged).toHaveBeenCalledExactlyOnceWith(1);
    expect(result.current.seatCap).toBe(10); expect(get).toHaveBeenCalledTimes(2);
  });
  it("keeps start on next after failed start, and omits it only after a successful save", async () => {
    update.mockResolvedValueOnce({ ok: false, code: "INVALID_INPUT" });
    const { rerender, result } = open(); await flush();
    expect(result.current.disconnected).toBe(true); expect(channel.sendChanged).not.toHaveBeenCalled();
    rerender({ code: "code", run: next }); await flush();
    expect(update).toHaveBeenLastCalledWith("code", next, { segments });
    expect(result.current.disconnected).toBe(false);
    rerender({ code: "code", run: finished }); await flush();
    expect(update).toHaveBeenLastCalledWith("code", finished, undefined);
    expect(channel.sendChanged).toHaveBeenLastCalledWith(3);
    await tick(30_000); expect(update).toHaveBeenCalledTimes(3);
  });
  it("restores a saved start by startedAt even when the remote revision is older", async () => {
    get.mockResolvedValue(share(running, 10)); open(next); await flush();
    expect(update).toHaveBeenCalledExactlyOnceWith("code", next, undefined);
  });
  it("waits for the initial read and uses the latest state, including when starting from idle", async () => {
    const pending = deferred<Result<ShareView>>(); get.mockReturnValueOnce(pending.promise);
    const { rerender } = open(createIdleRun()); await flush();
    rerender({ code: "code", run: running }); rerender({ code: "code", run: next }); await flush();
    expect(update).not.toHaveBeenCalled();
    await act(async () => pending.resolve(share()));
    expect(update).toHaveBeenCalledExactlyOnceWith("code", next, { segments });
  });
  it("uses start for a different remote startedAt", async () => {
    get.mockResolvedValue(share({ ...running, startedAt: 1 })); open(); await flush();
    expect(update).toHaveBeenCalledWith("code", running, { segments });
  });
  it("retries exceptions and failures at 1, 2, 4 seconds up to 30 seconds, then resets", async () => {
    update.mockRejectedValue(new Error());
    const { result, rerender } = open(); await flush();
    expect(result.current.disconnected).toBe(true);
    for (const [i, delay] of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000].entries()) {
      await tick(delay - 1); expect(update).toHaveBeenCalledTimes(i + 1);
      await tick(1); expect(update).toHaveBeenCalledTimes(i + 2);
    }
    update.mockResolvedValue({ ok: true, data: null }); await tick(30_000);
    expect(result.current.disconnected).toBe(false);
    update.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
    rerender({ code: "code", run: next }); await flush();
    const count = update.mock.calls.length; await tick(999); expect(update).toHaveBeenCalledTimes(count);
    await tick(1); expect(update).toHaveBeenCalledTimes(count + 1);
  });
  it("serializes writes and coalesces several in-flight changes into only the latest", async () => {
    const pending = deferred<Result<null>>(); update.mockReturnValueOnce(pending.promise);
    const { rerender } = open(); await flush();
    rerender({ code: "code", run: next }); rerender({ code: "code", run: finished }); await flush();
    expect(update).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ ok: true, data: null }));
    expect(update.mock.calls).toEqual([["code", running, { segments }], ["code", finished, undefined]]);
    expect(channel.sendChanged).toHaveBeenCalledTimes(2);
  });
  it("saves latest on visible and online but does not write on hidden or every clock tick", async () => {
    open(); await flush(); await tick(60_000); expect(update).toHaveBeenCalledOnce();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(update).toHaveBeenCalledOnce();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenLastCalledWith("code", running, undefined);
  });
  it("retries initial reads before deciding whether start is already saved", async () => {
    get.mockRejectedValueOnce(new Error()).mockResolvedValueOnce(share(running, 10));
    const { result } = open(); await flush(); expect(result.current.disconnected).toBe(true);
    expect(update).not.toHaveBeenCalled(); await tick(1_000);
    expect(update).toHaveBeenCalledWith("code", running, undefined);
    expect(result.current.disconnected).toBe(false);
  });
  it("does not reattach start when a broadcast fails after a successful save", async () => {
    vi.mocked(channel.sendChanged).mockRejectedValueOnce(new Error());
    const { result } = open(); await flush(); expect(result.current.disconnected).toBe(true);
    await tick(1_000); expect(update).toHaveBeenLastCalledWith("code", running, undefined);
    expect(result.current.disconnected).toBe(false);
  });
  it("leaves on code changes and ignores old responses and retries after cleanup", async () => {
    const pending = deferred<Result<null>>(); update.mockReturnValueOnce(pending.promise);
    const { rerender, result, unmount } = open(); await flush();
    rerender({ code: null, run: running }); expect(channel.leave).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ ok: true, data: null }));
    expect(channel.sendChanged).not.toHaveBeenCalled();
    expect(result.current).toEqual({ members: [], seatCap: null, disconnected: false });
    rerender({ code: "second", run: running }); await flush();
    expect(joinShareChannel).toHaveBeenLastCalledWith("second", "host-device");
    update.mockRejectedValue(new Error());
    await act(async () => window.dispatchEvent(new Event("online")));
    const count = update.mock.calls.length; unmount(); await tick(60_000);
    expect(update).toHaveBeenCalledTimes(count); expect(channel.leave).toHaveBeenCalledTimes(2);
  });
  it("cleans up the first StrictMode subscription before starting another", async () => {
    renderHook(() => useShareHost({ code: "code", run: running, segments, offset: 0 }), {
      reactStrictMode: true,
    }); await flush();
    expect(joinShareChannel).toHaveBeenCalledTimes(2); expect(channel.leave).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });
});
