import { useMediaQuery } from "@/hooks/useMediaQuery";
import { OrderTrackingPageDesktop } from "./OrderTrackingPageDesktop";
import { OrderTrackingPageMobile } from "./OrderTrackingPageMobile";

// Thin breakpoint switcher (T8.7) — real layouts live in
// OrderTrackingPageDesktop/Mobile, sharing useOrderTrackingData.ts,
// ShipmentTimeline.tsx, TrackingStatusUpdatePanel.tsx, and
// TrackingEventHistory.tsx. Role-aware content (agent/admin update
// controls) is handled inside the shared hook/components, not here.
export function OrderTrackingPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <OrderTrackingPageDesktop /> : <OrderTrackingPageMobile />;
}
