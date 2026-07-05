import { Clapperboard } from "lucide-react";

// Placeholder: consumer-facing reels player (T6.3) will be implemented in
// a later phase — like/save, follow-factory, and RFQ-linked chat actions
// per CLAUDE.md's "منطق الريلز التجاري" section.
export function ClientReelsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ريلز</h1>
        <p className="mt-1 text-sm text-slate-500">
          اكتشف لقطات من المصانع الصينية
        </p>
      </div>

      <div className="card p-12 text-center">
        <Clapperboard className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.5} />
        <h3 className="mt-4 text-lg font-medium text-slate-600">ريلز</h3>
        <p className="mt-2 text-sm text-slate-400">
          سيتم تنفيذ مشغّل الريلز للمستورد في مرحلة لاحقة
        </p>
      </div>
    </div>
  );
}
