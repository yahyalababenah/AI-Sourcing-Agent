import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quotationService } from "@/services/quotationService";
import { orderTrackingService } from "@/services/orderTrackingService";
import { useAuth } from "@/hooks/useAuth";
import { TRACKING_PIPELINE } from "@/types/orders";
import type { TrackingStatus } from "@/types/orders";

export const TRACKING_LABELS: Record<TrackingStatus, string> = {
  awaiting_payment: "بانتظار الدفع",
  production: "قيد التصنيع",
  inland_freight: "الشحن الداخلي",
  sea_freight: "الشحن البحري",
  customs: "التخليص الجمركي",
  delivered: "تم التسليم",
};

export const TRACKING_ICONS: Record<TrackingStatus, string> = {
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

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Shared data/logic behind the shipment tracking timeline (T8.7) —
 * consumed by both OrderTrackingPageDesktop and OrderTrackingPageMobile.
 * The 6 real pipeline stages (TRACKING_PIPELINE, from the backend
 * contract) are used as-is — the task text names 5 stylized stages
 * ("تم الشحن → في البحر → وصل الميناء → التخليص → التسليم") that don't
 * map cleanly onto them (no distinct "arrived at port" stage exists, and
 * awaiting_payment/production precede shipping entirely) — inventing a
 * 5-stage pipeline to match the wording would mean fabricating a stage
 * with no backend event to back it. */
export function useOrderTrackingData() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusNotes, setStatusNotes] = useState("");

  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => quotationService.get(id!),
    enabled: !!id,
  });

  const { data: tracking, isLoading: trackingLoading, error: trackingError } = useQuery({
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
    currentIndex >= 0 && currentIndex < TRACKING_PIPELINE.length - 1 ? TRACKING_PIPELINE[currentIndex + 1] : null;

  // Honest product label: Quotation has no top-level product_name field
  // (only QuotationLineItem does) — falls back through the first real
  // line item before the quotation number, instead of reading a
  // non-existent field that would silently always be undefined.
  const shipmentLabel = quote?.line_items?.[0]?.product_name || quote?.quotation_number || "الشحنة";

  return {
    id,
    navigate,
    quote,
    quoteLoading,
    quoteError,
    tracking,
    trackingLoading,
    trackingError,
    updateMutation,
    statusNotes,
    setStatusNotes,
    currentIndex,
    isAgentOrAdmin,
    nextStatus,
    shipmentLabel,
  };
}
