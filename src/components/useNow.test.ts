import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "./useNow";

let callbacks: Map<number, FrameRequestCallback>;
let nextId: number;
const request = vi.fn((callback: FrameRequestCallback) => { callbacks.set(++nextId, callback); return nextId; });
const cancel = vi.fn((id: number) => { callbacks.delete(id); });
function frame() {
  const pending = [...callbacks.values()];
  callbacks.clear();
  act(() => pending.forEach((callback) => callback(0)));
}
beforeEach(() => {
  callbacks = new Map();
  nextId = 0;
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("useNow", () => {
  it("returns the corrected clock without requesting frames when inactive", () => {
    const { result } = renderHook(() => useNow(250, false));
    expect(result.current).toBe(10_250);
    expect(request).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
  });

  it("reads Date.now each frame rather than the rAF timestamp and cancels the latest frame on unmount", () => {
    const { result, unmount } = renderHook(() => useNow(-500, true));
    expect(callbacks.size).toBe(1);
    vi.setSystemTime(12_000);
    frame();
    expect(result.current).toBe(11_500);
    vi.setSystemTime(15_000);
    frame();
    expect(result.current).toBe(14_500);
    expect(callbacks.size).toBe(1);
    const pendingId = nextId;
    unmount();
    expect(cancel).toHaveBeenCalledWith(pendingId);
    expect(callbacks.size).toBe(0);
  });

  it("starts and stops with active and uses a changed offset without duplicating the loop", () => {
    const { result, rerender } = renderHook(({ active, offset }) => useNow(offset, active), { initialProps: { active: false, offset: 0 } });
    rerender({ active: true, offset: 500 });
    vi.setSystemTime(20_000);
    frame();
    expect(result.current).toBe(20_500);
    const requests = request.mock.calls.length;
    rerender({ active: true, offset: 1_000 });
    expect(result.current).toBe(21_000);
    expect(request).toHaveBeenCalledTimes(requests);
    rerender({ active: false, offset: 1_000 });
    expect(callbacks.size).toBe(0);
    frame();
    expect(request).toHaveBeenCalledTimes(requests);
    rerender({ active: true, offset: 1_000 });
    expect(callbacks.size).toBe(1);
  });
});
