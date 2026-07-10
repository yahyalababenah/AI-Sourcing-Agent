import { describe, expect, it } from "vitest";
import { getTourSteps, getWelcomeSlides } from "../onboardingSteps";

describe("onboardingSteps resolvers", () => {
  it("returns agent steps for role=agent", () => {
    const steps = getTourSteps("agent");
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.id.startsWith("agent-"))).toBe(true);
  });

  it("returns client steps for role=client", () => {
    const steps = getTourSteps("client");
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.id.startsWith("client-"))).toBe(true);
  });

  it("returns no steps for admin or null role", () => {
    expect(getTourSteps("admin")).toEqual([]);
    expect(getTourSteps(null)).toEqual([]);
  });

  it("every step has a unique id", () => {
    const ids = getTourSteps("agent").map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns welcome slides for agent and client only", () => {
    expect(getWelcomeSlides("agent").length).toBeGreaterThan(0);
    expect(getWelcomeSlides("client").length).toBeGreaterThan(0);
    expect(getWelcomeSlides("admin")).toEqual([]);
    expect(getWelcomeSlides(null)).toEqual([]);
  });

  // Feedback: the tour should take the user *inside* each feature and walk
  // them through completing their first real action, not just highlight a
  // sidebar link. The calculator/RFQ mini-walkthroughs share their parent
  // step's route so GuidedTour moves the Spotlight between them without an
  // extra navigation — this locks in that contract.
  it("keeps the calculator mini-walkthrough steps consecutive and on the same route", () => {
    const steps = getTourSteps("agent");
    const ids = ["agent-calculator", "agent-calculator-quantity", "agent-calculator-price", "agent-calculator-submit", "agent-calculator-result"];
    const indices = ids.map((id) => steps.findIndex((s) => s.id === id));
    expect(indices).toEqual(indices.slice().sort((a, b) => a - b)); // consecutive, in order
    expect(indices.every((i) => i >= 0)).toBe(true);

    const routes = new Set(ids.map((id) => steps.find((s) => s.id === id)!.route));
    expect(routes.size).toBe(1); // all on the calculator page itself
  });

  it("keeps the RFQ mini-walkthrough steps consecutive and on the same route", () => {
    const steps = getTourSteps("client");
    const ids = ["client-rfq", "client-rfq-product-name", "client-rfq-quantity", "client-rfq-submit"];
    const indices = ids.map((id) => steps.findIndex((s) => s.id === id));
    expect(indices).toEqual(indices.slice().sort((a, b) => a - b));
    expect(indices.every((i) => i >= 0)).toBe(true);

    const routes = new Set(ids.map((id) => steps.find((s) => s.id === id)!.route));
    expect(routes.size).toBe(1); // all on the RFQ create page itself
  });
});
