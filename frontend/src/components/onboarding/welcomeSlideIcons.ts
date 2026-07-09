import { Calculator, PackageOpen, Truck, Compass, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Per-slide icon for the welcome carousel — purely decorative, gives each
 *  slide a distinct visual identity instead of plain text on a blank card. */
export const welcomeSlideIcons: Record<string, LucideIcon> = {
  "agent-slide-cost": Calculator,
  "agent-slide-catalog": PackageOpen,
  "agent-slide-tracking": Truck,
  "client-slide-discover": Compass,
  "client-slide-rfq": Send,
  "client-slide-tracking": Truck,
};
