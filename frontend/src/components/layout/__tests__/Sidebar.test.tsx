import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { Sidebar } from "../Sidebar";
import "@/lib/i18n";

// Regression guard: the agent/supplier nav's "رفع مستند" (catalog upload)
// link was silently dropped during the CLAUDE.md design-system migration
// that replaced the old per-role sidebars with this unified Sidebar —
// the upload page and backend endpoint still worked, but suppliers had no
// way to reach it. See ROUTES.DOCUMENTS.UPLOAD.
describe("Sidebar — agent nav", () => {
  it("includes a link to the catalog/document upload page", () => {
    renderWithProviders(<Sidebar role="agent" />);
    expect(screen.getByText("رفع مستند")).toBeInTheDocument();
  });

  it("includes a link to My Products", () => {
    renderWithProviders(<Sidebar role="agent" />);
    expect(screen.getByText("منتجاتي")).toBeInTheDocument();
  });
});

// The interactive onboarding tour's Spotlight anchors to these data-tour
// ids (see constants/onboardingSteps.ts) — a renamed/removed attribute here
// would silently break the guided tour without any type error to catch it.
describe("Sidebar — onboarding tour anchors", () => {
  it("marks the nav container and agent-specific links for the guided tour", () => {
    const { container } = renderWithProviders(<Sidebar role="agent" />);
    expect(container.querySelector('[data-tour="tour-sidebar-nav"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-calculator"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-upload"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-supplier-inbox"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-orders"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-chat"]')).toBeInTheDocument();
  });

  it("marks the nav container and client-specific links for the guided tour", () => {
    const { container } = renderWithProviders(<Sidebar role="client" />);
    expect(container.querySelector('[data-tour="tour-sidebar-nav"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-marketplace"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-new-rfq"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-my-requests"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-orders"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-nav-chat"]')).toBeInTheDocument();
  });
});
