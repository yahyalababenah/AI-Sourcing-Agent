import { useQuery } from "@tanstack/react-query";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { catalogService } from "@/services/catalogService";
import type { Product, RFQ } from "@/types/intake";
import type { Quotation } from "@/types/quotes";

export type ClientRfqStatus = "open" | "processing" | "quoted" | "closed";

/** Shared react-query wiring for the client (importer) dashboard — used by
 * both ClientDashboardDesktop and ClientDashboardMobile so the two files
 * never duplicate fetch logic (mirrors useAgentDashboardData's role). */
export function useClientDashboardData() {
  const rfqsQuery = useQuery({
    queryKey: ["client-all-rfqs"],
    queryFn: () => intakeService.list({ limit: 50 }),
    staleTime: 15_000,
  });

  const quotesQuery = useQuery({
    queryKey: ["client-all-quotes"],
    queryFn: () => quotationService.list({ limit: 100 }),
    staleTime: 15_000,
  });

  const catalogQuery = useQuery({
    queryKey: ["client-dashboard-catalog-preview"],
    queryFn: () => catalogService.search({ page_size: 4 }),
    staleTime: 30_000,
  });

  const rfqs = rfqsQuery.data?.items ?? [];
  const quotes = quotesQuery.data?.items ?? [];
  const rfqIds = rfqs.map((r) => r.id);

  const productsBatchQuery = useQuery({
    queryKey: ["client-products-batch", rfqIds],
    queryFn: () => intakeService.listProductsBatch(rfqIds),
    enabled: rfqIds.length > 0,
    staleTime: 30_000,
  });
  const productsMap: Record<string, Product[]> = productsBatchQuery.data?.items ?? {};

  // Latest quotation per RFQ — used to show a real total next to each row
  // instead of a fabricated figure.
  const quotesByRfq = new Map<string, Quotation>();
  for (const q of quotes) {
    const existing = quotesByRfq.get(q.rfq_id);
    if (!existing || new Date(q.created_at) > new Date(existing.created_at)) {
      quotesByRfq.set(q.rfq_id, q);
    }
  }

  const latestQuote = [...quotes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  const activeCount = rfqs.filter((r) => r.status === "open" || r.status === "processing").length;
  const awaitingReplyCount = rfqs.filter((r) => r.status === "open").length;

  const now = new Date();
  const completedThisMonthCount = rfqs.filter((r) => {
    if (r.status !== "closed") return false;
    const d = new Date(r.updated_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Honest average response time: hours between an RFQ's creation and its
  // first quotation, averaged over RFQs that actually received one — no
  // fabricated number when a supplier hasn't answered yet.
  const responseHours = rfqs
    .map((r) => {
      const quote = quotesByRfq.get(r.id);
      if (!quote) return null;
      const hours = (new Date(quote.created_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
      return hours > 0 ? hours : null;
    })
    .filter((h): h is number => h != null);
  const avgResponseHours =
    responseHours.length > 0 ? Math.round(responseHours.reduce((a, b) => a + b, 0) / responseHours.length) : null;

  const stats = [
    { label: "متوسط زمن الرد", value: avgResponseHours != null ? `${avgResponseHours}h` : "—" },
    { label: "بانتظار الرد", value: awaitingReplyCount },
    { label: "طلبات نشطة", value: activeCount },
    { label: "صفقات مكتملة هذا الشهر", value: completedThisMonthCount },
  ];

  const recentRfqs: RFQ[] = [...rfqs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const catalogItems = catalogQuery.data?.items ?? [];

  return {
    isLoading: rfqsQuery.isLoading,
    latestQuote,
    quotesByRfq,
    productsMap,
    stats,
    recentRfqs,
    catalogItems,
    catalogLoading: catalogQuery.isLoading,
  };
}
