import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ClientProfileDesktop } from "./ClientProfileDesktop";
import { ClientProfileMobile } from "./ClientProfileMobile";

// Thin breakpoint switcher — same pattern as every other screen in the
// migration (LoginPage, ReelsStudioPage, ClientReelsPage, ...).
export function ClientProfilePage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <ClientProfileDesktop /> : <ClientProfileMobile />;
}
