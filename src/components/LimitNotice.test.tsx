import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { LimitNotice } from "./LimitNotice";

afterEach(cleanup);

describe("LimitNotice", () => {
  it("shows the notice with a pass link when an upgrade path is given", () => {
    render(<LimitNotice text="무료 한도에 도달했어요" pricingHref="/pricing?returnTo=/timers" />);
    expect(screen.getByRole("status")).toHaveTextContent("무료 한도에 도달했어요");
    expect(screen.getByRole("link", { name: MESSAGES.timers.viewPass })).toHaveAttribute("href", "/pricing?returnTo=/timers");
  });

  it("runs the navigation callback when the pass link is followed", () => {
    const onNavigate = vi.fn();
    render(<LimitNotice text="무료 한도에 도달했어요" pricingHref="/pricing" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: MESSAGES.timers.viewPass }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("omits the link without an upgrade path", () => {
    render(<LimitNotice text="자리가 가득 찼어요" />);
    expect(screen.getByRole("status")).toHaveTextContent("자리가 가득 찼어요");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
