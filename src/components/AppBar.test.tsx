import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { AppBar } from "./AppBar";

afterEach(cleanup);

describe("AppBar", () => {
  it("uses the shared wide layout by default", () => {
    render(<AppBar />);
    expect(screen.getByRole("banner")).toHaveClass("bar");
    expect(screen.getByRole("banner")).not.toHaveClass("bar-narrow");
  });

  it("uses the shared 560px layout when narrow", () => {
    render(<AppBar narrow />);
    expect(screen.getByRole("banner")).toHaveClass("bar", "bar-narrow");
  });

  it("shows the service name as a home link without a back target", () => {
    render(<AppBar />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: MESSAGES.serviceName })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: MESSAGES.common.back })).not.toBeInTheDocument();
  });

  it("replaces the service name with a back link and title, then shows actions", () => {
    render(<AppBar back="/timers" title="수업 발표"><button type="button">로그아웃</button></AppBar>);
    const back = screen.getByRole("link", { name: MESSAGES.common.back });
    expect(back).toHaveAttribute("href", "/timers");
    expect(back).toHaveAttribute("title", MESSAGES.common.back);
    expect(screen.queryByRole("link", { name: MESSAGES.serviceName })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "수업 발표" })).toHaveClass("truncate");
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "로그아웃" }));
  });
});
