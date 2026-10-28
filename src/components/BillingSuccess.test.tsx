import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import type { PlanStatus, Result } from "@/types/api";
import { BillingSuccess } from "./BillingSuccess";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/services/api", () => ({ api: {
  getPlanStatus: vi.fn(), startCheckout: vi.fn(), createTimer: vi.fn(), updateTimer: vi.fn(),
  deleteTimer: vi.fn(), saveRecord: vi.fn(), deleteRecord: vi.fn(), createShare: vi.fn(),
  updateShareState: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
} }));

const free: Result<PlanStatus> = { ok: true, data: { plan: "free", expiresAt: null, timerCount: 0 } };
const pass: Result<PlanStatus> = { ok: true, data: { plan: "pass", expiresAt: 100_000, timerCount: 0 } };
const status = vi.mocked(api.getPlanStatus);
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  status.mockResolvedValue(free);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("BillingSuccess", () => {
  it("immediately reads the plan and returns when it is already active", async () => {
    status.mockResolvedValue(pass);
    render(<BillingSuccess returnTo="/timers/demo/run?from=pricing" />);
    expect(screen.getByText("30일권 반영 중")).toBeInTheDocument();
    expect(screen.getByText("결제를 확인하고 있어요. 몇 초면 끝나요")).toBeInTheDocument();
    expect(status).toHaveBeenCalledTimes(1);
    await tick();
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/timers/demo/run?from=pricing");
    await tick(30_000);
    expect(status).toHaveBeenCalledTimes(1);
  });

  it("polls every two seconds and stops as soon as the pass is reflected", async () => {
    status.mockResolvedValueOnce(free).mockResolvedValueOnce(free).mockResolvedValue(pass);
    render(<BillingSuccess returnTo="/timers/new" />);
    await tick(1_999);
    expect(status).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(status).toHaveBeenCalledTimes(2);
    expect(navigation.replace).not.toHaveBeenCalled();
    await tick(2_000);
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/timers/new");
    await tick(20_000);
    expect(status).toHaveBeenCalledTimes(3);
  });

  it("checks at most ten times, shows the delay notice, then returns to timers after three seconds", async () => {
    render(<BillingSuccess returnTo="/timers/new" />);
    await tick(17_999);
    expect(status).toHaveBeenCalledTimes(9);
    expect(screen.queryByText("결제는 완료됐어요")).not.toBeInTheDocument();
    await tick(1);
    expect(status).toHaveBeenCalledTimes(10);
    expect(screen.getByRole("status")).toHaveTextContent("결제는 완료됐어요");
    expect(screen.getByRole("status")).toHaveTextContent("반영이 늦어지고 있어요");
    expect(screen.queryByText("30일권 반영 중")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "타이머 목록" })).toHaveAttribute("href", "/timers");
    await tick(2_999);
    expect(navigation.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/timers");
    await tick(20_000);
    expect(status).toHaveBeenCalledTimes(10);
  });

  it("accepts activation on the tenth check", async () => {
    for (let i = 0; i < 9; i++) status.mockResolvedValueOnce(free);
    status.mockResolvedValue(pass);
    render(<BillingSuccess returnTo="/timers/new" />);
    await tick(18_000);
    expect(status).toHaveBeenCalledTimes(10);
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/timers/new");
    expect(screen.queryByText("결제는 완료됐어요")).not.toBeInTheDocument();
  });

  it("counts rejected and unsuccessful reads toward the same retry limit", async () => {
    status.mockRejectedValueOnce(new Error()).mockResolvedValue({ ok: false, code: "UNAUTHENTICATED" });
    render(<BillingSuccess returnTo="/timers/new" />);
    await tick(18_000);
    expect(status).toHaveBeenCalledTimes(10);
    expect(screen.getByRole("status")).toHaveTextContent("결제는 완료됐어요");
  });

  it("only reads plan status and never calls checkout or write methods", async () => {
    render(<BillingSuccess returnTo="/timers/new" />);
    await tick(21_000);
    for (const [name, method] of Object.entries(api)) {
      if (name !== "getPlanStatus") expect(method).not.toHaveBeenCalled();
    }
  });

  it("does not overlap slow reads", async () => {
    let resolve!: (result: Result<PlanStatus>) => void;
    status.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<BillingSuccess returnTo="/timers" />);
    await tick(10_000);
    expect(status).toHaveBeenCalledTimes(1);
    await act(async () => resolve(free));
    await tick(2_000);
    expect(status).toHaveBeenCalledTimes(2);
  });

  it.each(["poll", "redirect"])("clears the pending %s timer on unmount", async (phase) => {
    const { unmount } = render(<BillingSuccess returnTo="/timers/new" />);
    await tick(phase === "poll" ? 0 : 18_000);
    const calls = status.mock.calls.length;
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await tick(30_000);
    expect(status).toHaveBeenCalledTimes(calls);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("ignores an in-flight response after unmount", async () => {
    let resolve!: (result: Result<PlanStatus>) => void;
    status.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { unmount } = render(<BillingSuccess returnTo="/timers/new" />);
    unmount();
    await act(async () => resolve(pass));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sanitizes an unsafe return destination", async () => {
    status.mockResolvedValue(pass);
    render(<BillingSuccess returnTo="//example.com" />);
    await tick();
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/timers");
  });
});
