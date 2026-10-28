import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { AppBar } from "./AppBar";

afterEach(cleanup);

describe("AppBar", () => {
  it("shows the service name as a home link without a back target", () => {
    render(<AppBar />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: MESSAGES.serviceName })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: MESSAGES.common.back })).not.toBeInTheDocument();
  });

  it("replaces the service name with a back link and title, then shows actions", () => {
    render(<AppBar back="/timers" title="수업 발표"><button type="button">로그아웃</button></AppBar>);
    expect(screen.getByRole("link", { name: MESSAGES.common.back })).toHaveAttribute("href", "/timers");
    expect(screen.queryByRole("link", { name: MESSAGES.serviceName })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "수업 발표" })).toHaveClass("truncate");
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "로그아웃" }));
  });
});
