import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SupplierRfqInboxDesktop } from "./SupplierRfqInboxDesktop";
import { SupplierRfqInboxMobile } from "./SupplierRfqInboxMobile";

// Thin breakpoint switcher (T8.2) — CLAUDE.md forbids a single responsive
// file; the real desktop and mobile layouts live in their own files
// (SupplierRfqInboxDesktop / SupplierRfqInboxMobile), sharing all
// data/logic via useSupplierRfqInboxData.ts and presentational pieces via
// SupplierInboxCards.tsx. Same convention as PricingCalcPage/AgentDashboard.
export function SupplierRfqInbox() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <SupplierRfqInboxDesktop /> : <SupplierRfqInboxMobile />;
}
