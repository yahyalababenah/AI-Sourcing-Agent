import { ArrowRight, AlertCircle } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useOrderTrackingData, TRACKING_LABELS } from "./useOrderTrackingData";
import { ShipmentTimeline } from "./ShipmentTimeline";
import { TrackingStatusUpdatePanel } from "./TrackingStatusUpdatePanel";
import { TrackingEventHistory } from "./TrackingEventHistory";
import type { TrackingStatus } from "@/types/orders";

// Shipment tracking timeline, mobile (T8.7). Same shared hook/components
// as OrderTrackingPageDesktop — only container width/spacing differs (no
// orders-tracking-*.html reference exists for Phase 8).
export function OrderTrackingPageMobile() {
  const {
    id,
    navigate,
    quote,
    quoteLoading,
    trackingLoading,
    quoteError,
    tracking,
    trackingError,
    updateMutation,
    statusNotes,
    setStatusNotes,
    currentIndex,
    isAgentOrAdmin,
    nextStatus,
    shipmentLabel,
  } = useOrderTrackingData();

  if (quoteLoading || trackingLoading) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
        <p className="mt-4 text-sm text-slate-500">جاري تحميل معلومات التتبع...</p>
      </div>
    );
  }

  if (quoteError || trackingError || !quote) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-slate-900">خطأ في تحميل التتبع</h3>
        <p className="mt-2 text-sm text-red-600">
          {(trackingError as Error)?.message || (quoteError as Error)?.message || "لم يتم العثور على الطلب"}
        </p>
        <button onClick={() => navigate(ROUTES.QUOTES.LIST)} className="mt-4 text-sm text-brand-600">
          العودة إلى عروض الأسعار
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.QUOTES.DETAIL(id!))}
            className="rounded p-1 text-slate-600 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]"
          >
            <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </button>
          <div>
            <div className="text-[14px] font-bold text-slate-900">تتبع الطلب</div>
            <div className="font-mono text-[10px] text-slate-500" dir="ltr">
              #{tracking?.quotation_number || id?.slice(0, 8)}
            </div>
          </div>
        </div>
        {tracking?.current_status && (
          <div className="rounded bg-brand-50 px-3 py-1 text-[10px] font-bold text-brand-600">
            {TRACKING_LABELS[tracking.current_status as TrackingStatus] || tracking.current_status}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-1 text-[13px] font-bold text-slate-900">{shipmentLabel}</div>
        <div className="mb-4 text-[11px] text-slate-500">الصين → الأردن</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-slate-50 p-2 text-center">
            <div className="mb-1 text-[10px] text-slate-500">القيمة</div>
            <div className="text-[12px] font-bold text-slate-900" dir="ltr">
              {quote.grand_total ? `${quote.grand_total.toLocaleString()} ${quote.target_currency}` : "—"}
            </div>
          </div>
          <div className="rounded-md bg-slate-50 p-2 text-center">
            <div className="mb-1 text-[10px] text-slate-500">المرحلة</div>
            <div className="text-[12px] font-bold text-slate-900" dir="ltr">
              {currentIndex + 1} / 6
            </div>
          </div>
        </div>
      </div>

      <ShipmentTimeline currentIndex={currentIndex} events={tracking?.events ?? []} />

      {isAgentOrAdmin && (
        <TrackingStatusUpdatePanel
          currentIndex={currentIndex}
          nextStatus={nextStatus}
          statusNotes={statusNotes}
          setStatusNotes={setStatusNotes}
          updateMutation={updateMutation}
        />
      )}

      <TrackingEventHistory events={tracking?.events ?? []} />
    </div>
  );
}
