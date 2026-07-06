import { TRACKING_PIPELINE, type TrackingStatus } from "@/types/orders";
import { TRACKING_LABELS, TRACKING_ICONS } from "./useOrderTrackingData";
import type { UseMutationResult } from "@tanstack/react-query";
import type { TrackingStatusResponse } from "@/types/orders";

interface TrackingStatusUpdatePanelProps {
  currentIndex: number;
  nextStatus: TrackingStatus | null;
  statusNotes: string;
  setStatusNotes: (notes: string) => void;
  updateMutation: UseMutationResult<TrackingStatusResponse, Error, string>;
}

/** Agent/admin-only status-update controls (T8.7) — shared between
 * OrderTrackingPageDesktop and OrderTrackingPageMobile. */
export function TrackingStatusUpdatePanel({
  currentIndex,
  nextStatus,
  statusNotes,
  setStatusNotes,
  updateMutation,
}: TrackingStatusUpdatePanelProps) {
  return (
    <>
      {nextStatus && (
        <div className="card p-5">
          <h3 className="mb-4 text-[13px] font-bold text-slate-900">تحديث حالة التتبع</h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)..."
              className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-900 outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={() => updateMutation.mutate(nextStatus)}
              disabled={updateMutation.isPending}
              className="rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
            >
              {updateMutation.isPending ? "جاري..." : `تحديث → ${TRACKING_LABELS[nextStatus]}`}
            </button>
          </div>
          {updateMutation.isError && (
            <p className="mt-2 text-[12px] text-red-600">{updateMutation.error?.message || "فشل التحديث"}</p>
          )}
        </div>
      )}

      {currentIndex >= 0 && (
        <div className="card p-5">
          <h3 className="mb-3 text-[13px] font-bold text-slate-900">إجراءات سريعة</h3>
          <div className="flex flex-wrap gap-2">
            {TRACKING_PIPELINE.map((status, idx) => {
              if (idx <= currentIndex) return null;
              return (
                <button
                  key={status}
                  onClick={() => updateMutation.mutate(status)}
                  disabled={updateMutation.isPending}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  {TRACKING_ICONS[status]} {TRACKING_LABELS[status]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
