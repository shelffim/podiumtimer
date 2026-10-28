import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PresenceMember } from "@/types/share";
import { ShareHostPanel } from "./ShareHostPanel";

const viewers: PresenceMember[] = [
  { clientId: "b", nickname: "나중 학생", role: "viewer", joinedAt: 20 },
  { clientId: "h", nickname: "발표자", role: "host", joinedAt: 0 },
  { clientId: "a", nickname: "먼저 학생", role: "viewer", joinedAt: 10 },
];
function open(seatCap: number | null = 3, members = viewers) {
  return render(<ShareHostPanel timerId="timer-id" code="abc" seatCap={seatCap} members={members} onCreate={vi.fn()} />);
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("ShareHostPanel", () => {
  it("offers only create before a link exists", () => {
    const create = vi.fn();
    render(<ShareHostPanel timerId="t" code={null} seatCap={null} members={[]} onCreate={create} />);
    fireEvent.click(screen.getByRole("button", { name: "공유 링크 만들기" })); expect(create).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "복사" })).not.toBeInTheDocument();
  });
  it("shows the origin link, counts host once, lists viewers in joining order, and copies", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    open(); expect(screen.getByText(`${location.origin}/s/abc`)).toBeInTheDocument();
    expect(screen.getByText("접속 3/3")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["먼저 학생", "나중 학생"]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "복사" })));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/s/abc`); expect(screen.getByRole("status")).toHaveTextContent("복사했어요");
    expect(screen.queryByRole("button", { name: "공유 링크 만들기" })).not.toBeInTheDocument();
  });
  it("shows a full-seat notice and pass link only below the pass cap", () => {
    const { unmount } = open();
    expect(screen.getByText("자리가 가득 찼어요")).toBeInTheDocument();
    expect(screen.getByText("30일권은 10명까지")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "30일권 보기" })).toHaveAttribute("href", "/pricing?returnTo=/timers/timer-id/run");
    unmount(); open(10, Array.from({ length: 9 }, (_, i) => ({ clientId: String(i), nickname: `학생${i}`, role: "viewer", joinedAt: i })));
    expect(screen.getByText("자리가 가득 찼어요")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "30일권 보기" })).not.toBeInTheDocument();
  });
  it("does not show a full-seat notice when there is room or the cap is loading", () => {
    const { unmount } = open(3, []); expect(screen.getByText("접속 1/3")).toBeInTheDocument();
    expect(screen.queryByText("자리가 가득 찼어요")).not.toBeInTheDocument(); unmount();
    open(null); expect(screen.queryByText(/접속/)).not.toBeInTheDocument();
    expect(screen.queryByText("자리가 가득 찼어요")).not.toBeInTheDocument();
  });
  it("handles clipboard failure without falsely showing success", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error()) } });
    open(); await act(async () => fireEvent.click(screen.getByRole("button", { name: "복사" })));
    expect(screen.getByRole("alert")).toHaveTextContent("복사하지 못했어요. 다시 시도해 주세요");
    expect(screen.queryByText("복사했어요")).not.toBeInTheDocument();
  });
});
