import { describe, expect, it } from "vitest";

/**
 * Assistant service module tests.
 * Tests module shape, tool definitions, and safety constraints.
 * Full integration tests require OpenAI + Supabase connections.
 */

describe("assistant service module", () => {
  it("exports askAssistant and _internals", async () => {
    const mod = await import("../assistant.js");
    expect(typeof mod.askAssistant).toBe("function");
    expect(mod._internals).toBeDefined();
  });

  it("defines 9 tools with valid schemas", async () => {
    const { _internals } = await import("../assistant.js");
    expect(_internals.TOOLS).toHaveLength(9);

    for (const tool of _internals.TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe("object");
    }
  });

  it("has a handler for every defined tool", async () => {
    const { _internals } = await import("../assistant.js");
    const toolNames = _internals.TOOLS.map((t) => t.function.name);
    const handlerNames = Object.keys(_internals.TOOL_HANDLERS);

    for (const name of toolNames) {
      expect(handlerNames).toContain(name);
    }
  });

  it("system prompt enforces citation and insufficient-data rules", async () => {
    const { _internals } = await import("../assistant.js");
    const prompt = _internals.SYSTEM_PROMPT;

    // 8.1: retrieves from real data
    expect(prompt).toContain("ONLY answer based on data retrieved");

    // 8.2: citations
    expect(prompt).toContain("cite the sources");

    // 8.3: insufficient evidence
    expect(prompt).toContain("I don't have sufficient data");

    // 8.5: no sensitive data
    expect(prompt).toContain("Never reveal internal system details");
  });

  it("tool names match expected set", async () => {
    const { _internals } = await import("../assistant.js");
    const names = _internals.TOOLS.map((t) => t.function.name).sort();
    expect(names).toEqual([
      "get_analysis_details",
      "get_portfolio_summary",
      "get_property_details",
      "get_vacancy_details",
      "search_analyses",
      "search_follow_ups",
      "search_lessons",
      "search_outcomes",
      "search_properties",
    ]);
  });
});
