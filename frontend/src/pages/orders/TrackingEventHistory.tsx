import { RotateCw } from "lucide-react";
import type { TrackingEvent, TrackingStatus } from "@/types/orders";
import { TRACKING_LABELS, formatDateTime } from "./useOrderTrackingData";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";

interface TrackingEventHistoryProps {
  events: TrackingEvent[];
}

/** Maps each tracking status to its glossary term key for tooltip display. */
function TrackingStatusLabel({ status, fallback }: { status: TrackingStatus; fallback: string }) {
  const label = TRACKING_LABELS[status] || fallback;
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

/** "سجل التحديثات" — real stage-transition history (T8.7), shared between
 * OrderTrackingPageDesktop and OrderTrackingPageMobile. */
export function TrackingEventHistory({ events }: TrackingEventHistoryProps) {
  if (events.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">سجل التحديثات</h2>
      <div className="space-y-3">
        {[...events].reverse().map((event) => (
          <div key={event.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <RotateCw className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-900">
                  {event.from_status ? (
                    <TrackingStatusLabel status={event.from_status as TrackingStatus} fallback={event.from_status} />
                  ) : "—"}
                </span>
                <span className="text-slate-400">→</span>
                <span className="font-medium text-brand-600">
                  <TrackingStatusLabel status={event.to_status as TrackingStatus} fallback={event.to_status} />
                </span>
              </div>
              {event.notes && <p className="mt-1 text-xs text-slate-500">{event.notes}</p>}
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(event.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
