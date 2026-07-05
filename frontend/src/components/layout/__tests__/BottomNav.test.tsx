import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BottomNav } from "../BottomNav";
import "@/lib/i18n";

describe("BottomNav", () => {
  it("shows the agent's 5 tabs per CLAUDE.md: home/incoming/reels/chat/account", () => {
    renderWithProviders(<BottomNav role="agent" />);
    const labels = ["الرئيسية", "الواردة", "اللقطات", "محادثات", "حسابي"];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("shows the client's 5 tabs per CLAUDE.md: home/discover/reels/chat/account", () => {
    renderWithProviders(<BottomNav role="client" />);
    const labels = ["الرئيسية", "اكتشف", "ريلز", "محادثات", "حسابي"];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });
});
