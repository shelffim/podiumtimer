import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { demoFrame } from "@/lib/demo";
import { MESSAGES } from "@/lib/messages";
import { FeatureCards } from "./FeatureCards";

afterEach(cleanup);

describe("FeatureCards", () => {
  it("illustrates the three features with shared demo results and averages", () => {
    const { container } = render(<FeatureCards frame={demoFrame(0)} />);
    expect(screen.getByRole("heading", { level: 2, name: MESSAGES.landing.featuresTitle })).toHaveClass("display");
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(MESSAGES.landing.features.map((feature) => feature.title));
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    cards.forEach((card, i) => {
      expect(within(card).getByText(MESSAGES.landing.features[i].body)).toBeInTheDocument();
      expect(card.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });
    expect(within(cards[0]).getByText("0:04 빠름")).toHaveClass("text-blue-400");
    expect(within(cards[0]).getByText("0:12 늦음")).toHaveClass("text-red-400");
    expect(within(cards[0]).getByText("정시")).toHaveClass("text-neutral-300");
    expect(within(cards[0]).getByText("결과 · 진행 중")).toBeInTheDocument();
    expect(within(cards[0]).getByText("2:30")).toBeInTheDocument();
    expect(within(cards[1]).getAllByText("0:08")).toHaveLength(3);
    for (const label of ["발표자", "민지", "준호", "3/3"]) expect(within(cards[1]).getByText(label)).toHaveClass("chip");
    expect(within(cards[2]).getByText("같은 구간 구성의 기록 5개")).toBeInTheDocument();
    const average = within(cards[2]).getByRole("list", { name: MESSAGES.records.averageChart, hidden: true });
    expect(within(average).getAllByRole("listitem", { hidden: true })).toHaveLength(6);
    expect(average.querySelectorAll("[data-bar]")).toHaveLength(5);
    expect(container.querySelector("button, a, img, [tabindex]")).toBeNull();
  });

  it("keeps all three device clocks in sync through overtime and a segment change", () => {
    const { rerender } = render(<FeatureCards frame={demoFrame(19)} />);
    const clocks = screen.getAllByText("-0:11");
    expect(clocks).toHaveLength(3);
    clocks.forEach((clock) => expect(clock).toHaveClass("text-red-400", "tabular-nums"));
    rerender(<FeatureCards frame={demoFrame(20)} />);
    expect(screen.getAllByText("2:00")).toHaveLength(3);
    expect(screen.queryByText("-0:11")).toBeNull();
    expect(within(screen.getAllByRole("article")[1]).getByText("연구 방법")).toBeInTheDocument();
  });
});
