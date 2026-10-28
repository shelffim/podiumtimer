import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { PageShell } from "./PageShell";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("PageShell", () => {
  it("renders management content and a footer with the server contact email", () => {
    vi.stubEnv("CONTACT_EMAIL", "contact@example.test");
    render(<PageShell><h1>{MESSAGES.serviceName}</h1></PageShell>);
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { name: MESSAGES.serviceName }));
    expect(screen.getByRole("link", { name: "contact@example.test" })).toHaveAttribute("href", "mailto:contact@example.test");
    expect(screen.getByRole("contentinfo").compareDocumentPosition(screen.getByRole("main")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("works without contact configuration", () => {
    vi.stubEnv("CONTACT_EMAIL", undefined);
    render(<PageShell>{MESSAGES.serviceName}</PageShell>);
    expect(screen.getByRole("main")).toHaveTextContent(MESSAGES.serviceName);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
