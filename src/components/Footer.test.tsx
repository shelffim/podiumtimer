import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { Footer } from "./Footer";

afterEach(cleanup);

describe("Footer", () => {
  it("links to both policies and the supplied contact email", () => {
    render(<Footer contactEmail="contact@example.test" />);
    expect(screen.getByRole("link", { name: MESSAGES.privacy.title })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: MESSAGES.terms.title })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "contact@example.test" })).toHaveAttribute("href", "mailto:contact@example.test");
  });

  it.each([undefined, "", "   "])("omits only the email when it is %s", (contactEmail) => {
    render(<Footer contactEmail={contactEmail} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: MESSAGES.privacy.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: MESSAGES.terms.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });
});
