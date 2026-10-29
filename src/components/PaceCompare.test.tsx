import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_RESULTS } from "@/lib/demo";
import { MESSAGES } from "@/lib/messages";
import { PaceCompare } from "./PaceCompare";

afterEach(cleanup);

describe("PaceCompare", () => {
  it("compares total overrun with six named and colored segment verdicts", () => {
    const { container } = render(<PaceCompare />);
    expect(screen.getByRole("heading", { level: 2, name: MESSAGES.landing.comparison.title })).toHaveClass("display");
    expect(screen.getByText(MESSAGES.landing.comparison.description)).toBeInTheDocument();
    expect(screen.getByText("보통 타이머")).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.serviceName)).toBeInTheDocument();
    expect(screen.getByText("-0:13")).toHaveClass("text-red-400", "tabular-nums");
    expect(screen.getByText("0:13 늦음")).toHaveClass("verdict", "text-red-400");
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    const labels = ["0:04 빠름", "0:12 늦음", "정시", "0:21 늦음", "0:08 빠름", "0:08 빠름"];
    const colors = ["text-blue-400", "text-red-400", "text-neutral-300", "text-red-400", "text-blue-400", "text-blue-400"];
    const fills = ["bg-blue-400", "bg-red-400", "bg-[#6b717b]", "bg-red-400", "bg-blue-400", "bg-blue-400"];
    rows.forEach((row, i) => {
      expect(within(row).getByText(DEMO_RESULTS[i].name)).toBeInTheDocument();
      expect(within(row).getByText(labels[i])).toHaveClass("verdict", colors[i]);
      expect(row.querySelector("[data-dot]")).toHaveClass(fills[i]);
    });
    expect(screen.getByText("끝나고 나서야 13초 넘친 걸 알아요. 어느 구간 때문인지는 몰라요.")).toBeInTheDocument();
    expect(screen.getByText("결과에서 0:21, 문제 정의에서 0:12 늦었어요. 다음 연습에서 어디를 줄일지 바로 보여요.")).toBeInTheDocument();
    const bars = container.querySelectorAll("[data-result-bar]");
    bars.forEach((bar, i) => {
      expect(bar).toHaveClass(fills[i]);
      expect(bar).toHaveStyle({ flexGrow: String(DEMO_RESULTS[i].actualMs), flexBasis: "0" });
      expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
    });
    expect(bars).toHaveLength(6);
    expect(container.querySelector("[data-planned-bar]")).toHaveStyle({ flexGrow: "600000" });
    expect(container.querySelector("[data-overtime-bar]")).toHaveStyle({ flexGrow: "13000" });
  });
});
