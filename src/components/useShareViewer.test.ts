import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleRun } from "@/lib/timer";
import { api } from "@/services/api";
import { joinShareChannel, type ShareChannel } from "@/services/realtime";
import type { Result } from "@/types/api";
import type { PresenceMember, ShareView } from "@/types/share";
import { useShareViewer } from "./useShareViewer";

vi.mock("@/services/api", () => ({ api: { getShare: vi.fn() }, device: { getClientId: () => "me" } }));
vi.mock("@/services/realtime", () => ({ joinShareChannel: vi.fn() }));
const get = vi.mocked(api.getShare);
const initial: ShareView = { timerName: "발표", segments: [{ id: "a", name: "도입", durationSec: 60 }], seatCap: 3, state: createIdleRun(), rev: 0 };
const own: PresenceMember = { clientId: "me", nickname: "학생", role: "viewer", joinedAt: 50_200 };
const others: PresenceMember[] = [1, 2, 3].map((n) => ({ ...own, clientId: `other-${n}`, joinedAt: n }));
let channel: ShareChannel;
let changed: () => void;
let presence: (members: PresenceMember[]) => void;
let order: string[];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function flush() { await act(async () => {}); }
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function open(nickname: string | null = "학생", code = "code") {
  return renderHook((props) => useShareViewer({ ...props, offset: 200 }), { initialProps: { code, nickname } });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(50_000); vi.resetAllMocks(); order = [];
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  channel = {
    onChanged: vi.fn((handler) => { order.push("changed"); changed = handler; return vi.fn(); }),
    onPresence: vi.fn((handler) => { order.push("presence"); presence = handler; handler([]); return vi.fn(); }),
    track: vi.fn(async () => { order.push("track"); }),
    sendChanged: vi.fn(), leave: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(joinShareChannel).mockImplementation(() => { order.push("join"); return channel; });
  get.mockImplementation(async () => { order.push("get"); return { ok: true, data: initial }; });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useShareViewer", () => {
  it("does not join or read without a nickname", async () => {
    const { result } = open(null); await flush(); await tick(20_000);
    expect(joinShareChannel).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
    expect(result.current).toEqual({ share: null, status: "loading", disconnected: false });
  });
  it("registers both handlers before tracking and reading with corrected time", async () => {
    const { result } = open(); await flush();
    expect(order).toEqual(["join", "changed", "presence", "track", "get"]);
    expect(joinShareChannel).toHaveBeenCalledWith("code", "me");
    expect(channel.track).toHaveBeenCalledWith({ nickname: "학생", role: "viewer", joinedAt: 50_200 });
    expect(result.current).toEqual({ share: initial, status: "ready", disconnected: false });
  });
  it("reads right away on a changed signal and folds later signals within a second into one read", async () => {
    open(); await flush();
    await act(async () => changed()); expect(get).toHaveBeenCalledTimes(2);
    await tick(300); act(() => changed()); await tick(300); act(() => changed());
    expect(get).toHaveBeenCalledTimes(2);
    await tick(399); expect(get).toHaveBeenCalledTimes(2);
    await tick(1); expect(get).toHaveBeenCalledTimes(3);
    await tick(5_000); expect(get).toHaveBeenCalledTimes(3);
  });
  it("does not read again when a single changed signal's window ends", async () => {
    open(); await flush();
    await act(async () => changed()); expect(get).toHaveBeenCalledTimes(2);
    await tick(2_000); expect(get).toHaveBeenCalledTimes(2);
  });
  it("only applies higher revisions and ignores changed payloads", async () => {
    get.mockResolvedValueOnce({ ok: true, data: { ...initial, rev: 5 } });
    const { result } = open(); await flush();
    for (const rev of [4, 5, 6]) {
      get.mockResolvedValueOnce({ ok: true, data: { ...initial, timerName: `수정 ${rev}`, rev } });
      act(() => changed()); await tick(1_000);
      expect(result.current.share?.timerName).toBe(rev === 6 ? "수정 6" : "발표");
    }
  });
  it("polls only while visible and reads immediately on visible and online", async () => {
    open(); await flush(); await tick(9_999); expect(get).toHaveBeenCalledOnce();
    await tick(1); expect(get).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange"))); await tick(30_000);
    expect(get).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(get).toHaveBeenCalledTimes(4);
  });
  it("serializes requests and reads once more after multiple in-flight triggers", async () => {
    const pending = deferred<Result<ShareView>>(); get.mockReturnValueOnce(pending.promise);
    const { result } = open(); await flush();
    act(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online")); changed(); });
    await tick(1_000); expect(get).toHaveBeenCalledOnce();
    get.mockResolvedValue({ ok: true, data: { ...initial, rev: 1 } });
    await act(async () => pending.resolve({ ok: true, data: initial }));
    expect(get).toHaveBeenCalledTimes(2); expect(result.current.share?.rev).toBe(1);
  });
  it("backs off failures up to 30 seconds without polling bypass, then resets", async () => {
    get.mockRejectedValue(new Error()); const { result } = open(); await flush();
    expect(result.current.disconnected).toBe(true);
    for (const [i, delay] of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000].entries()) {
      await tick(delay - 1); expect(get).toHaveBeenCalledTimes(i + 1);
      await tick(1); expect(get).toHaveBeenCalledTimes(i + 2);
    }
    get.mockResolvedValue({ ok: true, data: initial }); await tick(30_000);
    expect(result.current.disconnected).toBe(false);
    get.mockResolvedValueOnce({ ok: false, code: "INVALID_INPUT" });
    await act(async () => window.dispatchEvent(new Event("online")));
    const count = get.mock.calls.length; await tick(999); expect(get).toHaveBeenCalledTimes(count);
    await tick(1); expect(get).toHaveBeenCalledTimes(count + 1);
  });
  it("drains a queued refresh even when the current request fails", async () => {
    const pending = deferred<Result<ShareView>>(); get.mockReturnValueOnce(pending.promise);
    const { result } = open(); await flush();
    act(() => window.dispatchEvent(new Event("online")));
    await act(async () => pending.resolve({ ok: false, code: "INVALID_INPUT" }));
    expect(get).toHaveBeenCalledTimes(2); expect(result.current.disconnected).toBe(false);
    await tick(1_000); expect(get).toHaveBeenCalledTimes(2);
  });
  it("does not apply an in-flight response after presence rejects admission", async () => {
    const { result } = open(); await flush();
    const pending = deferred<Result<ShareView>>(); get.mockReturnValueOnce(pending.promise);
    await act(async () => window.dispatchEvent(new Event("online")));
    act(() => presence([...others, own])); expect(result.current.status).toBe("full");
    await act(async () => pending.resolve({ ok: true, data: { ...initial, seatCap: 10, rev: 99 } }));
    expect(result.current.status).toBe("full"); expect(result.current.share?.seatCap).toBe(3);
  });
  it("retries tracking failures before reading", async () => {
    vi.mocked(channel.track).mockRejectedValueOnce(new Error());
    const { result } = open(); await flush();
    expect(result.current.disconnected).toBe(true); expect(get).not.toHaveBeenCalled();
    await tick(1_000); expect(channel.track).toHaveBeenCalledTimes(2); expect(get).toHaveBeenCalledOnce();
    expect(result.current.disconnected).toBe(false);
  });
  it("waits for its clientId before admission, then leaves when full and stops all reads", async () => {
    const { result, unmount } = open(); await flush();
    act(() => presence(others)); expect(result.current.status).toBe("ready"); expect(channel.leave).not.toHaveBeenCalled();
    act(() => presence([...others, own])); expect(result.current.status).toBe("full"); expect(channel.leave).toHaveBeenCalledOnce();
    act(() => { changed(); window.dispatchEvent(new Event("online")); document.dispatchEvent(new Event("visibilitychange")); });
    await tick(60_000); expect(get).toHaveBeenCalledOnce();
    unmount(); expect(channel.leave).toHaveBeenCalledOnce();
  });
  it("checks presence received before the first share and uses updated seat caps", async () => {
    const pending = deferred<Result<ShareView>>(); get.mockReturnValueOnce(pending.promise);
    const { result } = open(); await flush(); act(() => presence([...others, own]));
    expect(result.current.status).toBe("loading");
    await act(async () => pending.resolve({ ok: true, data: { ...initial, seatCap: 10 } }));
    expect(result.current.status).toBe("ready");
    get.mockResolvedValueOnce({ ok: true, data: { ...initial, rev: 1 } });
    act(() => changed()); await tick(1_000); expect(result.current.status).toBe("full");
  });
  it("handles NOT_FOUND initially or after a running share was deleted", async () => {
    const { result } = open(); await flush(); get.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
    act(() => changed()); await tick(1_000); expect(result.current.status).toBe("not_found");
    expect(result.current.disconnected).toBe(false); expect(channel.leave).toHaveBeenCalledOnce();
    await tick(60_000); expect(get).toHaveBeenCalledTimes(2);
  });
  it("ignores stale requests after code changes and cancels handlers and retries on cleanup", async () => {
    const pending = deferred<Result<ShareView>>(); get.mockReturnValueOnce(pending.promise);
    const { result, rerender, unmount } = open(); await flush();
    rerender({ code: "second", nickname: "학생" }); await flush();
    await act(async () => pending.resolve({ ok: true, data: { ...initial, timerName: "옛 발표", rev: 99 } }));
    expect(result.current.share?.timerName).toBe("발표"); expect(channel.leave).toHaveBeenCalledOnce();
    get.mockRejectedValue(new Error()); await act(async () => window.dispatchEvent(new Event("online")));
    act(() => changed()); const count = get.mock.calls.length; unmount(); await tick(60_000);
    expect(get).toHaveBeenCalledTimes(count); expect(channel.leave).toHaveBeenCalledTimes(2);
    expect(vi.mocked(channel.onChanged).mock.results.every(({ value }) => value.mock.calls.length === 1)).toBe(true);
    expect(vi.mocked(channel.onPresence).mock.results.every(({ value }) => value.mock.calls.length === 1)).toBe(true);
  });
  it("cleans up StrictMode subscriptions before reading", async () => {
    renderHook(() => useShareViewer({ code: "code", nickname: "학생", offset: 0 }), { reactStrictMode: true }); await flush();
    expect(joinShareChannel).toHaveBeenCalledTimes(2); expect(channel.leave).toHaveBeenCalledOnce(); expect(get).toHaveBeenCalledOnce();
  });
});
