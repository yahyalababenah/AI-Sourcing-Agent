import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GLOSSARY } from "@/constants/glossary";
import { Tooltip } from "@/components/ui/Tooltip";

interface GlossaryTermProps {
  /**
   * The term key in the GLOSSARY dictionary.
   * Must match one of the keys in `@/constants/glossary`.
   */
  term: string;
  /**
   * Optional custom display content.
   * Defaults to the term key itself if omitted.
   */
  children?: ReactNode;
  /** Optional class name for the term text. */
  className?: string;
}

/**
 * Renders a term with a dotted underline and a question-mark cursor, showing
 * a tooltip with the term's Arabic explanation from the GLOSSARY on hover.
 *
 * @example
 * ```tsx
 * // Renders "CBM" with its glossary tooltip
 * <GlossaryTerm term="CBM" />
 *
 * // Renders custom text with the glossary tooltip for "HS Code"
 * <GlossaryTerm term="HS Code">HS Code</GlossaryTerm>
 *
 * // With custom classes
 * <GlossaryTerm term="FOB" className="text-sm" />
 * ```
 */
export function GlossaryTerm({ term, children, className }: GlossaryTermProps) {
  const explanation = GLOSSARY[term];

  // If the term isn't in the glossary, render plain text without a tooltip
  if (!explanation) {
    return (
      <span className={cn("text-slate-900", className)}>
        {children ?? term}
      </span>
    );
  }

  return (
    <Tooltip content={explanation}>
      <span
        className={cn(
          "cursor-help border-b border-dotted border-slate-400 text-slate-900 transition-colors duration-150 hover:text-supplier-600",
          className
        )}
      >
        {children ?? term}
      </span>
    </Tooltip>
  );
}
