import { useQuery } from "@tanstack/react-query";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import type { Product, RFQ } from "@/types/intake";

export type AgentRfqStatus = "open" | "processing" | "quoted" | "closed";

/** Shared react-query wiring for the agent dashboard's KPI/Kanban data —
 * used by both AgentDashboardDesktop and AgentDashboardMobile so the two
 * files never duplicate fetch logic (mirrors useLoginForm's role). */
export function useAgentDashboardData() {
  const { data: allRfqs } = useQuery({
    queryKey: ["agent-all-rfqs"],
    queryFn: () => intakeService.list({ limit: 50 }),
    staleTime: 15_000,
  });

  const { data: openStats } = useQuery({ queryKey: ["rfqs-open"], queryFn: () => intakeService.list({ status: "open", limit: 1 }), staleTime: 30_000 });
  const { data: quotedStats } = useQuery({ queryKey: ["rfqs-quoted"], queryFn: () => intakeService.list({ status: "quoted", limit: 1 }), staleTime: 30_000 });
  const { data: closedStats } = useQuery({ queryKey: ["rfqs-closed"], queryFn: () => intakeService.list({ status: "closed", limit: 1 }), staleTime: 30_000 });

  // Accepted quotations feed both the "revenue this month" stat and the
  // "completed" Kanban column's dollar figures — real data, not a placeholder.
  const { data: acceptedQuotes } = useQuery({
    queryKey: ["agent-accepted-quotes"],
    queryFn: () => quotationService.list({ status: "accepted", limit: 100 }),
    staleTime: 30_000,
  });

  const items = allRfqs?.items ?? [];
  const rfqIds = items.map((r) => r.id);

  const { data: productsBatch } = useQuery({
    queryKey: ["agent-products-batch", rfqIds],
    queryFn: () => intakeService.listProductsBatch(rfqIds),
    enabled: rfqIds.length > 0,
    staleTime: 30_000,
  });
  const productsMap: Record<string, Product[]> = productsBatch?.items ?? {};

  const columns: Record<AgentRfqStatus, RFQ[]> = {
    open: items.filter((r) => r.status === "open").slice(0, 4),
    processing: items.filter((r) => r.status === "processing").slice(0, 4),
    quoted: items.filter((r) => r.status === "quoted").slice(0, 4),
    closed: items.filter((r) => r.status === "closed" || r.status === "cancelled").slice(0, 2),
  };

  const awaitingReply = items.filter((r) => r.status === "open");

  const now = new Date();
  const monthlyRevenue = (acceptedQuotes?.items ?? [])
    .filter((q) => {
      const d = new Date(q.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, q) => sum + (q.grand_total ?? 0), 0);

  const stats = [
    { label: "طلبات نشطة", value: openStats?.total ?? 0, accent: false },
    { label: "في انتظار العرض", value: quotedStats?.total ?? 0, accent: false },
    { label: "مكتملة الأسبوع", value: closedStats?.total ?? 0, accent: false },
    {
      label: "إيرادات الشهر",
      value: monthlyRevenue > 0 ? `JOD ${Math.round(monthlyRevenue).toLocaleString()}` : "—",
      accent: true,
    },
  ];

  return { columns, productsMap, stats, awaitingReply };
}
