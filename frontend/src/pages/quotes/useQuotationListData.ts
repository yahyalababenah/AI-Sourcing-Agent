import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { quotationService } from "@/services/quotationService";
import type { OrderStatus } from "@/components/ui/StatusPill";
import type { Quotation } from "@/types/quotes";

// Real quote statuses (draft/pending/finalized/sent/accepted/rejected, per
// quotationService's own status transitions) collapsed onto StatusPill's
// shared OrderStatus set — same convention as the RFQ status→StatusPill
// map used on the agent/client dashboards. "finalized" (PDF generated,
// not yet delivered) reads as "تحت المراجعة" and "sent" (delivered,
// awaiting the client's decision) as "جارٍ التفاوض".
const QUOTE_STATUS_PILL: Record<string, OrderStatus> = {
  draft: "pending",
  pending: "pending",
  finalized: "under_review",
  sent: "negotiating",
  accepted: "completed",
  rejected: "rejected",
};

export function quoteStatusPill(status: string): OrderStatus {
  return QUOTE_STATUS_PILL[status] ?? "pending";
}

export const TRACKING_LABELS: Record<string, string> = {
  awaiting_payment: "بانتظار الدفع",
  production: "قيد التصنيع",
  inland_freight: "الشحن الداخلي",
  sea_freight: "الشحن البحري",
  customs: "التخليص الجمركي",
  delivered: "تم التسليم",
};

/** tracking_status is set by the backend but was never added to the
 * Quotation type (see QuotationDetailPage/OrdersListPage for the same
 * pre-existing `as any` cast) — kept consistent with that established
 * pattern rather than fixing the type as an unrelated side change. */
export function quoteTrackingStatus(q: Quotation): string | undefined {
  return (q as { tracking_status?: string }).tracking_status;
}

/** Shared data/logic behind the agent's "عروض الأسعار" table (T8.3) —
 * consumed by both QuotationListPageDesktop and QuotationListPageMobile. */
export function useQuotationListData() {
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quotations"],
    queryFn: () => quotationService.list(),
  });

  const quotations = data?.items ?? [];

  const handleView = (id: string) => navigate(ROUTES.QUOTES.DETAIL(id));
  const handleTrack = (id: string) => navigate(ROUTES.ORDERS.TRACKING(id));

  return {
    quotations,
    isLoading,
    isError,
    error,
    refetch,
    handleView,
    handleTrack,
  };
}
