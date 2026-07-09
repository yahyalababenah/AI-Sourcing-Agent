import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompletionCardDesktop } from "../CompletionCardDesktop";
import { CompletionCardMobile } from "../CompletionCardMobile";
import "@/lib/i18n";

describe("CompletionCardDesktop", () => {
  it("shows the completion title/subtitle and dismisses on click", () => {
    const onDismiss = vi.fn();
    render(<CompletionCardDesktop role="agent" onDismiss={onDismiss} />);

    expect(screen.getByText("أتممت الجولة 🎉")).toBeInTheDocument();
    fireEvent.click(screen.getByText("لنبدأ!"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses the importer accent for the client role", () => {
    const { container } = render(<CompletionCardDesktop role="client" onDismiss={vi.fn()} />);
    expect(container.querySelector(".bg-importer-500")).toBeInTheDocument();
  });
});

describe("CompletionCardMobile", () => {
  it("shows the completion title/subtitle and dismisses on click", () => {
    const onDismiss = vi.fn();
    render(<CompletionCardMobile role="client" onDismiss={onDismiss} />);

    expect(screen.getByText("أتممت الجولة 🎉")).toBeInTheDocument();
    fireEvent.click(screen.getByText("لنبدأ!"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
