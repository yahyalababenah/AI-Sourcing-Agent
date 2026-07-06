import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import type { OrderStatus } from "@/components/ui/StatusPill";
import type { Quotation } from "@/types/quotes";

export type RfqFilterStatus = "open" | "processing" | "quoted" | "closed" | "cancelled";

export const RFQ_FILTERS: { value: RfqFilterStatus | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "open", label: "مفتوح" },
  { value: "processing", label: "قيد المعالجة" },
  { value: "quoted", label: "تم التسعير" },
  { value: "closed", label: "مغلق" },
  { value: "cancelled", label: "ملغي" },
];

// Same RFQ-status→StatusPill mapping used on the client dashboard (T4.1,
// useClientDashboardData's callers) — "cancelled" additionally maps onto
// the "rejected" bucket added in T8.3 (no direct RFQ-lifecycle equivalent
// existed before that).
const STATUS_PILL: Record<string, OrderStatus> = {
  open: "pending",
  processing: "under_review",
  quoted: "negotiating",
  closed: "completed",
  cancelled: "rejected",
};

export function rfqStatusPill(status: string): OrderStatus {
  return STATUS_PILL[status] ?? "pending";
}

const PAGE_SIZE = 10;

/** Shared data/logic behind the client's "طلباتي" list (T8.4) — the same
 * /rfq route agents use for "طلبات الشراء" (still the unchanged legacy
 * table for them, see RFQListPage.tsx), rebuilt here from the importer's
 * angle: each RFQ row also carries its latest quote's value via the same
 * quotesByRfq batch-join pattern as useClientDashboardData.ts, instead of
 * just RFQ-level fields. */
export function useClientRfqListData() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<RfqFilterStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["client-rfqs-list", statusFilter, page],
    queryFn: () => intakeService.list({ status: statusFilter, page, limit: PAGE_SIZE }),
  });

  const rfqs = data?.items ?? [];
  const rfqIds = rfqs.map((r) => r.id);

  const { data: quotesData } = useQuery({
    queryKey: ["client-rfq-list-quotes", rfqIds],
    queryFn: () => quotationService.list({ limit: 100 }),
    enabled: rfqIds.length > 0,
    staleTime: 15_000,
  });

  const quotesByRfq = new Map<string, Quotation>();
  for (const q of quotesData?.items ?? []) {
    const existing = quotesByRfq.get(q.rfq_id);
    if (!existing || new Date(q.created_at) > new Date(existing.created_at)) {
      quotesByRfq.set(q.rfq_id, q);
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  const handleFilterChange = (status: RfqFilterStatus | "all") => {
    setStatusFilter(status === "all" ? undefined : status);
    setPage(1);
  };

  const handleView = (id: string) => navigate(ROUTES.RFQ.DETAIL(id));
  const handleNewRfq = () => navigate(ROUTES.RFQ.CREATE);

  return {
    rfqs,
    quotesByRfq,
    isLoading,
    isError,
    error,
    refetch,
    statusFilter,
    handleFilterChange,
    page,
    setPage,
    totalPages,
    total: data?.total ?? 0,
    handleView,
    handleNewRfq,
  };
}
