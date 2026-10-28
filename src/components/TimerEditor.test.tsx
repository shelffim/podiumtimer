import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES, planLimitMessage } from "@/lib/messages";
import { api } from "@/services/api";
import type { Segment } from "@/types/timer";
import { TimerEditor } from "./TimerEditor";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
beforeEach(async () => { localStorage.clear(); vi.clearAllMocks(); await api.signIn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const segment = (name: string, index: number): Segment => ({ id: `s${index}`, name, durationSec: 60 });
async function seed(segments = [segment("도입", 0)]) {
  const result = await api.createTimer({ name: "수업 발표", segments });
  if (!result.ok) throw new Error();
  return result.data;
}
async function newForm(clock: string) {
  const user = userEvent.setup();
  render(<TimerEditor />);
  await user.type(await screen.findByLabelText("타이머 이름"), "새 발표");
  await user.type(screen.getByLabelText("구간 1 이름"), "도입");
  await user.type(screen.getByLabelText("구간 1 시간"), clock);
  return user;
}
async function save() { await userEvent.click(screen.getByRole("button", { name: "저장" })); }

describe("TimerEditor", () => {
  it("starts with one empty segment and creates a timer with rehearsal feedback", async () => {
    await newForm("3:00");
    await save();
    const result = await api.listTimers();
    if (!result.ok) throw new Error();
    expect(result.data).toHaveLength(1);
    const timer = result.data[0];
    expect(timer.segments[0]).toMatchObject({ name: "도입", durationSec: 180 });
    expect(timer.segments[0].id).toBeTruthy();
    expect(navigation.replace).toHaveBeenCalledWith(`/timers/${timer.id}`);
    expect(screen.getByRole("status")).toHaveTextContent("저장했어요");
    expect(screen.getByRole("link", { name: "바로 리허설 해보기" })).toHaveAttribute("href", `/timers/${timer.id}/run`);
  });

  it("keeps creation feedback across the editor route remount, then consumes it", async () => {
    await newForm("1:00");
    await save();
    const timers = await api.listTimers();
    if (!timers.ok) throw new Error();
    const timer = timers.data[0];
    cleanup();
    render(<TimerEditor timerId={timer.id} />);
    expect(await screen.findByText("저장했어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "바로 리허설 해보기" })).toHaveAttribute("href", `/timers/${timer.id}/run`);
    cleanup();
    render(<TimerEditor timerId={timer.id} />);
    await screen.findByDisplayValue("새 발표");
    expect(screen.queryByText("저장했어요")).not.toBeInTheDocument();
  });

  it.each(["300", "3:60", ""])("shows a field format error for %s", async (clock) => {
    if (clock) await newForm(clock);
    else { render(<TimerEditor />); await screen.findByLabelText("타이머 이름"); }
    await save();
    expect(screen.getByText(MESSAGES.validation.clockFormat)).toBeInTheDocument();
    expect(screen.getByLabelText("구간 1 시간")).toHaveAccessibleDescription(MESSAGES.validation.clockFormat);
    expect((await api.listTimers())).toEqual({ ok: true, data: [] });
  });

  it("shows a range error for a four second segment", async () => {
    await newForm("0:04");
    await save();
    expect(screen.getByLabelText("구간 1 시간")).toHaveAccessibleDescription(MESSAGES.validation.durationRange);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("maps schema name issues to the relevant fields", async () => {
    render(<TimerEditor />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("구간 1 시간"), "3:00");
    await save();
    expect(screen.getByLabelText("타이머 이름")).toHaveAccessibleDescription(MESSAGES.validation.nameRequired);
    expect(screen.getByLabelText("구간 1 이름")).toHaveAccessibleDescription(MESSAGES.validation.nameRequired);
  });

  it("adds an eleventh segment and shows the free limit only on save", async () => {
    const timer = await seed(Array.from({ length: 10 }, (_, i) => segment(`구간 ${i}`, i)));
    const user = userEvent.setup();
    render(<TimerEditor timerId={timer.id} />);
    await screen.findByDisplayValue("수업 발표");
    const add = screen.getByRole("button", { name: "구간 추가" });
    expect(add).toBeEnabled();
    await user.click(add);
    await user.type(screen.getByLabelText("구간 11 이름"), "마무리");
    await user.type(screen.getByLabelText("구간 11 시간"), "1:00");
    expect(screen.queryByText(planLimitMessage("PLAN_LIMIT_SEGMENTS", "free"))).not.toBeInTheDocument();
    await save();
    expect(screen.getByRole("status")).toHaveTextContent(planLimitMessage("PLAN_LIMIT_SEGMENTS", "free"));
    expect(screen.getByRole("link", { name: "30일권 보기" })).toHaveAttribute("href", `/pricing?returnTo=${encodeURIComponent(`/timers/${timer.id}`)}`);
    expect(add).toBeEnabled();
    expect(await api.getTimer(timer.id)).toEqual({ ok: true, data: timer });
  });

  it.each(["위로", "아래로"])("preserves segment IDs and saves the order after moving %s", async (direction) => {
    const timer = await seed([segment("도입", 0), segment("본론", 1), segment("결론", 2)]);
    const user = userEvent.setup();
    render(<TimerEditor timerId={timer.id} />);
    await screen.findByDisplayValue("수업 발표");
    await user.click(screen.getAllByRole("button", { name: direction })[1]);
    await save();
    const saved = await api.getTimer(timer.id);
    if (!saved.ok) throw new Error();
    expect(saved.data.segments.map((s) => s.id)).toEqual(direction === "위로" ? ["s1", "s0", "s2"] : ["s0", "s2", "s1"]);
    expect(screen.getByText("전체 3:00")).toBeInTheDocument();
  });

  it("allows saving zero segments", async () => {
    const timer = await seed();
    const user = userEvent.setup();
    render(<TimerEditor timerId={timer.id} />);
    await screen.findByDisplayValue("수업 발표");
    await user.click(screen.getByRole("button", { name: "삭제" }));
    await save();
    expect(await api.getTimer(timer.id)).toEqual({ ok: true, data: { ...timer, segments: [] } });
  });

  it("keeps the timer when delete confirmation is canceled", async () => {
    const timer = await seed();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<TimerEditor timerId={timer.id} />);
    await user.click(await screen.findByRole("button", { name: "타이머 삭제" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("기록과 공유 링크도 함께 지워져요"));
    expect(await api.getTimer(timer.id)).toEqual({ ok: true, data: timer });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("deletes a confirmed timer and returns to the list", async () => {
    const timer = await seed();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<TimerEditor timerId={timer.id} />);
    await user.click(await screen.findByRole("button", { name: "타이머 삭제" }));
    expect(await api.getTimer(timer.id)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(navigation.replace).toHaveBeenCalledWith("/timers");
  });

  it("shows the missing timer message and list link", async () => {
    render(<TimerEditor timerId="missing" />);
    expect(await screen.findByText("타이머를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로" })).toHaveAttribute("href", "/timers");
  });

  it("handles a create limit race via the API", async () => {
    await newForm("1:00");
    await seed(); await seed(); await seed();
    await save();
    expect(screen.getByRole("status")).toHaveTextContent(planLimitMessage("PLAN_LIMIT_TIMERS", "free"));
    expect(screen.getByRole("link", { name: "30일권 보기" })).toHaveAttribute("href", "/pricing?returnTo=%2Ftimers%2Fnew");
  });

  it("redirects unauthenticated reads and writes", async () => {
    await newForm("1:00");
    await api.signOut();
    await save();
    expect(navigation.replace).toHaveBeenCalledWith("/");
    cleanup(); navigation.replace.mockClear();
    render(<TimerEditor timerId="missing" />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
  });

  it("reports a failed save and permits retrying", async () => {
    await newForm("1:00");
    vi.spyOn(api, "createTimer").mockRejectedValueOnce(new Error());
    await save();
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGES.appError.title);
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
    await save();
    expect(screen.getByText("저장했어요")).toBeInTheDocument();
  });
});
