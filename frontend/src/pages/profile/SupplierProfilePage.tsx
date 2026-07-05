import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SupplierProfileDesktop } from "./SupplierProfileDesktop";
import { SupplierProfileMobile } from "./SupplierProfileMobile";

// Thin breakpoint switcher — same pattern as every other screen in the
// migration (ClientProfilePage, ReelsStudioPage, ...).
export function SupplierProfilePage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <SupplierProfileDesktop /> : <SupplierProfileMobile />;
}
