import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPreview } from "@/components/dashboard-preview";

describe("DashboardPreview", () => {
  it("renders the marketing dashboard mock", () => {
    render(<DashboardPreview />);
    expect(screen.getByText(/SoloRMT Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Revenue Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
  });
});
