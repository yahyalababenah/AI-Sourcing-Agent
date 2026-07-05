import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Package } from "lucide-react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders the icon, title, and description", () => {
    render(<EmptyState icon={Package} title="لا توجد بيانات" description="جرّب لاحقاً" />);
    expect(screen.getByText("لا توجد بيانات")).toBeInTheDocument();
    expect(screen.getByText("جرّب لاحقاً")).toBeInTheDocument();
  });

  it("omits the action button unless both actionLabel and onAction are given", () => {
    render(<EmptyState icon={Package} title="لا توجد بيانات" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders and fires the optional action button", () => {
    const onAction = vi.fn();
    render(<EmptyState icon={Package} title="لا توجد بيانات" actionLabel="أضف عنصر" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "أضف عنصر" }));
    expect(onAction).toHaveBeenCalled();
  });
});
