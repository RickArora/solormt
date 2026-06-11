import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "@/components/button";

describe("ButtonLink", () => {
  it("renders a link with its label", () => {
    render(<ButtonLink href="/app">Get Started</ButtonLink>);
    const link = screen.getByRole("link", { name: /get started/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/app");
  });

  it("applies the primary style by default and secondary when asked", () => {
    const { rerender } = render(<ButtonLink href="/x">Primary</ButtonLink>);
    expect(screen.getByRole("link")).toHaveClass("bg-skybrand");
    rerender(<ButtonLink href="/x" variant="secondary">Secondary</ButtonLink>);
    expect(screen.getByRole("link")).not.toHaveClass("bg-skybrand");
  });
});
