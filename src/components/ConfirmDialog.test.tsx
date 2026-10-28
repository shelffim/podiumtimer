import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

function open() {
  const onConfirm = vi.fn(), onCancel = vi.fn();
  render(<ConfirmDialog title="발표를 중단할까요?" description="중단한 발표는 기록되지 않아요" confirmLabel="중단" onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is a labelled modal dialog that focuses cancel first", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "발표를 중단할까요?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("중단한 발표는 기록되지 않아요");
    expect(screen.getByRole("button", { name: MESSAGES.common.cancel })).toHaveFocus();
    expect(dialog.closest("[data-no-advance]")).not.toBeNull();
  });

  it("confirms and cancels through its buttons", () => {
    const { onConfirm, onCancel } = open();
    fireEvent.click(screen.getByRole("button", { name: "중단" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.common.cancel }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cancels on Escape", () => {
    const { onConfirm, onCancel } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
