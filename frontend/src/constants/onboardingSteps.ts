import { ROUTES } from "@/constants/routes";
import type { UserRole } from "@/types/auth";

/**
 * A single welcome-carousel slide. Purely informational — no target element,
 * no navigation. Shown once, right after login, before the guided tour.
 */
export interface WelcomeSlide {
  id: string;
  titleKey: string;
  descriptionKey: string;
}

/**
 * A single guided-tour step. `target` must match a `data-tour="<target>"`
 * attribute on a real element rendered while the user is on `route`.
 *
 * Steps with a `cta` are the "interactive" steps: their primary button
 * navigates to `cta.route` and the step is considered complete the moment
 * the user *reaches* that route (see CLAUDE-reviewed forgiveness rule —
 * opening the upload screen or the RFQ form counts as done, no need to
 * actually upload a file or submit a request). Steps without a `cta` are
 * highlight-only and complete when the user clicks "next".
 */
export interface TourStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  target: string;
  route: string;
  cta?: {
    labelKey: string;
    route: string;
  };
}

export const welcomeSlides: Record<Extract<UserRole, "agent" | "client">, WelcomeSlide[]> = {
  agent: [
    {
      id: "agent-slide-cost",
      titleKey: "onboarding.welcome.agent.cost.title",
      descriptionKey: "onboarding.welcome.agent.cost.description",
    },
    {
      id: "agent-slide-catalog",
      titleKey: "onboarding.welcome.agent.catalog.title",
      descriptionKey: "onboarding.welcome.agent.catalog.description",
    },
    {
      id: "agent-slide-tracking",
      titleKey: "onboarding.welcome.agent.tracking.title",
      descriptionKey: "onboarding.welcome.agent.tracking.description",
    },
  ],
  client: [
    {
      id: "client-slide-discover",
      titleKey: "onboarding.welcome.client.discover.title",
      descriptionKey: "onboarding.welcome.client.discover.description",
    },
    {
      id: "client-slide-rfq",
      titleKey: "onboarding.welcome.client.rfq.title",
      descriptionKey: "onboarding.welcome.client.rfq.description",
    },
    {
      id: "client-slide-tracking",
      titleKey: "onboarding.welcome.client.tracking.title",
      descriptionKey: "onboarding.welcome.client.tracking.description",
    },
  ],
};

const agentSteps: TourStep[] = [
  {
    id: "agent-nav-intro",
    titleKey: "onboarding.steps.agent.navIntro.title",
    descriptionKey: "onboarding.steps.agent.navIntro.description",
    target: "tour-sidebar-nav",
    route: ROUTES.AGENT.DASHBOARD,
  },
  {
    id: "agent-calculator",
    titleKey: "onboarding.steps.agent.calculator.title",
    descriptionKey: "onboarding.steps.agent.calculator.description",
    target: "tour-nav-calculator",
    route: ROUTES.AGENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.agent.calculator.cta",
      route: ROUTES.PRICING.STANDALONE_CALC,
    },
  },
  {
    id: "agent-upload",
    titleKey: "onboarding.steps.agent.upload.title",
    descriptionKey: "onboarding.steps.agent.upload.description",
    target: "tour-nav-upload",
    route: ROUTES.AGENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.agent.upload.cta",
      route: ROUTES.DOCUMENTS.UPLOAD,
    },
  },
  {
    id: "agent-inbox",
    titleKey: "onboarding.steps.agent.inbox.title",
    descriptionKey: "onboarding.steps.agent.inbox.description",
    target: "tour-nav-supplier-inbox",
    route: ROUTES.AGENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.agent.inbox.cta",
      route: ROUTES.RFQ.SUPPLIER_INBOX,
    },
  },
  {
    id: "agent-tracking",
    titleKey: "onboarding.steps.agent.tracking.title",
    descriptionKey: "onboarding.steps.agent.tracking.description",
    target: "tour-nav-orders",
    route: ROUTES.AGENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.agent.tracking.cta",
      route: ROUTES.ORDERS.LIST,
    },
  },
  {
    id: "agent-chat-profile",
    titleKey: "onboarding.steps.agent.chatProfile.title",
    descriptionKey: "onboarding.steps.agent.chatProfile.description",
    target: "tour-nav-chat",
    route: ROUTES.AGENT.DASHBOARD,
  },
];

const clientSteps: TourStep[] = [
  {
    id: "client-nav-intro",
    titleKey: "onboarding.steps.client.navIntro.title",
    descriptionKey: "onboarding.steps.client.navIntro.description",
    target: "tour-sidebar-nav",
    route: ROUTES.CLIENT.DASHBOARD,
  },
  {
    id: "client-marketplace",
    titleKey: "onboarding.steps.client.marketplace.title",
    descriptionKey: "onboarding.steps.client.marketplace.description",
    target: "tour-nav-marketplace",
    route: ROUTES.CLIENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.client.marketplace.cta",
      route: ROUTES.CATALOG.MARKETPLACE,
    },
  },
  {
    id: "client-rfq",
    titleKey: "onboarding.steps.client.rfq.title",
    descriptionKey: "onboarding.steps.client.rfq.description",
    target: "tour-nav-new-rfq",
    route: ROUTES.CLIENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.client.rfq.cta",
      route: ROUTES.RFQ.CREATE,
    },
  },
  {
    id: "client-my-requests",
    titleKey: "onboarding.steps.client.myRequests.title",
    descriptionKey: "onboarding.steps.client.myRequests.description",
    target: "tour-nav-my-requests",
    route: ROUTES.CLIENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.client.myRequests.cta",
      route: ROUTES.RFQ.LIST,
    },
  },
  {
    id: "client-tracking",
    titleKey: "onboarding.steps.client.tracking.title",
    descriptionKey: "onboarding.steps.client.tracking.description",
    target: "tour-nav-orders",
    route: ROUTES.CLIENT.DASHBOARD,
    cta: {
      labelKey: "onboarding.steps.client.tracking.cta",
      route: ROUTES.ORDERS.LIST,
    },
  },
  {
    id: "client-chat",
    titleKey: "onboarding.steps.client.chat.title",
    descriptionKey: "onboarding.steps.client.chat.description",
    target: "tour-nav-chat",
    route: ROUTES.CLIENT.DASHBOARD,
  },
];

const stepsByRole: Partial<Record<UserRole, TourStep[]>> = {
  agent: agentSteps,
  client: clientSteps,
};

/** Returns the ordered guided-tour steps for a role, or an empty list (admin — no tour yet, see T16). */
export function getTourSteps(role: UserRole | null): TourStep[] {
  if (!role) return [];
  return stepsByRole[role] ?? [];
}

/** Returns the welcome-carousel slides for a role, or an empty list. */
export function getWelcomeSlides(role: UserRole | null): WelcomeSlide[] {
  if (role !== "agent" && role !== "client") return [];
  return welcomeSlides[role];
}
