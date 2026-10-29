import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { api } from "@/services/api";
import { Landing } from "./Landing";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const configuration = vi.hoisted(() => ({ mode: "mock" as "mock" | "live" }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/services/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/api")>(),
  get dataMode() { return configuration.mode; },
}));

beforeEach(() => {
  localStorage.clear();
  navigation.push.mockReset();
  navigation.replace.mockReset();
  configuration.mode = "mock";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Landing", () => {
  it("shows four sections in order and colors the headline fragments", () => {
    render(<Landing />);
    const headline = screen.getByRole("heading", { level: 1, name: MESSAGES.landing.headline });
    expect(within(headline).getByText("빨랐는지")).toHaveClass("text-blue-400");
    expect(within(headline).getByText("늦었는지.")).toHaveClass("text-red-400");
    const sections = screen.getAllByRole("heading", { level: 2 });
    expect(sections.map((heading) => heading.textContent)).toEqual([
      MESSAGES.landing.comparison.title, MESSAGES.landing.featuresTitle, MESSAGES.landing.closingTitle,
    ]);
    expect(screen.getAllByRole("button", { name: MESSAGES.landing.mockSignIn })).toHaveLength(2);
    expect(screen.getByText("무료 · 만 14세 이상")).toBeInTheDocument();
  });

  it("signs in from the closing button and disables both buttons while waiting", async () => {
    let finishSignIn!: () => void;
    const signIn = vi.spyOn(api, "signIn").mockReturnValue(new Promise((resolve) => { finishSignIn = resolve; }));
    const user = userEvent.setup();
    render(<Landing next="/timers/new" />);
    const buttons = screen.getAllByRole("button", { name: MESSAGES.landing.mockSignIn });
    await waitFor(() => buttons.forEach((button) => expect(button).toBeEnabled()));
    await user.click(buttons[1]);
    buttons.forEach((button) => expect(button).toBeDisabled());
    expect(navigation.push).not.toHaveBeenCalled();
    finishSignIn();
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/timers/new"));
    expect(signIn).toHaveBeenCalledWith("/timers/new");
  });

  it("shows a failed login only below the button that was clicked", async () => {
    vi.spyOn(api, "signIn").mockRejectedValue(new Error("login failed"));
    const user = userEvent.setup();
    render(<Landing />);
    const buttons = screen.getAllByRole("button", { name: MESSAGES.landing.mockSignIn });
    await waitFor(() => expect(buttons[1]).toBeEnabled());
    await user.click(buttons[1]);
    let alert = await screen.findByRole("alert");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(buttons[1].nextElementSibling).toBe(alert);
    expect(within(buttons[0].parentElement!).queryByRole("alert")).toBeNull();
    await user.click(buttons[0]);
    alert = await screen.findByRole("alert");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(buttons[0].nextElementSibling).toBe(alert);
    expect(within(buttons[1].parentElement!).queryByRole("alert")).toBeNull();
  });
  it("uses the Google label in live mode", async () => {
    configuration.mode = "live";
    render(<Landing />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: MESSAGES.landing.googleSignIn })[0]).toBeEnabled());
    expect(screen.queryByRole("button", { name: MESSAGES.landing.mockSignIn })).not.toBeInTheDocument();
  });

  it("waits for sign-in before navigating", async () => {
    let finishSignIn!: () => void;
    vi.spyOn(api, "signIn").mockReturnValue(new Promise((resolve) => { finishSignIn = resolve; }));
    const user = userEvent.setup();
    render(<Landing />);
    const button = screen.getAllByRole("button", { name: MESSAGES.landing.mockSignIn })[0];
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(button).toBeDisabled();
    expect(navigation.push).not.toHaveBeenCalled();
    finishSignIn();
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/timers"));
  });

  it("shows the headline, preview, features, mock login, age notice and policy links", async () => {
    render(<Landing />);
    expect(screen.getByRole("link", { name: MESSAGES.serviceName })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { level: 1, name: MESSAGES.landing.headline })).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.landing.description)).toBeInTheDocument();
    expect(screen.getByText(/^무료 · 만 14세 이상 · 계속하면/)).toBeInTheDocument();
    const preview = screen.getAllByText("1:24")[0].closest("[aria-hidden]")!;
    expect(preview).not.toBeNull();
    expect(within(preview as HTMLElement).getByText("0:12 늦음")).toHaveClass("text-red-400", "verdict");
    expect(preview).toHaveTextContent("3 / 6");
    expect(preview).toHaveTextContent("직전 구간 · 문제 정의");
    expect(preview).toHaveTextContent("전체 남은 시간7:16");
    for (const feature of MESSAGES.landing.features) {
      expect(screen.getByRole("heading", { name: feature.title })).toBeInTheDocument();
      expect(screen.getByText(feature.body)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: MESSAGES.terms.title })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: MESSAGES.privacy.title })).toHaveAttribute("href", "/privacy");
    await waitFor(() => expect(screen.getAllByRole("button", { name: MESSAGES.landing.mockSignIn })[0]).toBeEnabled());
  });

  it.each([
    [undefined, "/timers"],
    ["/timers/new?from=pricing", "/timers/new?from=pricing"],
    ["https://example.test", "/timers"],
    ["//example.test", "/timers"],
    ["/\\example.test", "/timers"],
  ])("signs in and pushes the safe destination for %s", async (next, expected) => {
    const signIn = vi.spyOn(api, "signIn");
    const user = userEvent.setup();
    render(<Landing next={next} />);
    const button = screen.getAllByRole("button", { name: MESSAGES.landing.mockSignIn })[0];
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(expected));
    expect(signIn).toHaveBeenCalledWith(next);
    expect(await api.getUser()).not.toBeNull();
  });

  it.each([
    [undefined, "/timers"],
    ["/timers/new?from=pricing", "/timers/new?from=pricing"],
    ["https://example.test", "/timers"],
  ])("replaces the landing page for a signed-in user with %s", async (next, expected) => {
    await api.signIn();
    render(<Landing next={next} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(expected));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("shows a localized error and permits retrying a failed login", async () => {
    vi.spyOn(api, "signIn").mockRejectedValueOnce(new Error("storage failed"));
    const user = userEvent.setup();
    render(<Landing />);
    const button = screen.getAllByRole("button", { name: MESSAGES.landing.mockSignIn })[0];
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.landing.signInFailed);
    expect(button).toBeEnabled();
    expect(navigation.push).not.toHaveBeenCalled();
    await user.click(button);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/timers"));
  });
});
