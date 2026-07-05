import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";

export type SupplierInboxTab = "exclusive" | "public";

/** Shared data/logic behind the supplier RFQ inbox (T8.2) — fetching both
 * tabs (exclusive matches + public pool, with batched RFQ/product lookups),
 * the claim/decline mutation, and a ticking `now` timestamp for the
 * per-card "time since arrival" badges — consumed by both
 * SupplierRfqInboxDesktop and SupplierRfqInboxMobile so they never
 * duplicate the fetching logic (same convention as usePricingCalculator/
 * useAgentDashboardData in earlier phases). */
export function useSupplierRfqInboxData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SupplierInboxTab>("exclusive");

  // Ticks once a minute so "منذ N د/س" badges stay current without a
  // per-card setInterval (see ElapsedTimeBadge in SupplierInboxCards.tsx).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── Exclusive matches ──
  const {
    data: matchesData,
    isLoading: matchesLoading,
    isError: matchesError,
    error: matchesErrorObj,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: ["supplier-matches"],
    queryFn: () => intakeService.listMatched({ limit: 50 }),
    refetchInterval: 30_000, // keeps countdown-timer deadlines fresh
    staleTime: 10_000,
  });

  const matches = matchesData?.items ?? [];
  const matchRfqIds = matches.map((m) => m.rfq_id);

  const { data: matchRfqBatch, isLoading: loadingMatchRfqs } = useQuery({
    queryKey: ["supplier-rfqs-batch", matchRfqIds],
    queryFn: () => intakeService.getBatch(matchRfqIds),
    enabled: matchRfqIds.length > 0,
    staleTime: 30_000,
  });

  const { data: matchProductsBatch, isLoading: loadingMatchProducts } = useQuery({
    queryKey: ["supplier-products-batch", matchRfqIds],
    queryFn: () => intakeService.listProductsBatch(matchRfqIds),
    enabled: matchRfqIds.length > 0,
    staleTime: 30_000,
  });

  const matchRfqMap = matchRfqBatch?.items ?? {};
  const matchProductsMap = matchProductsBatch?.items ?? {};
  const loadingMatchDetails = loadingMatchRfqs || loadingMatchProducts;

  const claimMutation = useMutation({
    mutationFn: ({ matchId, action }: { matchId: string; action: "respond" | "decline" }) =>
      intakeService.claimMatch(matchId, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-matches"] });
    },
  });

  // ── Public pool ──
  const {
    data: publicRfqsData,
    isLoading: publicLoading,
    isError: publicError,
    error: publicErrorObj,
    refetch: refetchPublic,
  } = useQuery({
    queryKey: ["public-rfqs"],
    queryFn: () => intakeService.listPublic({ limit: 50 }),
    staleTime: 15_000,
  });

  const publicRfqs = publicRfqsData?.items ?? [];
  const publicRfqIds = publicRfqs.map((r) => r.id);

  const { data: publicProductsBatch, isLoading: loadingPublicProducts } = useQuery({
    queryKey: ["public-products-batch", publicRfqIds],
    queryFn: () => intakeService.listProductsBatch(publicRfqIds),
    enabled: publicRfqIds.length > 0,
    staleTime: 30_000,
  });

  const publicProductsMap = publicProductsBatch?.items ?? {};

  const handleQuote = (rfqId: string) => navigate(ROUTES.RFQ.BUILD_QUOTE(rfqId));

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["supplier-matches"] });
    queryClient.invalidateQueries({ queryKey: ["public-rfqs"] });
  };

  return {
    activeTab,
    setActiveTab,
    now,

    matches,
    matchesLoading,
    matchesError,
    matchesErrorObj,
    refetchMatches,
    matchRfqMap,
    matchProductsMap,
    loadingMatchDetails,
    claimMutation,

    publicRfqs,
    publicLoading,
    publicError,
    publicErrorObj,
    refetchPublic,
    publicProductsMap,
    loadingPublicProducts,

    handleQuote,
    handleRefreshAll,
  };
}
