import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const CACHE_TTL_MS = Number(process.env.ANALYSIS_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 1000 * 60 * 60);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 15);

app.use(express.json({ limit: "1mb" }));

const analysisCache = new Map();
const rateLimitStore = new Map();

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey });
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildAnalysisCacheKey(location) {
  const keyPayload = {
    name: normalizeText(location.name),
    address: normalizeText(location.address),
    latitude: Number(location.latitude).toFixed(4),
    longitude: Number(location.longitude).toFixed(4),
    placeType: normalizeText(location.placeType),
    context: normalizeText(location.context),
  };

  return crypto.createHash("sha256").update(JSON.stringify(keyPayload)).digest("hex");
}

function getCachedAnalysis(key) {
  const entry = analysisCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    analysisCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedAnalysis(key, value) {
  analysisCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function getClientIdentifier(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return request.ip || request.socket.remoteAddress || "unknown";
}

function applyRateLimit(request, response) {
  const identifier = getClientIdentifier(request);
  const now = Date.now();

  const existing = rateLimitStore.get(identifier);
  if (!existing || existing.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(identifier, nextEntry);

    response.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
    response.setHeader("X-RateLimit-Remaining", RATE_LIMIT_MAX_REQUESTS - nextEntry.count);
    response.setHeader("X-RateLimit-Reset", Math.ceil(nextEntry.resetAt / 1000));
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    response.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
    response.setHeader("X-RateLimit-Remaining", 0);
    response.setHeader("X-RateLimit-Reset", Math.ceil(existing.resetAt / 1000));
    response.status(429).json({
      error: "Rate limit exceeded. Please try again later.",
      code: "rate_limit_exceeded",
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    });
    return false;
  }

  existing.count += 1;
  rateLimitStore.set(identifier, existing);

  response.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
  response.setHeader("X-RateLimit-Remaining", RATE_LIMIT_MAX_REQUESTS - existing.count);
  response.setHeader("X-RateLimit-Reset", Math.ceil(existing.resetAt / 1000));
  return true;
}

function pruneExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of analysisCache.entries()) {
    if (entry.expiresAt <= now) {
      analysisCache.delete(key);
    }
  }

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(pruneExpiredEntries, 1000 * 60 * 5).unref();

const analysisSchema = {
  name: "flowmap_location_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      address: { type: "string" },
      latitude: { type: "number" },
      longitude: { type: "number" },
      traffic_score: { type: "number" },
      peak_hours: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            hour: { type: "string" },
            traffic: { type: "number" },
          },
          required: ["hour", "traffic"],
        },
      },
      daily_pattern: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            day: { type: "string" },
            traffic: { type: "number" },
          },
          required: ["day", "traffic"],
        },
      },
      nearby_pois: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            distance: { type: "string" },
          },
          required: ["name", "type", "distance"],
        },
      },
      demographics: {
        type: "object",
        additionalProperties: false,
        properties: {
          commuters: { type: "number" },
          residents: { type: "number" },
          tourists: { type: "number" },
          shoppers: { type: "number" },
        },
        required: ["commuters", "residents", "tourists", "shoppers"],
      },
      estimated_daily_foot_traffic: { type: "number" },
      business_suitability: {
        type: "string",
        enum: ["excellent", "good", "moderate", "low"],
      },
      notes: { type: "string" },
    },
    required: [
      "name",
      "address",
      "latitude",
      "longitude",
      "traffic_score",
      "peak_hours",
      "daily_pattern",
      "nearby_pois",
      "demographics",
      "estimated_daily_foot_traffic",
      "business_suitability",
      "notes",
    ],
  },
};

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    cacheTtlMs: CACHE_TTL_MS,
    rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: RATE_LIMIT_MAX_REQUESTS,
  });
});

app.post("/api/analyze", async (request, response) => {
  try {
    if (!applyRateLimit(request, response)) {
      return;
    }

    const { location } = request.body ?? {};

    if (!location?.name || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      response.status(400).json({ error: "A resolved location with coordinates is required." });
      return;
    }

    const cacheKey = buildAnalysisCacheKey(location);
    const cached = getCachedAnalysis(cacheKey);

    if (cached) {
      response.setHeader("X-Cache", "HIT");
      response.json(cached);
      return;
    }

    response.setHeader("X-Cache", "MISS");

    const client = getOpenAIClient();

    const prompt = [
      "You are a commercial foot-traffic analyst.",
      "Estimate likely pedestrian activity for the provided location using the address, coordinates, and place context.",
      "Be realistic and conservative. Do not pretend you have live sensor data.",
      "Return a practical estimate for a business owner deciding whether to evaluate this location further.",
      "",
      `Name: ${location.name}`,
      `Address: ${location.address}`,
      `Latitude: ${location.latitude}`,
      `Longitude: ${location.longitude}`,
      `Place type: ${location.placeType || "unknown"}`,
      `Context: ${location.context || "unknown"}`,
      "",
      "Rules:",
      "- traffic_score must be between 0 and 100",
      "- peak_hours must cover 6AM through 11PM inclusive",
      "- daily_pattern must cover Mon through Sun",
      "- demographics must sum to 100",
      "- nearby_pois should be plausible nearby destinations or anchors",
      "- notes should briefly explain the estimate and uncertainty",
    ].join("\n");

    const result = await client.responses.create({
      model: "gpt-5-mini",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Generate structured JSON only. Follow the schema exactly.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: analysisSchema.name,
          strict: true,
          schema: analysisSchema.schema,
        },
      },
    });

    const payload = JSON.parse(result.output_text);
    setCachedAnalysis(cacheKey, payload);

    response.json(payload);
  } catch (error) {
    const message = error?.message || "Analysis failed.";
    response.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`FlowMap analysis server listening on http://localhost:${port}`);
  console.log(
    `Analysis cache TTL: ${Math.round(CACHE_TTL_MS / 1000)}s | Rate limit: ${RATE_LIMIT_MAX_REQUESTS}/${Math.round(
      RATE_LIMIT_WINDOW_MS / 1000
    )}s`
  );
});
