import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_STILL, demoFrame } from "@/lib/demo";
import { MESSAGES } from "@/lib/messages";
import { LandingPreview } from "./LandingPreview";

afterEach(cleanup);

describe("LandingPreview", () => {
  it("shows the still scene with a red verdict and the shared timer face", () => {
    render(<LandingPreview frame={DEMO_STILL} />);
    expect(screen.getByText("3 / 6")).toBeInTheDocument();
    expect(screen.getByText("1:24")).toBeInTheDocument();
    expect(screen.getByText("0:12 늦음")).toHaveClass("verdict", "text-red-400");
    expect(screen.getByText("직전 구간 · 문제 정의")).toBeInTheDocument();
    expect(screen.getByText("7:16")).toBeInTheDocument();
  });

  it("shows the opening scene with eight seconds left and a blue verdict", () => {
    render(<LandingPreview frame={demoFrame(0)} />);
    expect(screen.getByText("2 / 6")).toBeInTheDocument();
    expect(screen.getByText("0:08")).toHaveClass("text-neutral-50");
    expect(screen.getByText("0:04 빠름")).toHaveClass("text-blue-400");
  });

  it("shows an overdue scene in red before advancing", () => {
    render(<LandingPreview frame={demoFrame(19)} />);
    expect(screen.getByText("2 / 6")).toBeInTheDocument();
    expect(screen.getByText("-0:11")).toHaveClass("text-red-400");
  });

  it("hides the entire card from assistive technology and has no focusable controls", () => {
    const { container } = render(<LandingPreview frame={DEMO_STILL} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("button, a, input, select, textarea, [tabindex], [contenteditable]")).toBeNull();
    expect(screen.getByText(MESSAGES.run.next).tagName).toBe("SPAN");
    expect(screen.getByText(MESSAGES.run.spaceKey)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.run.keyHint)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.run.tapHint)).toHaveClass("pointer-fine:hidden");
  });

  it("shows the pressed pill, Space key and touch circle only during pressed frames", () => {
    const { container, rerender } = render(<LandingPreview frame={DEMO_STILL} />);
    expect(container.querySelector("[data-demo-tap]")).toBeNull();
    expect(screen.getByText(MESSAGES.run.next)).not.toHaveClass("scale-95");
    expect(screen.getByText(MESSAGES.run.spaceKey)).toHaveClass("border-line");

    for (const tick of [19, 20]) {
      rerender(<LandingPreview frame={demoFrame(tick)} />);
      expect(container.querySelector("[data-demo-tap]")).toHaveClass("pointer-fine:hidden", "size-16", "border-2");
      expect(screen.getByText(MESSAGES.run.next)).toHaveClass("scale-95", "bg-neutral-200");
      expect(screen.getByText(MESSAGES.run.spaceKey)).toHaveClass("border-white");
    }

    rerender(<LandingPreview frame={demoFrame(21)} />);
    expect(container.querySelector("[data-demo-tap]")).toBeNull();
    expect(screen.getByText(MESSAGES.run.next)).not.toHaveClass("scale-95");
    expect(screen.getByText(MESSAGES.run.spaceKey)).toHaveClass("border-line");
  });
});
