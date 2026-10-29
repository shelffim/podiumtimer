import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { createIdleRun } from "@/lib/timer";
import { api, device } from "@/services/api";
import { joinShareChannel, type ShareChannel } from "@/services/realtime";
import type { RunState } from "@/types/run";
import type { PresenceMember, ShareView } from "@/types/share";
import { ViewerScreen } from "./ViewerScreen";

vi.mock("@/services/api", () => ({
  api: { getShare: vi.fn(), getServerOffset: vi.fn() },
  device: { getClientId: () => "me", loadNickname: vi.fn(), hasJoined: vi.fn(), saveNickname: vi.fn(), markJoined: vi.fn() },
}));
vi.mock("@/services/realtime", () => ({ joinShareChannel: vi.fn() }));
const segments = [{ id: "a", name: "도입", durationSec: 60 }, { id: "b", name: "결론", durationSec: 30 }];
let share: ShareView;
let changed: () => void;
let presence: (members: PresenceMember[]) => void;
let channel: ShareChannel;
async function flush() { await act(async () => {}); }
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function open(auto = false) {
  vi.mocked(device.hasJoined).mockReturnValue(auto);
  render(<ViewerScreen code="code" />); await flush();
}
async function enter() {
  fireEvent.change(screen.getByRole("textbox", { name: "닉네임" }), { target: { value: "학생" } });
  fireEvent.click(screen.getByRole("button", { name: "입장" })); await flush();
}
async function update(state: RunState) {
  share = { ...share, state, rev: state.rev }; act(() => changed()); await tick(1_000);
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(50_000); vi.resetAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  share = { timerName: "토론 연습", segments, seatCap: 3, state: createIdleRun(), rev: 0 };
  vi.mocked(api.getShare).mockImplementation(async () => ({ ok: true, data: share }));
  vi.mocked(api.getServerOffset).mockResolvedValue(200);
  vi.mocked(device.loadNickname).mockReturnValue("지난 닉네임");
  channel = {
    onChanged: vi.fn((handler) => { changed = handler; return vi.fn(); }),
    onPresence: vi.fn((handler) => { presence = handler; return vi.fn(); }),
    track: vi.fn().mockResolvedValue(undefined), sendChanged: vi.fn(), leave: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(joinShareChannel).mockReturnValue(channel);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ViewerScreen", () => {
  it("loads without login, prefills the saved nickname and waits for entry", async () => {
    await open();
    expect(api.getServerOffset).toHaveBeenCalledOnce(); expect(api.getShare).toHaveBeenCalledWith("code");
    expect(screen.getByRole("heading", { name: "토론 연습" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "닉네임" })).toHaveValue("지난 닉네임");
    expect(joinShareChannel).not.toHaveBeenCalled();
  });
  it("validates and sanitizes nicknames before saving and marking entry", async () => {
    await open(); const input = screen.getByRole("textbox", { name: "닉네임" });
    fireEvent.change(input, { target: { value: "   " } }); fireEvent.click(screen.getByRole("button", { name: "입장" }));
    expect(screen.getByRole("alert")).toHaveTextContent("닉네임은 1자부터 20자까지 입력해 주세요");
    expect(input).toHaveAttribute("aria-invalid", "true"); expect(device.saveNickname).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  학\u200b생  " } }); fireEvent.click(screen.getByRole("button", { name: "입장" })); await flush();
    expect(device.saveNickname).toHaveBeenCalledWith("학생"); expect(device.markJoined).toHaveBeenCalledWith("code");
    expect(channel.track).toHaveBeenCalledWith({ nickname: "학생", role: "viewer", joinedAt: 50_200 });
    expect(vi.mocked(device.saveNickname).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(device.markJoined).mock.invocationCallOrder[0]);
    expect(vi.mocked(device.markJoined).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(channel.track).mock.invocationCallOrder[0]);
    expect(screen.getByText("발표자가 시작하면 자동으로 시작돼요")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("학생");
    expect(screen.getByText("대기실")).toBeInTheDocument();
    expect(screen.getByText("구간 2개")).toBeInTheDocument(); expect(screen.getByText("합계 1:30")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
  it("automatically rejoins only this code with a valid saved nickname", async () => {
    await open(true); expect(device.hasJoined).toHaveBeenCalledWith("code");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(channel.track).toHaveBeenCalledWith(expect.objectContaining({ nickname: "지난 닉네임" }));
    expect(device.markJoined).not.toHaveBeenCalled();
  });
  it.each([null, "   ", "가".repeat(21)])("requires a nickname if the saved value %s is invalid", async (nickname) => {
    vi.mocked(device.loadNickname).mockReturnValue(nickname); await open(true);
    expect(screen.getByRole("textbox", { name: "닉네임" })).toBeInTheDocument(); expect(joinShareChannel).not.toHaveBeenCalled();
  });
  it("shows a missing link before entry", async () => {
    vi.mocked(api.getShare).mockResolvedValue({ ok: false, code: "NOT_FOUND" }); await open();
    expect(screen.getByText("존재하지 않는 링크예요")).toBeInTheDocument(); expect(joinShareChannel).not.toHaveBeenCalled();
  });
  it("changes from idle to running to finished using the shared snapshot, without viewer controls", async () => {
    await open(); await enter();
    expect(screen.getByText("발표자가 시작하면 자동으로 시작돼요")).toBeInTheDocument();
    expect(screen.getByText("구간 2개")).toBeInTheDocument(); expect(screen.getByText("합계 1:30")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-block]")).toHaveLength(2);
    const running: RunState = { status: "running", startedAt: Date.now() + 200, transitions: [], rev: 1 };
    await update(running);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("h-dvh", "overflow-hidden", "pb-12");
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(screen.queryByText(/접속/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("1 / 2")); fireEvent.touchStart(screen.getByRole("main")); fireEvent.touchEnd(screen.getByRole("main"));
    fireEvent.keyDown(document, { key: " ", code: "Space" }); await flush();
    expect(screen.getByText("1 / 2")).toBeInTheDocument(); expect(channel.sendChanged).not.toHaveBeenCalled();
    await update({ ...running, status: "finished", transitions: [running.startedAt! + 72_000, running.startedAt! + 94_000], rev: 2 });
    expect(screen.getByRole("heading", { name: "발표가 끝났어요" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument(); expect(screen.getByText("0:12 늦음")).toHaveClass("text-red-400");
    expect(screen.getByText("0:08 빠름")).toHaveClass("text-blue-400"); expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(MESSAGES.viewer.finishedHint)).toBeInTheDocument();
  });
  it.each(["running", "finished", "aborted"] as const)("shows %s when entering a link after that state", async (status) => {
    share = { ...share, state: { status, startedAt: 10_000, transitions: status === "finished" ? [20_000, 30_000] : [], rev: 3 }, rev: 3 };
    await open(true);
    if (status === "running") expect(screen.getByText("1 / 2")).toBeInTheDocument();
    if (status === "finished") expect(screen.getByRole("table")).toBeInTheDocument();
    if (status === "aborted") expect(screen.getByText("발표가 중단되었어요")).toBeInTheDocument();
  });
  it("transitions to aborted and to missing after the timer is deleted", async () => {
    await open(true); await update({ status: "aborted", startedAt: 10_000, transitions: [], rev: 1 });
    expect(screen.getByText("발표가 중단되었어요")).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.viewer.abortedHint)).toBeInTheDocument();
    vi.mocked(api.getShare).mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" }); act(() => changed()); await tick(1_000);
    expect(screen.getByText("존재하지 않는 링크예요")).toBeInTheDocument();
  });
  it("shows full (3/3) and leaves when this viewer arrives fourth", async () => {
    await open(true);
    act(() => presence([1, 2, 3, 4].map((n) => ({ clientId: n === 4 ? "me" : `v${n}`, nickname: "학생", role: "viewer", joinedAt: n }))));
    expect(screen.getByText("인원이 가득 찼어요 (3/3)")).toBeInTheDocument(); expect(channel.leave).toHaveBeenCalledOnce();
  });
  it("shows connection loss while preserving the last view and recovers after retry", async () => {
    await open(true); vi.mocked(api.getShare).mockRejectedValueOnce(new Error());
    await act(async () => changed());
    expect(screen.getByText("연결 끊김")).toHaveAttribute("role", "status");
    expect(screen.getByText("발표자가 시작하면 자동으로 시작돼요")).toBeInTheDocument();
    await tick(1_000); expect(screen.queryByText("연결 끊김")).not.toBeInTheDocument();
  });
  it("does not show an old link or nickname after the code changes", async () => {
    vi.mocked(device.hasJoined).mockReturnValue(true);
    const { rerender } = render(<ViewerScreen code="code" />); await flush();
    vi.mocked(device.hasJoined).mockReturnValue(false); share = { ...share, timerName: "새 발표" };
    rerender(<ViewerScreen code="second" />); await flush();
    expect(screen.getByRole("heading", { name: "새 발표" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "닉네임" })).toBeInTheDocument(); expect(channel.leave).toHaveBeenCalledOnce();
  });
});
