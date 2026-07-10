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
 * A single guided-tour step. `route` is the *real* feature page the step
 * lives on — GuidedTour navigates the user there the moment the step
 * becomes active, so the tour walks through the actual product instead of
 * just pointing at sidebar links from the dashboard (feedback: take the
 * user *inside* each feature, don't have them look at it from outside).
 *
 * `target` matches a `data-tour="<target>"` attribute — usually the
 * sidebar link for this feature (the Sidebar renders on every route inside
 * AgentLayout/ClientLayout, so it stays a valid Spotlight anchor even while
 * standing on the feature page itself, "you are here"), but a follow-up
 * step can instead target a real field/button *on* that same page (same
 * `route` as the step before it, so GuidedTour doesn't navigate again) —
 * that's how the tour walks the user through actually completing their
 * first calculation/request instead of just landing on the page.
 */
export interface TourStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  target: string;
  route: string;
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
    route: ROUTES.PRICING.STANDALONE_CALC,
  },
  // Mini walkthrough of the calculator itself — same route as the step
  // above, so GuidedTour just moves the Spotlight without navigating
  // again. Walks the rep through their first real landed-cost calculation.
  {
    id: "agent-calculator-quantity",
    titleKey: "onboarding.steps.agent.calculatorQuantity.title",
    descriptionKey: "onboarding.steps.agent.calculatorQuantity.description",
    target: "tour-calc-quantity",
    route: ROUTES.PRICING.STANDALONE_CALC,
  },
  {
    id: "agent-calculator-price",
    titleKey: "onboarding.steps.agent.calculatorPrice.title",
    descriptionKey: "onboarding.steps.agent.calculatorPrice.description",
    target: "tour-calc-price",
    route: ROUTES.PRICING.STANDALONE_CALC,
  },
  {
    id: "agent-calculator-submit",
    titleKey: "onboarding.steps.agent.calculatorSubmit.title",
    descriptionKey: "onboarding.steps.agent.calculatorSubmit.description",
    target: "tour-calc-button",
    route: ROUTES.PRICING.STANDALONE_CALC,
  },
  {
    id: "agent-calculator-result",
    titleKey: "onboarding.steps.agent.calculatorResult.title",
    descriptionKey: "onboarding.steps.agent.calculatorResult.description",
    target: "tour-calc-result",
    route: ROUTES.PRICING.STANDALONE_CALC,
  },
  {
    id: "agent-upload",
    titleKey: "onboarding.steps.agent.upload.title",
    descriptionKey: "onboarding.steps.agent.upload.description",
    target: "tour-nav-upload",
    route: ROUTES.DOCUMENTS.UPLOAD,
  },
  {
    id: "agent-inbox",
    titleKey: "onboarding.steps.agent.inbox.title",
    descriptionKey: "onboarding.steps.agent.inbox.description",
    target: "tour-nav-supplier-inbox",
    route: ROUTES.RFQ.SUPPLIER_INBOX,
  },
  {
    id: "agent-tracking",
    titleKey: "onboarding.steps.agent.tracking.title",
    descriptionKey: "onboarding.steps.agent.tracking.description",
    target: "tour-nav-orders",
    route: ROUTES.ORDERS.LIST,
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
    route: ROUTES.CATALOG.MARKETPLACE,
  },
  {
    id: "client-rfq",
    titleKey: "onboarding.steps.client.rfq.title",
    descriptionKey: "onboarding.steps.client.rfq.description",
    target: "tour-nav-new-rfq",
    route: ROUTES.RFQ.CREATE,
  },
  // Mini walkthrough of the RFQ form itself — same route as the step
  // above, so GuidedTour just moves the Spotlight without navigating
  // again. Walks the importer through submitting their first real request.
  {
    id: "client-rfq-product-name",
    titleKey: "onboarding.steps.client.rfqProductName.title",
    descriptionKey: "onboarding.steps.client.rfqProductName.description",
    target: "tour-rfq-product-name",
    route: ROUTES.RFQ.CREATE,
  },
  {
    id: "client-rfq-quantity",
    titleKey: "onboarding.steps.client.rfqQuantity.title",
    descriptionKey: "onboarding.steps.client.rfqQuantity.description",
    target: "tour-rfq-quantity",
    route: ROUTES.RFQ.CREATE,
  },
  {
    id: "client-rfq-submit",
    titleKey: "onboarding.steps.client.rfqSubmit.title",
    descriptionKey: "onboarding.steps.client.rfqSubmit.description",
    target: "tour-rfq-submit",
    route: ROUTES.RFQ.CREATE,
  },
  {
    id: "client-my-requests",
    titleKey: "onboarding.steps.client.myRequests.title",
    descriptionKey: "onboarding.steps.client.myRequests.description",
    target: "tour-nav-my-requests",
    route: ROUTES.RFQ.LIST,
  },
  {
    id: "client-tracking",
    titleKey: "onboarding.steps.client.tracking.title",
    descriptionKey: "onboarding.steps.client.tracking.description",
    target: "tour-nav-orders",
    route: ROUTES.ORDERS.LIST,
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

/**
 * A step is "sidebar-anchored" when it highlights the sidebar nav or one of
 * its links (the `tour-sidebar-nav` / `tour-nav-*` convention). This matters
 * on mobile: the Sidebar only exists on-screen inside the MobileDrawer, so
 * GuidedTour opens the drawer for these steps — and, just as importantly,
 * *closes* it for the page-anchored mini-walkthrough steps (`tour-calc-*` /
 * `tour-rfq-*`), whose targets sit on the feature page itself where an open
 * drawer would slide in and cover the very field being highlighted.
 */
export function isSidebarStep(step: TourStep): boolean {
  return step.target === "tour-sidebar-nav" || step.target.startsWith("tour-nav-");
}

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
