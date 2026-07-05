interface StatCardProps {
  value: string | number;
  label: string;
}

// Per CLAUDE.md's "مكوّنات جاهزة" — financial/KPI figures stay slate, no
// decorative color, tabular-nums implied by the design system's number style.
export function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
