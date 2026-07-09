/**
 * Literal Tailwind class strings per role (agent → supplier-*, client →
 * importer-*), matching CLAUDE.md's color rule. Kept as full literal
 * strings (not string-concatenated) so Tailwind's content scanner picks
 * them up — see components/ui/StatusPill.tsx for the same pattern.
 */
export type OnboardingRole = "agent" | "client";

export const roleAccent: Record<
  OnboardingRole,
  { dot: string; dotInactive: string; button: string; text: string }
> = {
  agent: {
    dot: "bg-supplier-500",
    dotInactive: "bg-supplier-100",
    button: "bg-supplier-500 hover:bg-supplier-600 text-white",
    text: "text-supplier-600",
  },
  client: {
    dot: "bg-importer-500",
    dotInactive: "bg-importer-100",
    button: "bg-importer-500 hover:bg-importer-600 text-white",
    text: "text-importer-600",
  },
};
