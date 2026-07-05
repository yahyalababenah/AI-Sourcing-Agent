import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";
import type { SupplierProfile } from "@/types/auth";

/** Shared RFQ/product data + supplier identity for the reels studio — used by
 * both ReelsStudioPageDesktop and ReelsStudioPageMobile so the two layout
 * files never duplicate the catalog fetch or the factory-name/verified-badge
 * derivation (mirrors useAgentDashboardData's role). */
export function useReelsStudioData() {
  const user = useAuthStore((s) => s.user);
  const supplierId = user?.id;
  const profile = user?.profile as SupplierProfile | undefined;
  const factoryName = profile?.factory_name || user?.full_name || "مصنعي";
  const isVerified = profile?.verification_status === "verified";

  const { data, isLoading } = useQuery({
    queryKey: ["reels-my-products", supplierId],
    queryFn: () => catalogService.search({ supplier_id: supplierId, page_size: 24 }),
    enabled: !!supplierId,
  });

  return {
    products: data?.items ?? [],
    isLoading,
    factoryName,
    isVerified,
  };
}
