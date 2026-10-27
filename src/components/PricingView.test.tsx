import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS, PASS_DAYS, PASS_MS, PASS_PRICE_USD } from "@/lib/billing";
import { MESSAGES, errorMessage } from "@/lib/messages";
import { api } from "@/services/api";
import type { Result } from "@/types/api";
import { PricingView } from "./PricingView";
import { BillingSuccess } from "./BillingSuccess";

const settings = vi.hoisted(() => ({ mode: "mock", assign: vi.fn(), replace: vi.fn() }));
vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return { ...actual, get dataMode() { return settings.mode; } };
});
vi.mock("next/navigation", () => ({ useRouter: () => settings }));

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  settings.mode = "mock";
  const realWindow = window;
  vi.stubGlobal("window", new Proxy(realWindow, {
    get(target, key) {
      return key === "location" ? { assign: settings.assign } : Reflect.get(target, key);
    },
  }));
  await api.signIn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("PricingView", () => {
  it("compares all five benefits using the shared limits and price", async () => {
    render(<PricingView returnTo="/timers/new" />);
    expect(await screen.findByText("무료", { selector: "p" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(within(rows[0]).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["항목", "무료", "30일권"]);
    const expected = [
      ["타이머 수", `${LIMITS.free.timers}개`, LIMITS.pass.timers === Infinity ? "무제한" : `${LIMITS.pass.timers}개`],
      ["타이머 1개당 구간 수", `${LIMITS.free.segments}개`, `${LIMITS.pass.segments}개`],
      ["공유 동시 접속 (발표자 포함)", `${LIMITS.free.seats}명`, `${LIMITS.pass.seats}명`],
      ["공유 링크 만들기", "제한 없음", "제한 없음"],
      ["기록·평균", "제한 없음", "제한 없음"],
    ];
    expected.forEach((cells, index) => expect(Array.from(rows[index + 1].children).map((cell) => cell.textContent)).toEqual(cells));
    expect(screen.getByText(`$${PASS_PRICE_USD}`)).toBeInTheDocument();
    expect(screen.getByText(`${PASS_DAYS}일 · 자동 갱신 없음`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "가짜 결제 ($3.99)" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "돌아가기" })).toHaveAttribute("href", "/timers/new");
  });

  it("passes returnTo to mock checkout, follows its URL, and returns after the pass is reflected", async () => {
    const returnTo = "/timers/demo/run?from=pricing";
    const checkout = vi.spyOn(api, "startCheckout");
    const { unmount } = render(<PricingView returnTo={returnTo} />);
    fireEvent.click(screen.getByRole("button", { name: /가짜 결제/ }));
    await waitFor(() => expect(settings.assign).toHaveBeenCalledWith(`/billing/success?returnTo=${encodeURIComponent(returnTo)}`));
    expect(checkout).toHaveBeenCalledExactlyOnceWith(returnTo);
    const status = await api.getPlanStatus();
    expect(status).toMatchObject({ ok: true, data: { plan: "pass" } });
    unmount();
    render(<BillingSuccess returnTo={returnTo} />);
    await waitFor(() => expect(settings.replace).toHaveBeenCalledWith(returnTo));
    expect(checkout).toHaveBeenCalledTimes(1);
  });

  it("shows pass expiry and explains extension instead of hiding purchase", async () => {
    vi.spyOn(api, "getPlanStatus").mockResolvedValue({ ok: true, data: { plan: "pass", expiresAt: Date.UTC(2026, 10, 24, 15), timerCount: 4 } });
    render(<PricingView returnTo="/timers" />);
    expect(await screen.findByText("30일권 · 11월 25일까지")).toBeInTheDocument();
    expect(screen.getByText("지금 사면 만료일에 30일이 더해져요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /가짜 결제/ })).toBeEnabled();
  });

  it("extends the mock pass on another purchase", async () => {
    await api.startCheckout("/timers");
    const before = await api.getPlanStatus();
    render(<PricingView returnTo="/timers" />);
    fireEvent.click(screen.getByRole("button", { name: /가짜 결제/ }));
    await waitFor(() => expect(settings.assign).toHaveBeenCalledTimes(1));
    const after = await api.getPlanStatus();
    if (!before.ok || !after.ok) throw new Error();
    expect(after.data.expiresAt).toBe(before.data.expiresAt! + PASS_MS);
  });

  it("uses the live purchase label when dataMode is live", () => {
    settings.mode = "live";
    render(<PricingView returnTo="/timers" />);
    expect(screen.getByRole("button", { name: "30일권 구매 $3.99" })).toBeInTheDocument();
  });

  it("shows checkout error codes and lets the user try again", async () => {
    vi.spyOn(api, "startCheckout").mockResolvedValueOnce({ ok: false, code: "UNAUTHENTICATED" });
    render(<PricingView returnTo="/timers" />);
    fireEvent.click(screen.getByRole("button", { name: /가짜 결제/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(errorMessage("UNAUTHENTICATED"));
    expect(settings.assign).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /가짜 결제/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /가짜 결제/ }));
    await waitFor(() => expect(settings.assign).toHaveBeenCalledTimes(1));
  });

  it("prevents duplicate purchases while checkout is pending", async () => {
    let resolve!: (result: Result<{ url: string }>) => void;
    const checkout = vi.spyOn(api, "startCheckout").mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<PricingView returnTo="/timers" />);
    const button = screen.getByRole("button", { name: /가짜 결제/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(checkout).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, data: { url: "/billing/success" } }));
    expect(settings.assign).toHaveBeenCalledExactlyOnceWith("/billing/success");
  });

  it.each(["status", "checkout"])("reports a rejected %s request", async (operation) => {
    if (operation === "status") vi.spyOn(api, "getPlanStatus").mockRejectedValueOnce(new Error());
    else vi.spyOn(api, "startCheckout").mockRejectedValueOnce(new Error());
    render(<PricingView returnTo="/timers" />);
    if (operation === "checkout") fireEvent.click(screen.getByRole("button", { name: /가짜 결제/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.appError.title);
    expect(settings.assign).not.toHaveBeenCalled();
  });

  it("reports a failed plan status read", async () => {
    vi.spyOn(api, "getPlanStatus").mockResolvedValueOnce({ ok: false, code: "UNAUTHENTICATED" });
    render(<PricingView returnTo="/timers" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(errorMessage("UNAUTHENTICATED"));
  });

  it.each(["https://example.com", "//example.com", "/\\example.com"])("sanitizes unsafe returnTo %s", async (returnTo) => {
    const checkout = vi.spyOn(api, "startCheckout");
    render(<PricingView returnTo={returnTo} />);
    expect(screen.getByRole("link", { name: "돌아가기" })).toHaveAttribute("href", "/timers");
    fireEvent.click(screen.getByRole("button", { name: /가짜 결제/ }));
    await waitFor(() => expect(checkout).toHaveBeenCalledWith("/timers"));
  });
});
