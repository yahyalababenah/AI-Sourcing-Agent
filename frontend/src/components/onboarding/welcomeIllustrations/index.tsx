import type { FC } from "react";
import { roleAccent, type OnboardingRole } from "../roleAccent";
import { CalculatorIllustration } from "./CalculatorIllustration";
import { PackageIllustration } from "./PackageIllustration";
import { TruckIllustration } from "./TruckIllustration";
import { CompassIllustration } from "./CompassIllustration";
import { PaperPlaneIllustration } from "./PaperPlaneIllustration";
import "./illustrations.css";

/** Maps each welcome slide to its bespoke animated scene (see
 *  constants/onboardingSteps.ts for slide ids). */
const illustrationBySlide: Record<string, FC> = {
  "agent-slide-cost": CalculatorIllustration,
  "agent-slide-catalog": PackageIllustration,
  "agent-slide-tracking": TruckIllustration,
  "client-slide-discover": CompassIllustration,
  "client-slide-rfq": PaperPlaneIllustration,
  "client-slide-tracking": TruckIllustration,
};

interface WelcomeIllustrationProps {
  slideId: string;
  role: OnboardingRole;
  /** Sizing utilities (h-/w-) from the caller — desktop and mobile differ. */
  className?: string;
}

/**
 * Renders a slide's animated illustration inside a role-tinted rounded
 * "stage". The scenes are monochrome line-art drawn in `currentColor`,
 * which the stage sets to the role ink — so a single component tints
 * itself for agent (emerald) or client (navy) with no per-scene branching.
 *
 * The caller keys this by slide id, so advancing the carousel remounts the
 * illustration and replays its one-shot entrance.
 */
export function WelcomeIllustration({ slideId, role, className = "" }: WelcomeIllustrationProps) {
  const Illustration = illustrationBySlide[slideId];
  if (!Illustration) return null;
  const accent = roleAccent[role];

  return (
    <div
      className={`wi-stage flex items-center justify-center rounded-[28px] bg-gradient-to-br p-4 shadow-sm ${accent.illStage} ${accent.illInk} ${className}`}
    >
      <Illustration />
    </div>
  );
}
