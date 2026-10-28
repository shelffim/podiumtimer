import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import ErrorPage from "./error";

afterEach(cleanup);

describe("ErrorPage", () => {
  it("offers a retry and keeps the footer links like other management screens", async () => {
    const reset = vi.fn();
    render(<ErrorPage reset={reset} />);
    expect(screen.getByRole("heading", { level: 1, name: MESSAGES.appError.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: MESSAGES.appError.retry }));
    expect(reset).toHaveBeenCalledOnce();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: MESSAGES.privacy.title })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: MESSAGES.terms.title })).toHaveAttribute("href", "/terms");
  });
});
