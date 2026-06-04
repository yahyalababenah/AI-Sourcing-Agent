import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { quotationService } from "@/services/quotationService";
import { orderTrackingService } from "@/services/orderTrackingService";
import type { TrackingStatus, TrackingEvent } from "@/types/orders";
import { TRACKING_PIPELINE } from "@/types/orders";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Arabic labels & helpers
// ---------------------------------------------------------------------------

const TRACKING_LABELS: Record<TrackingStatus, string> = {
  awaiting_payment: "بانتظار الدفع",
  production: "قيد التصنيع",
  inland_freight: "الشحن الداخلي",
  sea_freight: "الشحن البحري",
  customs: "التخليص الجمركي",
  delivered: "تم التسليم",
};

const TRACKING_ICONS: Record<TrackingStatus, string> = {
  awaiting_payment: "💳",
  production: "🏭",
  inland_freight: "🚛",
  sea_freight: "🚢",
  customs: "🛃",
  delivered: "✅",
};

/** Map status to a Tailwind colour class for the timeline dot. */
function statusColor(status: TrackingStatus, achieved: boolean): string {
  if (!achieved) return "border-gray-300 bg-white";
  switch (status) {
    case "awaiting_payment":
      return "border-amber-500 bg-amber-100";
    case "production":
      return "border-blue-500 bg-blue-100";
    case "inland_freight":
      return "border-indigo-500 bg-indigo-100";
    case "sea_freight":
      return "border-cyan-500 bg-cyan-100";
    case "customs":
      return "border-purple-500 bg-purple-100";
    case "delivered":
      return "border-emerald-500 bg-emerald-100";
  }
}

function getPipelineIndex(status: string | null): number {
  if (!status) return -1;
  return TRACKING_PIPELINE.indexOf(status as TrackingStatus);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusNotes, setStatusNotes] = useState("");

  // Fetch quotation details
  const {
    data: quote,
    isLoading: quoteLoading,
    error: quoteError,
  } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => quotationService.get(id!),
    enabled: !!id,
  });

  // Fetch tracking status
  const {
    data: tracking,
    isLoading: trackingLoading,
    error: trackingError,
  } = useQuery({
    queryKey: ["tracking", id],
    queryFn: () => orderTrackingService.getTracking(id!),
    enabled: !!id,
    refetchInterval: 30_000, // Leaf 4: auto-refresh every 30s
  });

  // Mutation: update tracking status
  const updateMutation = useMutation({
    mutationFn: (status: string) =>
      orderTrackingService.updateTracking(id!, {
        status,
        notes: statusNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking", id] });
      setStatusNotes("");
    },
  });

  // ── Determine what's accessible to the current user ──
  const currentIndex = getPipelineIndex(tracking?.current_status ?? null);
  const isAgentOrAdmin =
    user?.role === "agent" || user?.role === "admin";

  // Compute the next available status (first incomplete step after current)
  const nextStatus: TrackingStatus | null =
    currentIndex >= 0 && currentIndex < TRACKING_PIPELINE.length - 1
      ? TRACKING_PIPELINE[currentIndex + 1]
      : null;

  // ── Loading state ──
  if (quoteLoading || trackingLoading) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="mt-4 text-sm text-gray-500">
          جاري تحميل معلومات التتبع...
        </p>
      </div>
    );
  }

  // ── Error state ──
  if (quoteError || trackingError || !quote) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          خطأ في تحميل التتبع
        </h3>
        <p className="mt-2 text-sm text-red-500">
          {(trackingError as Error)?.message ||
            (quoteError as Error)?.message ||
            "لم يتم العثور على الطلب"}
        </p>
        <button
          onClick={() => navigate(ROUTES.QUOTES.LIST)}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700"
        >
          العودة إلى عروض الأسعار
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.QUOTES.DETAIL(id!))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            → العودة
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">تتبع الشحنة</h1>
            <p className="mt-1 text-sm text-gray-500">
              {tracking?.quotation_number || "—"}
            </p>
          </div>
        </div>
        {tracking?.current_status && (
          <span className="inline-block rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700">
            {TRACKING_LABELS[tracking.current_status as TrackingStatus] ||
              tracking.current_status}
          </span>
        )}
      </div>

      {/* ── Timeline ── */}
      <div className="card p-6">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">
          حالة الشحنة
        </h2>
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute right-4 top-0 h-full w-0.5 bg-gray-200" />

          <div className="space-y-0">
            {TRACKING_PIPELINE.map((status, idx) => {
              const achieved = currentIndex >= idx;
              const isCurrent = currentIndex === idx;

              return (
                <div key={status} className="relative flex items-start pb-8 last:pb-0">
                  {/* Timeline dot */}
                  <div
                    className={`relative z-10 ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isCurrent
                        ? "border-primary-500 bg-primary-100 ring-2 ring-primary-200 ring-offset-2"
                        : statusColor(status as TrackingStatus, achieved)
                    }`}
                  >
                    <span className="text-sm">
                      {isCurrent
                        ? "●"
                        : achieved
                        ? "✓"
                        : TRACKING_ICONS[status as TrackingStatus]}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          achieved ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {TRACKING_LABELS[status as TrackingStatus]}
                      </span>
                      {isCurrent && (
                        <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                          الحالي
                        </span>
                      )}
                    </div>

                    {/* Show the event that transitioned TO this status */}
                    {achieved && tracking?.events && (
                      <EventInfo
                        events={tracking.events}
                        status={status}
                        isCurrent={isCurrent}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Status Update (Agent/Admin only) ── */}
      {isAgentOrAdmin && nextStatus && (
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            تحديث حالة التتبع
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-600">
                ملاحظات (اختياري)
              </label>
              <input
                type="text"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="أضف ملاحظة حول هذا التحديث..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => updateMutation.mutate(nextStatus)}
              disabled={updateMutation.isPending}
              className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {updateMutation.isPending
                ? "جاري التحديث..."
                : `تحديث إلى: ${TRACKING_LABELS[nextStatus]}`}
            </button>
          </div>
          {updateMutation.isError && (
            <p className="mt-2 text-sm text-red-500">
              {updateMutation.error?.message || "فشل التحديث"}
            </p>
          )}
          {updateMutation.isSuccess && (
            <p className="mt-2 text-sm text-green-600">تم تحديث الحالة بنجاح</p>
          )}
        </div>
      )}

      {/* Agent can also jump to any future status (quick actions) */}
      {isAgentOrAdmin && currentIndex >= 0 && (
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            إجراءات سريعة
          </h3>
          <div className="flex flex-wrap gap-2">
            {TRACKING_PIPELINE.map((status, idx) => {
              if (idx <= currentIndex) return null; // skip achieved/current
              return (
                <button
                  key={status}
                  onClick={() => updateMutation.mutate(status)}
                  disabled={updateMutation.isPending}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {TRACKING_ICONS[status as TrackingStatus]}{" "}
                  {TRACKING_LABELS[status as TrackingStatus]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Event History ── */}
      {tracking?.events && tracking.events.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            سجل التحديثات
          </h2>
          <div className="space-y-3">
            {[...tracking.events]
              .reverse()
              .map((event: TrackingEvent) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm">
                    ↻
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">
                        {event.from_status
                          ? TRACKING_LABELS[
                              event.from_status as TrackingStatus
                            ] || event.from_status
                          : "—"}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium text-primary-700">
                        {TRACKING_LABELS[
                          event.to_status as TrackingStatus
                        ] || event.to_status}
                      </span>
                    </div>
                    {event.notes && (
                      <p className="mt-1 text-xs text-gray-500">
                        {event.notes}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDateTime(event.created_at)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Show event info for a given pipeline status. */
function EventInfo({
  events,
  status,
  isCurrent,
}: {
  events: TrackingEvent[];
  status: string;
  isCurrent: boolean;
}) {
  // Find the event that transitioned TO this status
  const event = events.find((e) => e.to_status === status);
  if (!event) {
    // For the current status with no event yet (e.g. initial awaiting_payment
    // set by the system without an event), show nothing or a default message.
    if (isCurrent) {
      return (
        <p className="mt-1 text-xs text-gray-400">
          بانتظار التحديث الأول
        </p>
      );
    }
    return null;
  }

  return (
    <div className="mt-1">
      {event.notes && (
        <p className="text-xs text-gray-500">{event.notes}</p>
      )}
      <p className="text-xs text-gray-400">{formatDateTime(event.created_at)}</p>
    </div>
  );
}
