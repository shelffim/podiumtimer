import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./useWakeLock";

const release = vi.fn(async () => {});
const request = vi.fn(async () => ({ release, released: false }));
async function flush() { await act(async () => {}); }
async function visibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
}
beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
  request.mockClear(); release.mockClear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("useWakeLock", () => {
  it("requests only when active and releases on deactivation", async () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: false } });
    expect(request).not.toHaveBeenCalled();
    rerender({ active: true }); await flush();
    expect(request).toHaveBeenCalledExactlyOnceWith("screen");
    rerender({ active: false }); await flush(); expect(release).toHaveBeenCalledOnce();
  });
  it("waits for visible and reacquires on return, releasing on unmount", async () => {
    await visibility("hidden");
    const { unmount } = renderHook(() => useWakeLock(true));
    expect(request).not.toHaveBeenCalled();
    await visibility("visible"); expect(request).toHaveBeenCalledOnce();
    await visibility("hidden"); await visibility("visible"); expect(request).toHaveBeenCalledTimes(2);
    unmount(); await flush(); expect(release).toHaveBeenCalledTimes(2);
    await visibility("visible"); expect(request).toHaveBeenCalledTimes(2);
  });
  it("releases a request that resolves after cleanup", async () => {
    let resolve!: (lock: { release: typeof release; released: boolean }) => void;
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    await act(async () => { resolve({ release, released: false }); });
    expect(release).toHaveBeenCalledOnce();
  });
  it("silently handles unsupported devices and denied requests", async () => {
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
    const { unmount } = renderHook(() => useWakeLock(true)); await flush(); unmount();
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    request.mockRejectedValueOnce(new Error());
    renderHook(() => useWakeLock(true)); await flush();
    await visibility("visible"); expect(request).toHaveBeenCalledTimes(2);
  });
});
