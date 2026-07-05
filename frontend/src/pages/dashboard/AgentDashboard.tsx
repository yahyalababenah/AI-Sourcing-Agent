import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AgentDashboardDesktop } from "./AgentDashboardDesktop";
import { AgentDashboardMobile } from "./AgentDashboardMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (AgentDashboardDesktop / AgentDashboardMobile).
export function AgentDashboard() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <AgentDashboardDesktop /> : <AgentDashboardMobile />;
}
