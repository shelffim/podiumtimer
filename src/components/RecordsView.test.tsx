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
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await api.signIn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("RecordsView", () => {
  it("shows the timer title, navigation and empty record guidance", async () => {
    const timer = await seedTimer();
    render(<RecordsView timerId={timer.id} />);
    expect(await screen.findByRole("heading", { name: "수업 발표 기록" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "시작" })).toHaveAttribute("href", `/timers/${timer.id}/run`);
    expect(screen.getByRole("link", { name: "편집" })).toHaveAttribute("href", `/timers/${timer.id}`);
    expect(screen.getByText("아직 기록이 없어요")).toBeInTheDocument();
    expect(screen.getByText("마지막 구간까지 끝낸 발표가 여기에 쌓여요")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "구간별 평균" })).not.toBeInTheDocument();
  });

  it("shows a missing timer and a list link", async () => {
    render(<RecordsView timerId="missing" />);
    expect(await screen.findByText("타이머를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로" })).toHaveAttribute("href", "/timers");
  });

  it("lists newest first and expands and collapses a record in place", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older);
    await seedRecord(timer.id, newer, 52_000);
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    const latest = await screen.findByRole("button", { name: recordDateLabel(newer) });
    const toggles = screen.getAllByRole("button", { expanded: false });
    expect(toggles.map((button) => button.textContent)).toEqual([recordDateLabel(newer), recordDateLabel(older)]);
    const row = latest.closest("li")!;
    expect(within(row).queryByRole("table")).not.toBeInTheDocument();
    await user.click(latest);
    expect(latest).toHaveAttribute("aria-expanded", "true");
    expect(within(latest.closest("li")!).getByText("0:08 빠름")).toBeInTheDocument();
    expect(document.getElementById(latest.getAttribute("aria-controls")!)).toContainElement(within(row).getByRole("table"));
    await user.click(latest);
    expect(latest).toHaveAttribute("aria-expanded", "false");
    expect(within(row).queryByRole("table")).not.toBeInTheDocument();
  });

  it("requires two matching records before showing averages", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older);
    await seedRecord(timer.id, newer, 200_000, "다른 구간");
    render(<RecordsView timerId={timer.id} />);
    await screen.findByRole("heading", { name: "수업 발표 기록" });
    expect(screen.queryByRole("region", { name: "구간별 평균" })).not.toBeInTheDocument();
  });

  it("shows averages for two matching records on the free plan and excludes other configurations", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older, 72_000);
    await seedRecord(timer.id, newer, 76_000);
    await seedRecord(timer.id, newer + 1000, 200_000, "다른 구간");
    render(<RecordsView timerId={timer.id} />);
    const average = await screen.findByRole("region", { name: "구간별 평균" });
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
    await user.click((await screen.findAllByRole("button", { name: "삭제" }))[0]);
    expect(window.confirm).toHaveBeenCalledWith("기록을 삭제할까요?");
    expect(unwrap(await api.listRecords(timer.id))).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "삭제" })).toHaveLength(2);
    expect(screen.getByRole("region", { name: "구간별 평균" })).toBeInTheDocument();
  });

  it("recalculates the average after deletion and removes it below two matching records", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, older, 72_000);
    await seedRecord(timer.id, newer, 76_000);
    await seedRecord(timer.id, newer + 1000, 80_000);
    vi.mocked(window.confirm).mockReturnValue(true);
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    await user.click((await screen.findAllByRole("button", { name: "삭제" }))[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "삭제" })).toHaveLength(2));
    const average = screen.getByRole("region", { name: "구간별 평균" });
    expect(within(average).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["도입", "1:00", "1:14", "0:14 늦음"]);
    await user.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    await waitFor(() => expect(screen.queryByRole("region", { name: "구간별 평균" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("아직 기록이 없어요")).toBeInTheDocument();
    expect(unwrap(await api.listRecords(timer.id))).toHaveLength(0);
  });

  it("preserves the record when deletion fails and allows retry", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, newer);
    vi.mocked(window.confirm).mockReturnValue(true);
    vi.spyOn(api, "deleteRecord").mockRejectedValueOnce(new Error());
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.appError.title);
    expect(unwrap(await api.listRecords(timer.id))).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("아직 기록이 없어요")).toBeInTheDocument();
  });

  it("redirects unauthenticated reads and deletes", async () => {
    const timer = await seedTimer();
    await seedRecord(timer.id, newer);
    const user = userEvent.setup();
    render(<RecordsView timerId={timer.id} />);
    await screen.findByRole("button", { name: "삭제" });
    await api.signOut();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "삭제" }));
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
