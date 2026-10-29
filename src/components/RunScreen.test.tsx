import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { createIdleRun, STALE_RUN_MS } from "@/lib/timer";
import { api, device } from "@/services/api";
import type { LocalRun } from "@/types/run";
import type { Timer } from "@/types/timer";
import { RunScreen } from "./RunScreen";
import { joinShareChannel } from "@/services/realtime";
import type { PresenceMember } from "@/types/share";

vi.mock("@/services/api", async (importOriginal) => importOriginal());
vi.mock("@/services/realtime", () => ({ joinShareChannel: vi.fn() }));
let emitPresence: (members: PresenceMember[]) => void;
const leave = vi.fn(async () => {});
const sendChanged = vi.fn(async () => {});

const segments = [{ id: "s1", name: "도입", durationSec: 60 }, { id: "s2", name: "결론", durationSec: 30 }];
let timer: Timer;
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(1_000_000); localStorage.clear();
  leave.mockClear(); sendChanged.mockClear();
  vi.mocked(joinShareChannel).mockImplementation(() => ({
    onChanged: () => () => {}, onPresence: (handler) => { emitPresence = handler; return () => {}; },
    track: async () => {}, sendChanged, leave,
  }));
  await api.signIn();
  const created = await api.createTimer({ name: "수업 발표", segments });
  if (!created.ok) throw new Error(); timer = created.data;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
async function flush() { await act(async () => {}); }
async function open() { render(<RunScreen timerId={timer.id} />); await flush(); }
function local() { return device.loadRun(timer.id)!; }
function click(name: string) { fireEvent.click(screen.getByRole("button", { name })); }
function space() { fireEvent.keyDown(document, { code: "Space", key: " " }); }
function tick(ms: number) { act(() => { vi.advanceTimersByTime(ms); }); }
function tap(target: Element) {
  fireEvent.pointerDown(target, { pointerType: "touch", pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerUp(target, { pointerType: "touch", pointerId: 1, clientX: 0, clientY: 0 });
}
async function finish() { space(); tick(500); space(); tick(500); space(); await flush(); }
function saved(status: "running" | "finished" | "aborted", extra: Partial<LocalRun> = {}): LocalRun {
  return { segments, shareCode: "existing-share", run: {
    status, startedAt: Date.now() - 20_000,
    transitions: status === "finished" ? [Date.now() - 10_000, Date.now()] : [], rev: 3,
  }, ...extra };
}

describe("RunScreen sharing", () => {
  it("creates and persists one idle share, then syncs running and finished states; restart leaves", async () => {
    const create = vi.spyOn(api, "createShare"); const update = vi.spyOn(api, "updateShareState");
    await open(); click("공유 링크 만들기"); await flush();
    const code = local().shareCode!;
    expect(create).toHaveBeenCalledExactlyOnceWith(timer.id);
    expect(local().run.status).toBe("idle"); expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(code)).toBeInTheDocument();
    act(() => emitPresence([
      { clientId: "a", nickname: "학생1", role: "viewer", joinedAt: 1 },
      { clientId: "b", nickname: "학생2", role: "viewer", joinedAt: 2 },
    ]));
    expect(screen.getByText(/자리가 가득 찼어요/)).toBeInTheDocument();
    click("시작"); await flush();
    const count = screen.getByText("3/3"); expect(count.closest("[data-no-advance]")).not.toBeNull();
    tap(count); expect(local().run.transitions).toEqual([]);
    expect(screen.queryByText(/자리가 가득 찼어요/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "공유 링크 만들기" })).not.toBeInTheDocument();
    expect(update).toHaveBeenLastCalledWith(code, local().run, { segments });
    await finish(); expect(update).toHaveBeenLastCalledWith(code, local().run, undefined);
    expect(local().run.status).toBe("finished"); expect(leave).not.toHaveBeenCalled();
    expect(screen.getByText(`${MESSAGES.run.saved} · ${MESSAGES.run.sharedRestart}`)).toBeInTheDocument();
    click("다시 하기"); await flush(); expect(leave).toHaveBeenCalledOnce();
    expect(local().shareCode).toBeNull(); expect(screen.getByRole("button", { name: "공유 링크 만들기" })).toBeInTheDocument();
  });
  it("shows failed sharing and retries latest abort state without recording it", async () => {
    vi.spyOn(api, "updateShareState").mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
    const save = vi.spyOn(api, "saveRecord");
    await open(); click("공유 링크 만들기"); await flush(); click("시작"); await flush();
    expect(screen.getByText("공유 연결 끊김").closest("[data-no-advance]")).not.toBeNull();
    click("중단"); fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "중단" })); await flush();
    expect(api.updateShareState).toHaveBeenLastCalledWith(local().shareCode, local().run, { segments });
    expect(local().run.status).toBe("aborted"); expect(save).not.toHaveBeenCalled();
  });
  it.each(["failure", "exception"])("shows a creation %s without changing local state", async (mode) => {
    const create = vi.spyOn(api, "createShare");
    if (mode === "failure") create.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
    else create.mockRejectedValueOnce(new Error());
    await open(); click("공유 링크 만들기"); await flush();
    expect(screen.getByRole("alert")).toHaveTextContent(mode === "failure" ? MESSAGES.errors.NOT_FOUND : MESSAGES.appError.title);
    expect(device.loadRun(timer.id)).toBeNull();
  });
  it("does not create duplicate links while awaiting creation or attach a late link after start", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.createShare>>) => void;
    const create = vi.spyOn(api, "createShare").mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await open(); click("공유 링크 만들기"); click("공유 링크 만들기"); click("시작");
    await act(async () => resolve({ ok: true, data: { code: "late", seatCap: 3 } }));
    expect(create).toHaveBeenCalledOnce(); expect(local().shareCode).toBeNull(); expect(local().run.status).toBe("running");
  });
});

describe("RunScreen", () => {
  it("shows current segments, total, a full-width start, a back link and the footer", async () => {
    render(<RunScreen timerId={timer.id} contactEmail="help@example.test" />); await flush();
    expect(screen.getByRole("heading", { level: 1, name: timer.name })).toBeInTheDocument();
    expect(screen.getByText("구간 2개")).toBeInTheDocument();
    expect(screen.getByText("합계 1:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시작" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "시작" }).parentElement).toHaveClass("sticky", "bottom-0");
    expect(screen.getByRole("button", { name: "시작" }).parentElement).toContainElement(screen.getByText(MESSAGES.run.startHint));
    expect(screen.getByRole("link", { name: MESSAGES.common.back })).toHaveAttribute("href", "/timers");
    expect(screen.getByRole("contentinfo")).toContainElement(screen.getByRole("link", { name: "help@example.test" }));
  });
  it("shows NOT_FOUND with a list link", async () => {
    await api.deleteTimer(timer.id); await open();
    expect(screen.getByText(MESSAGES.timers.notFound)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로" })).toHaveAttribute("href", "/timers");
  });
  it("reports a load exception", async () => {
    vi.spyOn(api, "getTimer").mockRejectedValueOnce(new Error()); await open();
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGES.appError.title);
  });
  it("does not allow starting with zero segments", async () => {
    await api.updateTimer(timer.id, { name: timer.name, segments: [] }); await open();
    expect(screen.queryByRole("button", { name: "시작" })).not.toBeInTheDocument();
    expect(screen.getByText("구간을 추가해야 시작할 수 있어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "편집" })).toHaveClass("btn-primary");
    expect(screen.queryByRole("heading", { name: MESSAGES.share.title })).not.toBeInTheDocument();
    space(); expect(device.loadRun(timer.id)).toBeNull();
  });
  it("starts with a snapshot and corrected time, retaining an idle share code", async () => {
    device.saveRun(timer.id, { segments: [], run: createIdleRun(), shareCode: "existing-share" });
    vi.spyOn(api, "getServerOffset").mockResolvedValue(250);
    await open(); click("시작");
    expect(local()).toEqual({ segments, shareCode: "existing-share", run: { status: "running", startedAt: 1_000_250, transitions: [], rev: 1 } });
    await api.updateTimer(timer.id, { name: timer.name, segments: [{ ...segments[0], name: "수정", durationSec: 120 }] });
    expect(screen.getAllByText("도입")[0]).toBeInTheDocument();
    tick(60_000); space();
    expect(local().run.transitions).toEqual([1_060_250]);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    cleanup(); await open();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("수정")).not.toBeInTheDocument();
  });
  it("advances with the on-screen next button under the same cooldown and labels the last one as finish", async () => {
    await open(); click("시작");
    expect(screen.getByRole("button", { name: "다음" }).closest("[data-no-advance]")).toBeNull();
    click("다음"); space(); expect(local().run.transitions).toHaveLength(1);
    tick(500); click("종료");
    expect(screen.getByText(MESSAGES.timerFace.finishHint)).toBeInTheDocument();
    expect(local().run.status).toBe("running");
  });
  it("ignores a second advance within 500ms and disables undo only without transitions", async () => {
    await open(); click("시작");
    expect(screen.getByRole("button", { name: "되돌리기" })).toBeDisabled();
    space(); tick(499); tap(screen.getByText("마지막 구간"));
    expect(local().run.transitions).toHaveLength(1);
    expect(screen.queryByText(MESSAGES.timerFace.finishHint)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "되돌리기" })).toBeEnabled();
    click("되돌리기");
    expect(local().run.transitions).toEqual([]);
    expect(screen.getByRole("button", { name: "되돌리기" })).toBeDisabled();
  });
  it("ignores header taps, mouse clicks and swipes", async () => {
    await open(); click("시작");
    tap(screen.getByText("1 / 2"));
    fireEvent.click(screen.getAllByText("도입")[0]);
    const target = screen.getAllByText("도입")[0];
    fireEvent.pointerDown(target, { pointerType: "touch", pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(target, { pointerType: "touch", pointerId: 1, clientX: 11, clientY: 0 });
    expect(local().run.transitions).toEqual([]);
    tap(target); expect(local().run.transitions).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveClass("h-dvh", "overflow-hidden", "touch-manipulation", "select-none");
  });
  it("ignores Space while an input is focused", async () => {
    await open(); click("시작");
    const input = document.createElement("input"); document.body.append(input); input.focus();
    space(); expect(local().run.transitions).toEqual([]); input.remove();
  });
  it("first last-segment input only hints, then finishes and saves exactly once", async () => {
    const save = vi.spyOn(api, "saveRecord");
    const persist = vi.spyOn(device, "saveRun");
    await open(); click("시작"); space(); tick(500); space();
    expect(screen.getByText(MESSAGES.timerFace.finishHint)).toBeInTheDocument();
    expect(local().run.status).toBe("running"); expect(save).not.toHaveBeenCalled();
    tick(499); space(); expect(local().run.status).toBe("running");
    tick(1); space(); await flush();
    expect(local().run.status).toBe("finished"); expect(local().shareCode).toBe(null);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(timer.id, 1_000_000, [
      expect.objectContaining({ name: "도입", plannedMs: 60_000, actualMs: 0 }),
      expect.objectContaining({ name: "결론", plannedMs: 30_000, actualMs: 1_000 }),
    ]);
    expect(screen.getByText(MESSAGES.run.saved)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: MESSAGES.run.finished })).toBeInTheDocument();
    expect(screen.getByText(/계획 1:30 \/ 실제 0:01$/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "기록 보기" })).toHaveAttribute("href", `/timers/${timer.id}/records`);
    expect(screen.getByRole("link", { name: "구간 고치기" })).toHaveAttribute("href", `/timers/${timer.id}`);
    expect(screen.getByRole("button", { name: "다시 하기" })).toHaveClass("btn-primary", "btn-lg", "w-full");
    expect(screen.getByText(MESSAGES.run.averageTeaser)).toBeInTheDocument();
    space(); tick(5_000); await flush();
    expect(save).toHaveBeenCalledTimes(1); expect(persist).toHaveBeenCalledTimes(3);
  });
  it("stops teasing the average once a second matching record exists", async () => {
    await open(); click("시작"); await finish();
    expect(screen.getByText(MESSAGES.run.averageTeaser)).toBeInTheDocument();
    click("다시 하기"); await flush(); click("시작"); tick(500); await finish();
    expect(screen.getByText(MESSAGES.run.saved)).toBeInTheDocument();
    expect(screen.queryByText(MESSAGES.run.averageTeaser)).not.toBeInTheDocument();
  });
  it("expires the finish hint after 3 seconds without ending and starts a fresh confirmation", async () => {
    await open(); click("시작"); space(); tick(500); space();
    tick(3_000); expect(screen.queryByText(MESSAGES.timerFace.finishHint)).not.toBeInTheDocument();
    expect(local().run.status).toBe("running");
    space(); expect(screen.getByText(MESSAGES.timerFace.finishHint)).toBeInTheDocument();
    expect(local().run.status).toBe("running");
  });
  it("clears finish confirmation on undo", async () => {
    await open(); click("시작"); space(); tick(500); space(); click("되돌리기");
    expect(screen.queryByText(MESSAGES.timerFace.finishHint)).not.toBeInTheDocument();
    expect(local().run.transitions).toEqual([]);
    tick(500); space(); tick(500); space(); expect(local().run.status).toBe("running");
  });
  it("keeps running when abort confirmation is cancelled; confirmed abort persists without saving", async () => {
    const save = vi.spyOn(api, "saveRecord");
    await open(); click("시작"); click("중단");
    const dialog = screen.getByRole("dialog", { name: MESSAGES.run.abortConfirm });
    space(); expect(local().run.transitions).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: MESSAGES.common.cancel }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(local().run.status).toBe("running");
    click("중단"); fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "중단" }));
    expect(local().run.status).toBe("aborted");
    expect(screen.getByText("발표를 중단했어요")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it.each(["failure", "exception"])("allows retry after save %s", async (mode) => {
    const save = vi.spyOn(api, "saveRecord");
    if (mode === "failure") save.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
    else save.mockRejectedValueOnce(new Error());
    await open(); click("시작"); await finish();
    expect(screen.getByRole("alert")).toHaveTextContent("기록을 저장하지 못했어요");
    click("다시 저장"); await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(screen.getByText(MESSAGES.run.saved)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 저장" })).not.toBeInTheDocument();
  });
  it.each(["finished", "aborted"] as const)("reopens a %s run at the start screen without saving and drops its share", async (status) => {
    const save = vi.spyOn(api, "saveRecord"); device.saveRun(timer.id, saved(status));
    await open();
    expect(screen.getByRole("button", { name: "시작" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: MESSAGES.share.create })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(MESSAGES.run.aborted)).not.toBeInTheDocument();
    expect(device.loadRun(timer.id)).toBeNull(); expect(save).not.toHaveBeenCalled();
  });
  it("discards running older than 12 corrected hours and shows current segments", async () => {
    const clear = vi.spyOn(device, "clearRun");
    vi.spyOn(api, "getServerOffset").mockResolvedValue(500);
    device.saveRun(timer.id, saved("running", { run: { status: "running", startedAt: Date.now() - STALE_RUN_MS, transitions: [], rev: 1 } }));
    await open(); expect(clear).toHaveBeenCalledWith(timer.id);
    expect(screen.getByRole("button", { name: "시작" })).toBeInTheDocument();
    expect(device.loadRun(timer.id)).toBeNull();
  });
  it("keeps a running state exactly 12 hours old", async () => {
    device.saveRun(timer.id, saved("running", { run: { status: "running", startedAt: Date.now() - STALE_RUN_MS, transitions: [], rev: 1 } }));
    await open(); expect(screen.getByRole("button", { name: "중단" })).toBeInTheDocument();
  });
  it("rereads segments and clears share code on restart; idle restoration uses current segments", async () => {
    await open(); click("시작"); await finish();
    const updated = [{ ...segments[0], name: "새 도입", durationSec: 90 }];
    await api.updateTimer(timer.id, { name: "새 발표", segments: updated });
    click("다시 하기"); await flush();
    expect(local()).toEqual({ segments: updated, run: createIdleRun(), shareCode: null });
    expect(screen.getByText("새 도입")).toBeInTheDocument();
    await api.updateTimer(timer.id, { name: timer.name, segments });
    cleanup(); await open(); expect(screen.getAllByText("도입")[0]).toBeInTheDocument();
    click("시작"); expect(local().segments).toEqual(segments);
  });
  it("keeps the result with an error if restart cannot reread the timer", async () => {
    await open(); click("시작"); await finish();
    await api.deleteTimer(timer.id); click("다시 하기"); await flush();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGES.timers.notFound);
    expect(local().run.status).toBe("finished");
  });
  it("keeps the running controls and finish hint clear of the fixed bottom badge", async () => {
    await open(); click("시작");
    expect(screen.getByText(MESSAGES.run.tapHint).parentElement).toHaveClass("pb-12");
    space(); tick(500); space();
    expect(screen.getByText(MESSAGES.timerFace.finishHint)).toHaveClass("bottom-30");
  });
  it("persists only on actions, not on clock frames", async () => {
    const persist = vi.spyOn(device, "saveRun"); await open(); click("시작");
    tick(61_016); expect(persist).toHaveBeenCalledOnce();
    expect(screen.getByText("-0:01")).toHaveClass("text-red-400");
  });
});
