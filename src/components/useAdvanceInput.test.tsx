import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdvanceInput } from "./useAdvanceInput";

function Harness({ enabled = true, advance }: { enabled?: boolean; advance: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useAdvanceInput({ enabled, targetRef: ref, onAdvance: advance });
  return <><header data-testid="header" /><div ref={ref} data-testid="area">
    <span data-testid="text" /><button><span>button</span></button><a href="#">link</a>
    <div data-no-advance><span>excluded</span></div>
    <input aria-label="input" /><textarea aria-label="textarea" /><select aria-label="select" />
    <div contentEditable data-testid="editable"><span>editable child</span></div>
  </div></>;
}
function tap(target: Element, options: PointerEventInit = {}) {
  fireEvent.pointerDown(target, { pointerType: "touch", pointerId: 1, clientX: 20, clientY: 20, ...options });
  fireEvent.pointerUp(target, { pointerType: "touch", pointerId: 1, clientX: 20, clientY: 20, ...options });
}
const space = (target: Element | Document = document, repeat = false) => fireEvent.keyDown(target, { code: "Space", key: " ", repeat });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useAdvanceInput", () => {
  it("shares a 500ms cooldown across Space and touch, including the boundary", () => {
    const advance = vi.fn(); render(<Harness advance={advance} />);
    expect(space()).toBe(false);
    vi.advanceTimersByTime(499); tap(screen.getByTestId("area"));
    expect(advance).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); tap(screen.getByTestId("text"));
    expect(advance).toHaveBeenCalledTimes(2);
    space(); expect(advance).toHaveBeenCalledTimes(2);
  });
  it("does not advance on repeat and prevents a focused button's default Space action", () => {
    const advance = vi.fn(); render(<Harness advance={advance} />);
    expect(space(document, true)).toBe(false);
    expect(advance).not.toHaveBeenCalled();
    const button = screen.getByRole("button"); button.focus();
    expect(space(button)).toBe(false); expect(advance).toHaveBeenCalledOnce();
  });
  it.each(["input", "textarea", "select"])("ignores Space while %s is focused even if dispatched on document", (label) => {
    const advance = vi.fn(); render(<Harness advance={advance} />);
    screen.getByLabelText(label).focus();
    expect(space()).toBe(true); expect(advance).not.toHaveBeenCalled();
  });
  it("ignores contenteditable descendants", () => {
    const advance = vi.fn(); render(<Harness advance={advance} />);
    expect(space(screen.getByText("editable child"))).toBe(true);
    expect(advance).not.toHaveBeenCalled();
  });
  it("ignores header, interactive descendants and mouse, while accepting pen", () => {
    const advance = vi.fn(); render(<Harness advance={advance} />);
    for (const target of [screen.getByTestId("header"), screen.getByText("button"), screen.getByRole("link"), screen.getByText("excluded")]) tap(target);
    tap(screen.getByTestId("area"), { pointerType: "mouse" });
    expect(advance).not.toHaveBeenCalled();
    tap(screen.getByTestId("area"), { pointerType: "pen" }); expect(advance).toHaveBeenCalledOnce();
  });
  it("rejects movement beyond 10px even after returning to the start, accepts 10px", () => {
    const advance = vi.fn(); render(<Harness advance={advance} />);
    const area = screen.getByTestId("area");
    fireEvent.pointerDown(area, { pointerType: "touch", pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 11, clientY: 0 });
    fireEvent.pointerUp(area, { pointerType: "touch", pointerId: 1, clientX: 0, clientY: 0 });
    expect(advance).not.toHaveBeenCalled();
    fireEvent.pointerDown(area, { pointerType: "touch", pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(area, { pointerType: "touch", pointerId: 2, clientX: 0, clientY: 11 });
    expect(advance).not.toHaveBeenCalled();
    fireEvent.pointerDown(area, { pointerType: "touch", pointerId: 3, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(area, { pointerType: "touch", pointerId: 3, clientX: 10, clientY: 0 });
    expect(advance).toHaveBeenCalledOnce();
  });
  it("rejects unmatched or cancelled pointers", () => {
    const advance = vi.fn(); render(<Harness advance={advance} />);
    const area = screen.getByTestId("area");
    fireEvent.pointerUp(area, { pointerType: "touch", pointerId: 1 });
    fireEvent.pointerDown(area, { pointerType: "touch", pointerId: 1 });
    fireEvent.pointerUp(area, { pointerType: "touch", pointerId: 2 });
    fireEvent.pointerDown(area, { pointerType: "touch", pointerId: 1 });
    fireEvent.pointerCancel(area, { pointerId: 1 });
    fireEvent.pointerUp(area, { pointerType: "touch", pointerId: 1 });
    expect(advance).not.toHaveBeenCalled();
  });
  it("uses the latest callback without resetting cooldown on render and cleans up", () => {
    const first = vi.fn(), second = vi.fn();
    const { rerender, unmount } = render(<Harness advance={first} />);
    space(); rerender(<Harness advance={second} />); space();
    expect(first).toHaveBeenCalledOnce(); expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500); space(); expect(second).toHaveBeenCalledOnce();
    rerender(<Harness enabled={false} advance={second} />);
    vi.advanceTimersByTime(500); space(); tap(screen.getByTestId("area"));
    expect(second).toHaveBeenCalledOnce();
    unmount(); space(); expect(second).toHaveBeenCalledOnce();
  });
});
