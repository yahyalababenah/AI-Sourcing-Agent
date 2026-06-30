import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { quotationService } from "@/services/quotationService";
import { orderTrackingService } from "@/services/orderTrackingService";
import type { TrackingStatus, TrackingEvent } from "@/types/orders";
import { TRACKING_PIPELINE } from "@/types/orders";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

// ── Arabic labels & helpers ──────────────────────────────────────────────────

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

function getPipelineIndex(status: string | null): number {
  if (!status) return -1;
  return TRACKING_PIPELINE.indexOf(status as TrackingStatus);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusNotes, setStatusNotes] = useState("");

  const {
    data: quote,
    isLoading: quoteLoading,
    error: quoteError,
  } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => quotationService.get(id!),
    enabled: !!id,
  });

  const {
    data: tracking,
    isLoading: trackingLoading,
    error: trackingError,
  } = useQuery({
    queryKey: ["tracking", id],
    queryFn: () => orderTrackingService.getTracking(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: (status: string) =>
      orderTrackingService.updateTracking(id!, { status, notes: statusNotes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking", id] });
      setStatusNotes("");
    },
  });

  const currentIndex = getPipelineIndex(tracking?.current_status ?? null);
  const isAgentOrAdmin = user?.role === "agent" || user?.role === "admin";
  const nextStatus: TrackingStatus | null =
    currentIndex >= 0 && currentIndex < TRACKING_PIPELINE.length - 1
      ? TRACKING_PIPELINE[currentIndex + 1]
      : null;

  const panelStyle = { background: "var(--surface)", border: "1px solid var(--border)" } as React.CSSProperties;

  // ── Loading ──
  if (quoteLoading || trackingLoading) {
    return (
      <div className="rounded-xl p-12 text-center" style={panelStyle}>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#059669]/20 border-t-[#059669]" />
        <p className="mt-4 text-sm" style={{ color: "var(--text-2)" }}>جاري تحميل معلومات التتبع...</p>
      </div>
    );
  }

  // ── Error ──
  if (quoteError || trackingError || !quote) {
    return (
      <div className="rounded-xl p-12 text-center" style={panelStyle}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--error-surface)" }}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium" style={{ color: "var(--text-1)" }}>خطأ في تحميل التتبع</h3>
        <p className="mt-2 text-sm" style={{ color: "#dc2626" }}>
          {(trackingError as Error)?.message || (quoteError as Error)?.message || "لم يتم العثور على الطلب"}
        </p>
        <button
          onClick={() => navigate(ROUTES.QUOTES.LIST)}
          className="mt-4 text-sm"
          style={{ color: "#059669" }}
        >
          العودة إلى عروض الأسعار
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl" style={{ color: "var(--text-1)" }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 rounded-lg"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.QUOTES.DETAIL(id!))}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--text-1)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ color: "var(--text-1)" }}>
              <path d="M13 6l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div className="text-[14px] font-bold" style={{ color: "var(--text-1)" }}>تتبع الطلب</div>
            <div className="text-[10px] font-mono" style={{ color: "var(--text-2)" }} dir="ltr">
              #{tracking?.quotation_number || id?.slice(0, 8)}
            </div>
          </div>
        </div>
        {tracking?.current_status && (
          <div
            className="text-[10px] font-bold px-3 py-1 rounded"
            style={{ background: "var(--accent-surface)", border: "1px solid var(--accent-border)", color: "#10b981" }}
          >
            {TRACKING_LABELS[tracking.current_status as TrackingStatus] || tracking.current_status}
          </div>
        )}
      </div>

      {/* ── Order summary ── */}
      <div className="rounded-lg p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} dir="rtl">
        <div className="text-[13px] font-bold mb-1" style={{ color: "var(--text-1)" }}>
          {(quote as any).product_name || quote.quotation_number || "الشحنة"}
        </div>
        <div className="text-[11px] mb-4" style={{ color: "var(--text-2)" }}>الصين → الأردن</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "القيمة",           value: `$${quote.grand_total?.toLocaleString() ?? "—"}` },
            { label: "التسليم المتوقع",  value: "10 أغسطس" },
            { label: "المرحلة",          value: `${currentIndex + 1} / ${TRACKING_PIPELINE.length}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md p-2 text-center" style={{ background: "var(--surface-3)" }}>
              <div className="text-[10px] mb-1" style={{ color: "var(--text-2)" }}>{label}</div>
              <div className="text-[12px] font-bold" style={{ color: "var(--text-1)" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="rounded-lg px-4 pb-6 pt-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-[11px] font-bold mb-4 tracking-wide" style={{ color: "var(--text-2)" }}>
          مراحل الشحنة
        </div>
        <div className="flex flex-col gap-0">
          {TRACKING_PIPELINE.map((status, idx) => {
            const achieved  = currentIndex >= idx;
            const isCurrent = currentIndex === idx;
            const isPending = idx > currentIndex;
            const isLast    = idx === TRACKING_PIPELINE.length - 1;

            return (
              <div key={status} className="flex gap-3 items-start">
                {/* Dot + Line */}
                <div className="flex flex-col items-center shrink-0 w-5">
                  {achieved && !isCurrent ? (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "#059669" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--accent-surface)", border: "2px solid #10b981" }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: "#10b981", animation: "dotPulse 1.5s ease infinite" }} />
                    </div>
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--surface-2)", border: "2px solid var(--border)" }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border)" }} />
                    </div>
                  )}
                  {!isLast && (
                    <div
                      className="w-0.5 flex-1 min-h-[16px] my-1"
                      style={{ background: achieved && !isCurrent ? "var(--accent-border)" : "var(--border)" }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-3">
                  <div
                    className="rounded-lg px-3 py-2.5"
                    style={{
                      background:  isCurrent ? "var(--accent-surface-deep)" : isPending ? "var(--surface-2)" : "var(--accent-surface)",
                      border:      isCurrent ? "1.5px solid var(--accent-border)" : isPending ? "1px solid var(--border)" : "1px solid var(--accent-border)",
                      opacity:     isPending ? 0.65 : 1,
                    }}
                    dir="rtl"
                  >
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span
                        className="text-[12px] font-bold"
                        style={{ color: isPending ? "var(--text-4)" : "var(--text-1)" }}
                      >
                        {TRACKING_LABELS[status as TrackingStatus]}
                      </span>
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: isCurrent ? "#10b981" : isPending ? "var(--text-3)" : "#10b981" }}
                      >
                        {isCurrent ? "جارٍ الآن" : isPending ? "قادم" : "مكتمل"}
                      </span>
                    </div>
                    {isCurrent && (
                      <>
                        <div className="text-[10px] mb-2" style={{ color: "#059669" }}>
                          قيد التنفيذ — المرحلة {idx + 1} من {TRACKING_PIPELINE.length}
                        </div>
                        <div className="rounded h-1.5 mb-1.5" style={{ background: "var(--border)" }}>
                          <div
                            className="h-full rounded"
                            style={{ width: "65%", background: "linear-gradient(90deg,#059669,#10b981)" }}
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[9.5px]" style={{ color: "#059669" }}>65% مكتمل</span>
                          <span className="text-[9.5px]" style={{ color: "var(--text-2)" }}>جارٍ المعالجة</span>
                        </div>
                      </>
                    )}
                    {achieved && !isCurrent && tracking?.events && (
                      <EventInfo events={tracking.events} status={status} isCurrent={false} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status Update (Agent/Admin only) ── */}
      {isAgentOrAdmin && nextStatus && (
        <div className="rounded-lg p-5" style={panelStyle}>
          <h3 className="text-[13px] font-bold mb-4" style={{ color: "var(--text-1)" }}>تحديث حالة التتبع</h3>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)..."
              className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none min-w-[200px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
            />
            <button
              onClick={() => updateMutation.mutate(nextStatus)}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-[13px] font-bold text-white rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: "#059669" }}
            >
              {updateMutation.isPending ? "جاري..." : `تحديث → ${TRACKING_LABELS[nextStatus]}`}
            </button>
          </div>
          {updateMutation.isError && (
            <p className="mt-2 text-[12px]" style={{ color: "#dc2626" }}>
              {updateMutation.error?.message || "فشل التحديث"}
            </p>
          )}
        </div>
      )}

      {/* ── Quick actions (Agent/Admin) ── */}
      {isAgentOrAdmin && currentIndex >= 0 && (
        <div className="rounded-lg p-5" style={panelStyle}>
          <h3 className="text-[13px] font-bold mb-3" style={{ color: "var(--text-1)" }}>إجراءات سريعة</h3>
          <div className="flex flex-wrap gap-2">
            {TRACKING_PIPELINE.map((status, idx) => {
              if (idx <= currentIndex) return null;
              return (
                <button
                  key={status}
                  onClick={() => updateMutation.mutate(status)}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-md transition-all disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", color: "var(--text-4)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  {TRACKING_ICONS[status as TrackingStatus]} {TRACKING_LABELS[status as TrackingStatus]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Event History ── */}
      {tracking?.events && tracking.events.length > 0 && (
        <div className="rounded-xl p-6" style={panelStyle}>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-1)" }}>سجل التحديثات</h2>
          <div className="space-y-3">
            {[...tracking.events].reverse().map((event: TrackingEvent) => (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg p-3"
                style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ background: "var(--accent-surface)", color: "#059669" }}
                >
                  ↻
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium" style={{ color: "var(--text-1)" }}>
                      {event.from_status
                        ? TRACKING_LABELS[event.from_status as TrackingStatus] || event.from_status
                        : "—"}
                    </span>
                    <span style={{ color: "var(--text-3)" }}>→</span>
                    <span className="font-medium" style={{ color: "#059669" }}>
                      {TRACKING_LABELS[event.to_status as TrackingStatus] || event.to_status}
                    </span>
                  </div>
                  {event.notes && (
                    <p className="mt-1 text-xs" style={{ color: "var(--text-2)" }}>{event.notes}</p>
                  )}
                  <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
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

// ── EventInfo sub-component ──────────────────────────────────────────────────

function EventInfo({
  events, status, isCurrent,
}: { events: TrackingEvent[]; status: string; isCurrent: boolean }) {
  const event = events.find((e) => e.to_status === status);
  if (!event) {
    if (isCurrent) {
      return <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>بانتظار التحديث الأول</p>;
    }
    return null;
  }
  return (
    <div className="mt-1">
      {event.notes && <p className="text-xs" style={{ color: "var(--text-2)" }}>{event.notes}</p>}
      <p className="text-xs" style={{ color: "var(--text-3)" }}>{formatDateTime(event.created_at)}</p>
    </div>
  );
}
