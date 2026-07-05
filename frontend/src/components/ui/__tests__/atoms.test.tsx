import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatCard } from "../StatCard";
import { LineRow } from "../LineRow";
import { StatusPill } from "../StatusPill";
import { ReelTile } from "../ReelTile";

describe("StatCard", () => {
  it("renders the value and label", () => {
    render(<StatCard value="128" label="صفقة" />);
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("صفقة")).toBeInTheDocument();
  });
});

describe("LineRow", () => {
  it("renders label/value and mutes secondary rows", () => {
    const { rerender } = render(<LineRow label="FOB" value="$1,000" />);
    expect(screen.getByText("FOB")).toHaveClass("text-slate-600");

    rerender(<LineRow label="FOB" value="$1,000" muted />);
    expect(screen.getByText("FOB")).toHaveClass("text-slate-400");
  });
});

describe("StatusPill", () => {
  it("shows the fixed color for every non-in_progress status", () => {
    render(<StatusPill status="pending" role="agent" />);
    expect(screen.getByText("قيد الانتظار")).toHaveClass("bg-slate-100");

    render(<StatusPill status="under_review" role="agent" />);
    expect(screen.getByText("تحت المراجعة")).toHaveClass("bg-sky-50");

    render(<StatusPill status="negotiating" role="agent" />);
    expect(screen.getByText("جارٍ التفاوض")).toHaveClass("bg-amber-50");

    render(<StatusPill status="completed" role="agent" />);
    expect(screen.getByText("مكتمل")).toHaveClass("bg-emerald-50");

    render(<StatusPill status="rejected" role="agent" />);
    expect(screen.getByText("مرفوض")).toHaveClass("bg-red-50");
  });

  it("colors in_progress with the viewer's own role — supplier for agent, importer for client", () => {
    render(<StatusPill status="in_progress" role="agent" />);
    expect(screen.getByText("قيد التنفيذ")).toHaveClass("bg-supplier-50");

    render(<StatusPill status="in_progress" role="client" />);
    expect(screen.getAllByText("قيد التنفيذ")[1]).toHaveClass("bg-importer-50");
  });
});

describe("ReelTile", () => {
  it("always shows the commercial overlay and the RFQ count, never a views count", () => {
    render(<ReelTile price="$50" product="مصباح LED" rfqCount={12} />);
    expect(screen.getByText("$50 · مصباح LED")).toBeInTheDocument();
    expect(screen.getByText("12 طلب سعر")).toBeInTheDocument();
    expect(screen.queryByText(/مشاهدة/)).not.toBeInTheDocument();
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<ReelTile price="$50" product="مصباح LED" rfqCount={0} onClick={onClick} />);
    fireEvent.click(screen.getByText("$50 · مصباح LED"));
    expect(onClick).toHaveBeenCalled();
  });
});
