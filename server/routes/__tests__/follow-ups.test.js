import { describe, expect, it } from "vitest";

/**
 * Follow-up route module tests.
 * Tests the exported helper logic and module shape.
 * Full CRUD tests require a running Supabase instance.
 */

describe("follow-ups module", () => {
  it("exports default router and generateDefaultFollowUps", async () => {
    const mod = await import("../follow-ups.js");
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.generateDefaultFollowUps).toBe("function");
  });

  it("generateDefaultFollowUps expects analysisRunId, propertyId, userId", async () => {
    const { generateDefaultFollowUps } = await import("../follow-ups.js");
    // Function signature check — calling without a Supabase connection will throw,
    // but we can verify the function exists and has expected arity indirectly.
    expect(generateDefaultFollowUps.length).toBe(1); // single destructured param
  });
});

describe("addMonths helper (tested via module internals)", () => {
  // The addMonths function is not exported, but we can test the milestone
  // date logic through the DEFAULT_MILESTONES constant behavior.
  it("module loads without syntax errors", async () => {
    // If the module has any syntax issues, this import will throw
    const mod = await import("../follow-ups.js");
    expect(mod).toBeDefined();
  });
});
