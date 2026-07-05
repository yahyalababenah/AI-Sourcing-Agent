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
