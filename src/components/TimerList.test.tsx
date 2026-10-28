import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES, planLimitMessage } from "@/lib/messages";
import { api } from "@/services/api";
import { TimerList } from "./TimerList";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  await api.signIn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function createTimers(count: number) {
  for (let i = 0; i < count; i++) await api.createTimer({ name: `발표 ${i}`, segments: [{ id: `s${i}`, name: "도입", durationSec: 65 }] });
}

describe("TimerList", () => {
  it("shows free 2/3 usage, duration and row destinations", async () => {
    await createTimers(2);
    render(<TimerList />);
    expect(await screen.findByRole("button", { name: /새 타이머.*2\/3/ })).toBeEnabled();
    expect(screen.getByText("무료")).toBeInTheDocument();
    const row = screen.getByText("발표 0").closest("li")!;
    const timers = await api.listTimers();
    if (!timers.ok) throw new Error();
    expect(within(row).getByText("1구간 · 합계 1:05")).toBeInTheDocument();
    for (const [name, suffix] of [["시작", "/run"], ["편집", ""], ["기록", "/records"]]) {
      expect(within(row).getByRole("link", { name })).toHaveAttribute("href", `/timers/${timers.data[0].id}${suffix}`);
    }
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("link", { name: "30일권 구매" }));
    expect(screen.getByRole("link", { name: "30일권 구매" })).toHaveAttribute("href", "/pricing?returnTo=/timers");
    expect(screen.getByRole("heading", { level: 1, name: "내 타이머" })).toBeInTheDocument();
  });

  it("keeps new timer enabled at three timers and shows an inline upgrade notice", async () => {
    await createTimers(3);
    const user = userEvent.setup();
    render(<TimerList />);
    const button = await screen.findByRole("button", { name: /새 타이머/ });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(screen.getByRole("status")).toHaveTextContent(planLimitMessage("PLAN_LIMIT_TIMERS", "free"));
    expect(screen.getByRole("link", { name: "30일권 보기" })).toHaveAttribute("href", "/pricing?returnTo=/timers");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });

  it("opens creation from the empty state, which replaces the header button", async () => {
    const user = userEvent.setup();
    render(<TimerList />);
    expect(await screen.findByText("첫 타이머를 만들어 보세요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /새 타이머/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "첫 타이머 만들기" }));
    expect(navigation.push).toHaveBeenCalledWith("/timers/new");
  });

  it("shows a pass expiry and allows new timers beyond free usage", async () => {
    await createTimers(3);
    await api.startCheckout("/timers");
    const user = userEvent.setup();
    render(<TimerList />);
    expect(await screen.findByText(/30일권 · \d+월 \d+일까지/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "새 타이머" }));
    expect(navigation.push).toHaveBeenCalledWith("/timers/new");
  });

  it("signs out before returning home", async () => {
    const user = userEvent.setup();
    render(<TimerList />);
    await user.click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
    expect(await api.getUser()).toBeNull();
  });

  it("redirects an unauthenticated read", async () => {
    await api.signOut();
    render(<TimerList />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
  });

  it("reports a failed read", async () => {
    vi.spyOn(api, "listTimers").mockRejectedValueOnce(new Error());
    render(<TimerList />);
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.appError.title);
  });
});
