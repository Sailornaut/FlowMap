// @ts-check
/**
 * Internal knowledge assistant service.
 * Uses OpenAI tool-calling to query TrafficScout data and return cited answers.
 * Part of Phase 8 — Internal knowledge assistant.
 *
 * Design:
 * - Defines tool functions that query Supabase (properties, analyses, vacancies, etc.)
 * - Sends user question + tool definitions to OpenAI
 * - Iterates tool calls until the model produces a final answer
 * - Returns answer with source citations
 * - Never logs tokens, PII, or sensitive prompt content (8.5)
 */

import OpenAI from "openai";
import { getSupabaseAdmin } from "./supabase-admin.js";

/** @type {OpenAI | null} */
let openaiClient = null;

function getOpenAI() {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

// ── Tool definitions (OpenAI function-calling schema) ───────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_properties",
      description: "Search properties by name, address, city, type, or status. Returns up to 10 matching properties with basic details.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search text to match against name or address" },
          property_type: { type: "string", enum: ["shopping_center", "retail", "office", "mixed", "pad", "other"], description: "Filter by property type" },
          status: { type: "string", enum: ["active", "prospect", "archived"], description: "Filter by status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_property_details",
      description: "Get full details for a specific property including tenants and vacancies.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "UUID of the property" },
        },
        required: ["property_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_analyses",
      description: "Search analysis runs. Can filter by property, status, or depth. Returns analysis metadata and confidence levels.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "Filter by property UUID" },
          status: { type: "string", enum: ["queued", "running", "partial", "complete", "failed"], description: "Filter by status" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_analysis_details",
      description: "Get full analysis details including stage results, scoring, recommendations, and source observations.",
      parameters: {
        type: "object",
        properties: {
          analysis_id: { type: "string", description: "UUID of the analysis run" },
        },
        required: ["analysis_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_outcomes",
      description: "Search observed outcomes. Can filter by property, outcome type, prediction accuracy, or evidence type.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "Filter by property UUID" },
          outcome_type: { type: "string", enum: ["lease_signed", "tenant_opened", "vacancy_persisted", "property_sold", "renovation", "other"] },
          prediction_accuracy: { type: "string", enum: ["correct", "partially_correct", "incorrect", "not_applicable"] },
          evidence_type: { type: "string", enum: ["observation", "assumption"] },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_lessons",
      description: "Search lessons learned. Can filter by type or severity.",
      parameters: {
        type: "object",
        properties: {
          lesson_type: { type: "string", enum: ["methodology", "data_quality", "market_insight", "process", "other"] },
          severity: { type: "string", enum: ["critical", "important", "minor"] },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_follow_ups",
      description: "Search follow-ups. Can filter by property, status, or check for overdue items.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "Filter by property UUID" },
          status: { type: "string", enum: ["pending", "completed", "skipped", "overdue"] },
          overdue: { type: "boolean", description: "If true, return only overdue pending follow-ups" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_vacancy_details",
      description: "Get vacancy details for a property, including unit info, asking rent, condition, and physical characteristics.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "UUID of the property" },
        },
        required: ["property_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio_summary",
      description: "Get a high-level summary of the entire portfolio: property count, analysis count, vacancy count, outcome stats, follow-up stats.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────

/** @type {Record<string, (args: any) => Promise<{ data: any, sources: string[] }>>} */
const TOOL_HANDLERS = {
  async search_properties(args) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("properties")
      .select("id, name, address, city, state, property_type, status, total_gla_sqft, created_at")
      .order("created_at", { ascending: false })
      .limit(args.limit || 10);

    if (args.query) query = query.or(`name.ilike.%${args.query}%,address.ilike.%${args.query}%,city.ilike.%${args.query}%`);
    if (args.property_type) query = query.eq("property_type", args.property_type);
    if (args.status) query = query.eq("status", args.status);

    const { data, error } = await query;
    if (error) throw error;
    return { data, sources: (data || []).map((p) => `property:${p.id}`) };
  },

  async get_property_details(args) {
    const supabase = getSupabaseAdmin();
    const { data: property, error } = await supabase
      .from("properties")
      .select("*, tenants(id, name, category_id, unit_label, sqft, is_anchor), vacancies(id, unit_label, sqft, asking_rent_psf, rent_basis, condition, placement, vacant_since)")
      .eq("id", args.property_id)
      .single();
    if (error) throw error;
    return { data: property, sources: [`property:${args.property_id}`] };
  },

  async search_analyses(args) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("analysis_runs")
      .select("id, property_id, status, depth, started_at, finished_at, total_cost_usd, properties(name, address)")
      .order("created_at", { ascending: false })
      .limit(args.limit || 10);

    if (args.property_id) query = query.eq("property_id", args.property_id);
    if (args.status) query = query.eq("status", args.status);

    const { data, error } = await query;
    if (error) throw error;
    return { data, sources: (data || []).map((a) => `analysis:${a.id}`) };
  },

  async get_analysis_details(args) {
    const supabase = getSupabaseAdmin();
    const { data: run, error: runErr } = await supabase
      .from("analysis_runs")
      .select("*, properties(name, address, property_type)")
      .eq("id", args.analysis_id)
      .single();
    if (runErr) throw runErr;

    const [stagesRes, candidatesRes, observationsRes] = await Promise.all([
      supabase.from("analysis_stage_results").select("stage_name, status, confidence, completeness, outputs").eq("analysis_run_id", args.analysis_id),
      supabase.from("business_candidates").select("id, category_id, vacancy_id, rank, verdict, tenant_categories(name, slug), opportunity_scores(overall, confidence, positive_factors, negative_factors)").eq("analysis_run_id", args.analysis_id).order("rank"),
      supabase.from("source_observations").select("id, source_id, geographic_scope, confidence, data_sources(name, kind)").eq("analysis_run_id", args.analysis_id).limit(20),
    ]);

    return {
      data: {
        run,
        stages: stagesRes.data,
        recommendations: candidatesRes.data,
        source_observations: observationsRes.data,
      },
      sources: [`analysis:${args.analysis_id}`],
    };
  },

  async search_outcomes(args) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("observed_outcomes")
      .select("id, property_id, outcome_type, tenant_name, actual_rent_psf, rent_basis, lease_date, prediction_accuracy, evidence_type, notes, properties(name, address)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (args.property_id) query = query.eq("property_id", args.property_id);
    if (args.outcome_type) query = query.eq("outcome_type", args.outcome_type);
    if (args.prediction_accuracy) query = query.eq("prediction_accuracy", args.prediction_accuracy);
    if (args.evidence_type) query = query.eq("evidence_type", args.evidence_type);

    const { data, error } = await query;
    if (error) throw error;
    return { data, sources: (data || []).map((o) => `outcome:${o.id}`) };
  },

  async search_lessons(args) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("lessons_learned")
      .select("id, title, body, lesson_type, severity, created_at, lesson_references(subject_type, subject_id)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (args.lesson_type) query = query.eq("lesson_type", args.lesson_type);
    if (args.severity) query = query.eq("severity", args.severity);

    const { data, error } = await query;
    if (error) throw error;
    return { data, sources: (data || []).map((l) => `lesson:${l.id}`) };
  },

  async search_follow_ups(args) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("follow_ups")
      .select("id, property_id, milestone, due_date, status, title, notes, properties(name, address)")
      .order("due_date", { ascending: true })
      .limit(20);

    if (args.property_id) query = query.eq("property_id", args.property_id);
    if (args.overdue) {
      query = query.eq("status", "pending").lt("due_date", new Date().toISOString().slice(0, 10));
    } else if (args.status) {
      query = query.eq("status", args.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data, sources: (data || []).map((f) => `follow_up:${f.id}`) };
  },

  async get_vacancy_details(args) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vacancies")
      .select("*")
      .eq("property_id", args.property_id);
    if (error) throw error;
    return { data, sources: (data || []).map((v) => `vacancy:${v.id}`) };
  },

  async get_portfolio_summary() {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const [props, analyses, vacancies, outcomes, followUps, overdueFollowUps] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }),
      supabase.from("analysis_runs").select("id", { count: "exact", head: true }),
      supabase.from("vacancies").select("id", { count: "exact", head: true }),
      supabase.from("observed_outcomes").select("id", { count: "exact", head: true }),
      supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", today),
    ]);

    return {
      data: {
        properties: props.count || 0,
        analyses: analyses.count || 0,
        vacancies: vacancies.count || 0,
        outcomes: outcomes.count || 0,
        pending_follow_ups: followUps.count || 0,
        overdue_follow_ups: overdueFollowUps.count || 0,
      },
      sources: [],
    };
  },
};

// ── System prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are TrafficScout Assistant, an internal knowledge assistant for a commercial real-estate intelligence platform. You help analysts answer questions about properties, analyses, vacancies, tenant recommendations, market outcomes, and lessons learned.

Rules:
1. ONLY answer based on data retrieved through the available tools. Never fabricate property names, addresses, scores, demographics, tenant information, or any other facts.
2. If the data retrieved does not contain enough information to answer the question, say so clearly: "I don't have sufficient data to answer that question." Explain what data would be needed.
3. When you provide an answer, cite the sources by including references like [property:UUID], [analysis:UUID], [outcome:UUID], etc. at the end of relevant statements.
4. Use the tools to retrieve data before answering. You may call multiple tools if needed.
5. Be concise and direct. Focus on actionable insights for the analyst.
6. Never reveal internal system details, API keys, or sensitive configuration.
7. If asked about topics outside TrafficScout data (general knowledge, personal opinions), politely redirect to the platform's data.`;

// ── Main ask function ───────────────────────────────────────────────

/**
 * Process a user question through the assistant.
 * @param {object} params
 * @param {string} params.question - User's question
 * @param {{ role: string, content: string }[]} [params.history] - Prior conversation messages
 * @param {string} params.userId - Authenticated user ID (for logging)
 * @returns {Promise<{ answer: string, sources: string[], toolCalls: string[] }>}
 */
export async function askAssistant({ question, history = [], userId }) {
  const openai = getOpenAI();
  const allSources = new Set();
  const toolCallLog = [];

  // Build messages array
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: question },
  ];

  // Iterate tool-calling loop (max 5 rounds to prevent runaway)
  for (let round = 0; round < 5; round++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: TOOLS,
      tool_choice: round === 0 ? "auto" : "auto",
      temperature: 0.1,
      max_tokens: 2048,
    });

    const choice = response.choices[0];

    // If the model produced a final answer (no tool calls), return it
    if (choice.finish_reason === "stop" || !choice.message.tool_calls?.length) {
      const answer = choice.message.content || "I was unable to generate an answer.";
      return {
        answer,
        sources: [...allSources],
        toolCalls: toolCallLog,
      };
    }

    // Process tool calls
    messages.push(choice.message);

    for (const toolCall of choice.message.tool_calls) {
      const fnName = toolCall.function.name;
      const fnArgs = JSON.parse(toolCall.function.arguments);

      // Log tool call safely (no sensitive data)
      toolCallLog.push(fnName);
      console.log(`[assistant] Tool call: ${fnName} (user: ${userId?.slice(0, 8)}...)`);

      let result;
      try {
        const handler = TOOL_HANDLERS[fnName];
        if (!handler) {
          result = { error: `Unknown tool: ${fnName}` };
        } else {
          const { data, sources } = await handler(fnArgs);
          sources.forEach((s) => allSources.add(s));
          result = data;
        }
      } catch (err) {
        console.warn(`[assistant] Tool error (${fnName}):`, err.message);
        result = { error: err.message };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result, null, 0),
      });
    }
  }

  // If we exhausted rounds, return what we have
  return {
    answer: "I retrieved some data but was unable to formulate a complete answer. Please try rephrasing your question.",
    sources: [...allSources],
    toolCalls: toolCallLog,
  };
}

/** Exported for testing */
export const _internals = { TOOLS, TOOL_HANDLERS, SYSTEM_PROMPT };
