import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import type { User } from "@/types/api";
import { RequireAuth } from "./RequireAuth";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/timers/new" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
}));

beforeEach(() => {
  localStorage.clear();
  navigation.replace.mockReset();
  navigation.pathname = "/timers/new";
  window.history.replaceState(null, "", "/timers/new?from=pricing&name=%ED%86%A0%EB%A1%A0");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("RequireAuth", () => {
  it("renders nothing while the user check is pending", async () => {
    let resolveUser!: (user: User | null) => void;
    vi.spyOn(api, "getUser").mockReturnValue(new Promise((resolve) => { resolveUser = resolve; }));
    const { container } = render(<RequireAuth><div>protected content</div></RequireAuth>);
    expect(container).toBeEmptyDOMElement();
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => resolveUser({ id: "mock-user", email: null }));
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("redirects guests to the landing page with the full path and query", async () => {
    const { container } = render(<RequireAuth><div>protected content</div></RequireAuth>);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(
      "/?next=" + encodeURIComponent("/timers/new?from=pricing&name=%ED%86%A0%EB%A1%A0"),
    ));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders children for an authenticated mock user", async () => {
    await api.signIn();
    render(<RequireAuth><div>protected content</div></RequireAuth>);
    expect(await screen.findByText("protected content")).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("does not redirect after unmounting during a user check", async () => {
    let resolveUser!: (user: User | null) => void;
    vi.spyOn(api, "getUser").mockReturnValue(new Promise((resolve) => { resolveUser = resolve; }));
    const { unmount } = render(<RequireAuth><div>protected content</div></RequireAuth>);
    unmount();
    await act(async () => resolveUser(null));
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
