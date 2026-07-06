import { useQuery, useQueryClient } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoringService";
import { pricingService } from "@/services/pricingService";

// Shared data fetch for AdminDashboardDesktop/Mobile — same split-file
// pattern as every other dashboard (see useAgentDashboardData.ts).
export function useAdminDashboardData() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => monitoringService.getStats(),
    staleTime: 30_000,
  });

  const { data: aiCosts, isLoading: aiCostsLoading } = useQuery({
    queryKey: ["admin", "ai-costs"],
    queryFn: async () => {
      try {
        return await monitoringService.getAiCosts();
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ["admin", "pricing-rules-preview"],
    queryFn: () => pricingService.listRules({ active_only: true }),
    staleTime: 30_000,
  });

  const refreshAiCosts = () => queryClient.invalidateQueries({ queryKey: ["admin", "ai-costs"] });

  return {
    stats,
    statsLoading,
    aiCosts,
    aiCostsLoading,
    refreshAiCosts,
    activeRules: rulesData?.items ?? [],
    rulesLoading,
  };
}
