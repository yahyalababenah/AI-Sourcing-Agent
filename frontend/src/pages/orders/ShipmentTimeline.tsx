import { Check } from "lucide-react";
import { TRACKING_PIPELINE, type TrackingEvent, type TrackingStatus } from "@/types/orders";
import { TRACKING_LABELS } from "./useOrderTrackingData";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";

interface ShipmentTimelineProps {
  currentIndex: number;
  events: TrackingEvent[];
}

/** Maps each tracking status to its glossary term key for tooltip display. */
function TrackingLabel({ status }: { status: TrackingStatus }) {
  const label = TRACKING_LABELS[status];
  const termMap: Partial<Record<TrackingStatus, string>> = {
    awaiting_payment: "Awaiting Payment",
    production: "Production",
    inland_freight: "Inland Freight",
    sea_freight: "Sea Freight",
    customs: "Customs",
    delivered: "Delivered",
  };
  const termKey = termMap[status];
  return termKey ? <GlossaryTerm term={termKey}>{label}</GlossaryTerm> : <>{label}</>;
}

/** Vertical shipment timeline (T8.7) — colored dots + connecting line +
 * an active-state highlight for the current stage. Shared between
 * OrderTrackingPageDesktop and OrderTrackingPageMobile. Uses the real
 * 6-stage backend pipeline (TRACKING_PIPELINE) rather than the task
 * text's stylized 5 names — see useOrderTrackingData.ts's note on why a
 * 5th "arrived at port" stage isn't fabricated. No per-stage completion
 * percentage is shown for the current stage — that number doesn't exist
 * anywhere in the backend contract (TrackingEvent only carries a
 * from/to status transition and a timestamp, not a within-stage
 * progress fraction), so showing one would be invented, not real. */
export function ShipmentTimeline({ currentIndex, events }: ShipmentTimelineProps) {
  return (
    <div className="card px-4 pb-6 pt-4">
      <div className="mb-4 text-[11px] font-bold tracking-wide text-slate-500">مراحل الشحنة</div>
      <div className="flex flex-col gap-0">
        {TRACKING_PIPELINE.map((status, idx) => {
          const achieved = currentIndex >= idx;
          const isCurrent = currentIndex === idx;
          const isPending = idx > currentIndex;
          const isLast = idx === TRACKING_PIPELINE.length - 1;
          const event = events.find((e) => e.to_status === status);

          return (
            <div key={status} className="flex items-start gap-3">
              <div className="flex w-5 shrink-0 flex-col items-center">
                {achieved && !isCurrent ? (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </div>
                ) : isCurrent ? (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-50">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                  </div>
                ) : (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-50">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  </div>
                )}
                {!isLast && (
                  <div className={`my-1 min-h-[16px] w-0.5 flex-1 ${achieved && !isCurrent ? "bg-brand-200" : "bg-slate-200"}`} />
                )}
              </div>

              <div className="flex-1 pb-3">
                <div
                  className={`rounded-lg px-3 py-2.5 ${
                    isCurrent
                      ? "border-2 border-brand-200 bg-brand-50"
                      : isPending
                        ? "border border-slate-200 bg-slate-50 opacity-70"
                        : "border border-brand-100 bg-brand-50/60"
                  }`}
                >
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className={`text-[12px] font-bold ${isPending ? "text-slate-400" : "text-slate-900"}`}>
                      <TrackingLabel status={status} />
                    </span>
                    <span className={`text-[10px] font-semibold ${isCurrent ? "text-brand-600" : isPending ? "text-slate-400" : "text-brand-600"}`}>
                      {isCurrent ? "جارٍ الآن" : isPending ? "قادم" : "مكتمل"}
                    </span>
                  </div>
                  {event && (
                    <>
                      {event.notes && <p className="text-xs text-slate-500">{event.notes}</p>}
                      <p className="text-xs text-slate-400">{new Date(event.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}</p>
                    </>
                  )}
                  {isCurrent && !event && <p className="text-xs text-slate-400">بانتظار التحديث الأول</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
