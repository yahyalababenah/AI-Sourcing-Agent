import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CompletionCardDesktop } from "./CompletionCardDesktop";
import { CompletionCardMobile } from "./CompletionCardMobile";
import type { OnboardingRole } from "./roleAccent";

interface CompletionCardProps {
  role: OnboardingRole;
  onDismiss: () => void;
}

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files.
export function CompletionCard(props: CompletionCardProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <CompletionCardDesktop {...props} /> : <CompletionCardMobile {...props} />;
}
