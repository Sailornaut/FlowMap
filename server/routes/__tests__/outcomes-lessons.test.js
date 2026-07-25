import { describe, expect, it } from "vitest";

/**
 * Outcome and lesson route module tests.
 * Tests module loading and export shapes.
 * Full CRUD tests require a running Supabase instance.
 */

describe("outcomes module", () => {
  it("exports default router", async () => {
    const mod = await import("../outcomes.js");
    expect(typeof mod.default).toBe("function");
  });

  it("loads without syntax errors", async () => {
    const mod = await import("../outcomes.js");
    expect(mod).toBeDefined();
  });
});

describe("lessons module", () => {
  it("exports default router", async () => {
    const mod = await import("../lessons.js");
    expect(typeof mod.default).toBe("function");
  });

  it("loads without syntax errors", async () => {
    const mod = await import("../lessons.js");
    expect(mod).toBeDefined();
  });
});
