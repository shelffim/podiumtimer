import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_LOOP_TICKS, DEMO_STILL, DEMO_TICK_MS, demoFrame } from "@/lib/demo";
import { useDemoFrame } from "./useDemoFrame";

function mockMotion(reduced = false) {
  const events = new EventTarget();
  const media = {
    matches: reduced,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  return {
    media,
    change(matches: boolean) {
      act(() => {
        media.matches = matches;
        events.dispatchEvent(new Event("change"));
      });
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useDemoFrame", () => {
  it("starts with the still frame and plays from tick zero after 250ms", () => {
    mockMotion();
    const { result } = renderHook(useDemoFrame);
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(result.current).toBe(DEMO_STILL);
    act(() => vi.advanceTimersByTime(DEMO_TICK_MS - 1));
    expect(result.current).toBe(DEMO_STILL);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toEqual(demoFrame(0));
    act(() => vi.advanceTimersByTime(DEMO_TICK_MS));
    expect(result.current).toEqual(demoFrame(1));
  });

  it("repeats the nine-second scene", () => {
    mockMotion();
    const { result } = renderHook(useDemoFrame);
    act(() => vi.advanceTimersByTime(DEMO_TICK_MS * (DEMO_LOOP_TICKS + 1)));
    expect(result.current).toEqual(demoFrame(0));
  });

  it("stays still without a timer when reduced motion is preferred", () => {
    mockMotion(true);
    const { result } = renderHook(useDemoFrame);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current).toBe(DEMO_STILL);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stays still when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(useDemoFrame);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current).toBe(DEMO_STILL);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops immediately on reduced motion and restarts at tick zero when allowed", () => {
    const motion = mockMotion();
    const { result } = renderHook(useDemoFrame);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toEqual(demoFrame(3));
    motion.change(true);
    expect(result.current).toBe(DEMO_STILL);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(DEMO_STILL);
    motion.change(false);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(DEMO_TICK_MS));
    expect(result.current).toEqual(demoFrame(0));
  });

  it("cleans up the interval and the same media listener on unmount", () => {
    const { media } = mockMotion();
    const { unmount } = renderHook(useDemoFrame);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(media.removeEventListener).toHaveBeenCalledWith("change", media.addEventListener.mock.calls[0][1]);
  });
});
