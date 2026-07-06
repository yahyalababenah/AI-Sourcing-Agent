import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MarketplacePageDesktop } from "./MarketplacePageDesktop";
import { MarketplacePageMobile } from "./MarketplacePageMobile";

// Thin breakpoint switcher (T8.5) — CLAUDE.md forbids a single responsive
// file; the real desktop and mobile layouts live in their own files
// (MarketplacePageDesktop / MarketplacePageMobile), sharing all data/logic
// via useMarketplaceData.ts and presentational pieces via
// MarketplaceProductCard.tsx/MarketplaceRfqModal.tsx/CatalogFilters.tsx.
// Shared across all three roles (see RoleGuard on this route) — no
// per-role branching needed here, only the device switch.
export function MarketplacePage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <MarketplacePageDesktop /> : <MarketplacePageMobile />;
}
