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
});
