import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES, recordDateLabel } from "@/lib/messages";
import { api } from "@/services/api";
import type { Result } from "@/types/api";
import { RecordsView } from "./RecordsView";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const older = Date.UTC(2026, 9, 26, 5, 5);
const newer = Date.UTC(2026, 9, 27, 5, 5);
function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.code);
  return result.data;
}
async function seedTimer() {
  return unwrap(await api.createTimer({ name: "수업 발표", segments: [{ id: "intro", name: "도입", durationSec: 60 }] }));
}
async function seedRecord(timerId: string, startedAt: number, actualMs = 72_000, name = "도입") {
  return unwrap(await api.saveRecord(timerId, startedAt, [{ name, plannedMs: 60_000, actualMs }]));
}
beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  await api.signIn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
type User = ReturnType<typeof userEvent.setup>;
async function openDelete(user: User, index = 0) {
  const toggle = (await screen.findAllByRole("button", { name: /\d+월 \d+일/ }))[index];
  if (toggle.getAttribute("aria-expanded") === "false") await user.click(toggle);
  await user.click(screen.getByRole("button", { name: "이 기록 삭제" }));
  return screen.getByRole("dialog", { name: "이 기록을 삭제할까요?" });
}
async function confirmDelete(user: User, index = 0) {
  await user.click(within(await openDelete(user, index)).getByRole("button", { name: "삭제" }));
}

describe("RecordsView", () => {
  it("shows the timer title, start link and empty guidance", async () => {
    const timer = await seedTimer();
    render(<RecordsView timerId={timer.id} />);
    expect(await screen.findByRole("heading", { name: "수업 발표" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "기록" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "시작" })).toHaveAttribute("href", `/timers/${timer.id}/run`);
    expect(screen.getByRole("link", { name: MESSAGES.common.back })).toHaveAttribute("href", "/timers");
    expect(screen.getByText("기록 0개")).toBeInTheDocument();
    expect(screen.getByText("아직 기록이 없어요")).toBeInTheDocument();
    expect(screen.getByText("마지막 구간까지 끝낸 발표가 여기에 쌓여요")).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.records.averageEmpty)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "구간별 평균" })).not.toBeInTheDocument();
  });

  it("shows a missing timer and a list link", async () => {
    render(<RecordsView timerId="missing" />);
    expect(await screen.findByText("타이머를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로" })).toHaveAttribute("href", "/timers");
  });

  it("lists newest first with totals and the whole-run verdict, expanding one record in place", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older);
    await seedRecord(timer.id, newer, 52_000);
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    const latest = await screen.findByRole("button", { name: recordDateLabel(newer) });
    const toggles = screen.getAllByRole("button", { expanded: false });
    expect(toggles.map((button) => button.querySelector("time")!.textContent)).toEqual([recordDateLabel(newer), recordDateLabel(older)]);
    const row = latest.closest("li")!;
    expect(latest).toHaveAccessibleDescription("실제 0:52 · 계획 1:00 0:08 빠름");
    expect(within(row).getByText("0:08 빠름")).toHaveClass("text-blue-400", "verdict");
    expect(within(toggles[1].closest("li")!).getByText("0:12 늦음")).toHaveClass("text-red-400");
    expect(within(row).queryByRole("table")).not.toBeInTheDocument();
    await user.click(latest);
    expect(latest).toHaveAttribute("aria-expanded", "true");
    expect(within(within(row).getByRole("table")).getByText("0:08 빠름")).toBeInTheDocument();
    expect(document.getElementById(latest.getAttribute("aria-controls")!)).toContainElement(within(row).getByRole("table"));
    await user.click(toggles[1]);
    expect(latest).toHaveAttribute("aria-expanded", "false");
    expect(within(row).queryByRole("table")).not.toBeInTheDocument();
    await user.click(toggles[1]);
    expect(toggles[1]).toHaveAttribute("aria-expanded", "false");
  });

  it("requires two matching records before showing averages", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older);
    await seedRecord(timer.id, newer, 200_000, "다른 구간");
    render(<RecordsView timerId={timer.id} />);
    await screen.findByRole("heading", { name: "수업 발표" });
    expect(screen.queryByRole("region", { name: "구간별 평균" })).not.toBeInTheDocument();
  });

  it("shows averages for two matching records on the free plan and excludes other configurations", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older, 72_000);
    await seedRecord(timer.id, newer, 76_000);
    await seedRecord(timer.id, newer + 1000, 200_000, "다른 구간");
    render(<RecordsView timerId={timer.id} />);
    const average = await screen.findByRole("region", { name: "구간별 평균" });
    expect(within(average).getByText("같은 구간 구성의 기록 2개")).toBeInTheDocument();
    const cells = within(average).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["도입", "1:00", "1:14", "0:14 늦음"]);
    expect(within(average).getByRole("list", { name: "평균 차이 막대그래프" })).toBeInTheDocument();
    expect(within(average).queryByText("다른 구간")).not.toBeInTheDocument();
  });

  it("keeps records and averages unchanged when deletion is cancelled", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older);
    await seedRecord(timer.id, newer);
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    const dialog = await openDelete(user);
    expect(dialog).toHaveAccessibleDescription("삭제하면 평균에서도 빠져요");
    await user.click(within(dialog).getByRole("button", { name: MESSAGES.common.cancel }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(unwrap(await api.listRecords(timer.id))).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /\d+월 \d+일/ })).toHaveLength(2);
    expect(screen.getByRole("region", { name: "구간별 평균" })).toBeInTheDocument();
  });

  it("recalculates the average after deletion and removes it below two matching records", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older, 72_000);
    await seedRecord(timer.id, newer, 76_000);
    await seedRecord(timer.id, newer + 1000, 80_000);
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    await confirmDelete(user);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /\d+월 \d+일/ })).toHaveLength(2));
    const average = screen.getByRole("region", { name: "구간별 평균" });
    expect(within(average).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["도입", "1:00", "1:14", "0:14 늦음"]);
    await confirmDelete(user);
    await waitFor(() => expect(screen.queryByRole("region", { name: "구간별 평균" })).not.toBeInTheDocument());
    await confirmDelete(user);
    expect(await screen.findByText("아직 기록이 없어요")).toBeInTheDocument();
    expect(unwrap(await api.listRecords(timer.id))).toHaveLength(0);
  });

  it("preserves the record when deletion fails and allows retry", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, newer);
    vi.spyOn(api, "deleteRecord").mockRejectedValueOnce(new Error());
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    await confirmDelete(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.appError.title);
    expect(unwrap(await api.listRecords(timer.id))).toHaveLength(1);
    await confirmDelete(user);
    expect(await screen.findByText("아직 기록이 없어요")).toBeInTheDocument();
  });

  it("redirects unauthenticated reads and deletes", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, newer);
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    await screen.findByRole("button", { name: recordDateLabel(newer) });
    await api.signOut();
    await confirmDelete(user);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
    cleanup(); navigation.replace.mockClear();
    render(<RecordsView timerId={timer.id} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
  });

  it("reports a failed read", async () => {
    const timer = await seedTimer();
    vi.spyOn(api, "listRecords").mockRejectedValueOnce(new Error());
    render(<RecordsView timerId={timer.id} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.appError.title);
  });
});
