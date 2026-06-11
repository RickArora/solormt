import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const confirmPasswordReset = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "tok-123" }),
}));

vi.mock("@/lib/api", () => ({
  api: { confirmPasswordReset: (...args: unknown[]) => confirmPasswordReset(...args) },
  ApiError: class ApiError extends Error {},
}));

import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  beforeEach(() => confirmPasswordReset.mockReset());

  it("renders the form", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText(/set a new password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set new password/i })).toBeInTheDocument();
  });

  it("rejects mismatched passwords client-side", async () => {
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText(/new password/i), "BrandNewPass99");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "Different99");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    expect(screen.getByText(/don't match/i)).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("submits matching passwords with the route token", async () => {
    confirmPasswordReset.mockResolvedValue({ detail: "ok" });
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText(/new password/i), "BrandNewPass99");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "BrandNewPass99");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith("tok-123", "BrandNewPass99"));
  });
});
