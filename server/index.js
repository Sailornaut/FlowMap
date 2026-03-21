import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import * as Sentry from "@sentry/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

dotenv.config({ path: ".env.local" });
dotenv.config();

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
}

const app = express();
const port = Number(process.env.PORT || 8787);
const siteUrl = process.env.VITE_SITE_URL || "http://localhost:5173";
const configuredOrigins = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([siteUrl, "http://localhost:5173", "http://127.0.0.1:5173", ...configuredOrigins]);
const CACHE_TTL_MS = Number(process.env.ANALYSIS_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 1000 * 60 * 60);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 15);
const CACHE_TTL_SECONDS = Math.max(1, Math.ceil(CACHE_TTL_MS / 1000));
const RATE_LIMIT_WINDOW_SECONDS = Math.max(1, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
const PLAN_LIMITS = {
  free: 10,
  pro: 250,
  business: 2000,
};
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);
const hasRedisConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

app.set("trust proxy", 1);

app.use((request, response, next) => {
  const origin = request.headers.origin;

  if (!origin) {
    next();
    return;
  }

  if (allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Stripe-Signature");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader(
      "Access-Control-Expose-Headers",
      "X-Cache, X-Plan, X-Usage-Limit, X-Usage-Remaining, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
    );
  }

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use((request, response, next) => {
  if (request.path === "/api/stripe/webhook") {
    next();
    return;
  }

  express.json({ limit: "1mb" })(request, response, next);
});

const analysisCache = new Map();
const rateLimitStore = new Map();

let supabaseAdminClient;
let openAIClient;
let stripeClient;
let redisClient;

function reportServerError(error, context = {}) {
  console.error(error);

  if (!sentryDsn) {
    return;
  }

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureException(error);
  });
}

function getSupabaseAdmin() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  supabaseAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminClient;
}

function getOpenAIClient() {
  if (openAIClient) {
    return openAIClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  openAIClient = new OpenAI({ apiKey });
  return openAIClient;
}

function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  stripeClient = new Stripe(apiKey);
  return stripeClient;
}

function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  if (!hasRedisConfig) {
    return null;
  }

  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return redisClient;
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

function getMemoryCachedAnalysis(key) {
  const entry = analysisCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    analysisCache.delete(key);
    return null;
  }

  return entry.value;
}

function setMemoryCachedAnalysis(key, value) {
  analysisCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function getCachedAnalysis(key) {
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(`analysis:${key}`);
      if (!cached) {
        return null;
      }

      return typeof cached === "string" ? JSON.parse(cached) : cached;
    } catch (error) {
      reportServerError(error, { redis: { operation: "get", key: `analysis:${key}` } });
    }
  }

  return getMemoryCachedAnalysis(key);
}

async function setCachedAnalysis(key, value) {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(`analysis:${key}`, JSON.stringify(value), { ex: CACHE_TTL_SECONDS });
      return;
    } catch (error) {
      reportServerError(error, { redis: { operation: "set", key: `analysis:${key}` } });
    }
  }

  setMemoryCachedAnalysis(key, value);
}

function getClientIdentifier(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return request.ip || request.socket.remoteAddress || "unknown";
}

function setRateLimitHeaders(response, remaining, resetAt) {
  response.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
  response.setHeader("X-RateLimit-Remaining", remaining);
  response.setHeader("X-RateLimit-Reset", Math.ceil(resetAt / 1000));
}

async function applyRateLimit(request, response) {
  const identifier = getClientIdentifier(request);
  const now = Date.now();
  const resetAt = now + RATE_LIMIT_WINDOW_MS;
  const redis = getRedisClient();

  if (redis) {
    try {
      const windowBucket = Math.floor(now / RATE_LIMIT_WINDOW_MS);
      const key = `ratelimit:${identifier}:${windowBucket}`;
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      }

      const windowResetAt = (windowBucket + 1) * RATE_LIMIT_WINDOW_MS;
      if (count > RATE_LIMIT_MAX_REQUESTS) {
        setRateLimitHeaders(response, 0, windowResetAt);
        response.status(429).json({
          error: "Rate limit exceeded. Please try again later.",
          code: "rate_limit_exceeded",
          retryAfterSeconds: Math.max(1, Math.ceil((windowResetAt - now) / 1000)),
        });
        return false;
      }

      setRateLimitHeaders(response, Math.max(0, RATE_LIMIT_MAX_REQUESTS - count), windowResetAt);
      return true;
    } catch (error) {
      reportServerError(error, { redis: { operation: "rate_limit", identifier } });
    }
  }

  const existing = rateLimitStore.get(identifier);

  if (!existing || existing.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(identifier, nextEntry);
    setRateLimitHeaders(response, RATE_LIMIT_MAX_REQUESTS - nextEntry.count, nextEntry.resetAt);
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    setRateLimitHeaders(response, 0, existing.resetAt);
    response.status(429).json({
      error: "Rate limit exceeded. Please try again later.",
      code: "rate_limit_exceeded",
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    });
    return false;
  }

  existing.count += 1;
  setRateLimitHeaders(response, RATE_LIMIT_MAX_REQUESTS - existing.count, existing.resetAt);
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

if (!hasRedisConfig) {
  setInterval(pruneExpiredEntries, 1000 * 60 * 5).unref();
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function ensureProfile(user) {
  const supabase = getSupabaseAdmin();
  const payload = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "TrafficScout User",
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getAuthenticatedContext(request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  const profile = await ensureProfile(user);
  const subscription = await getLatestSubscription(user.id);

  return {
    accessToken,
    user,
    profile,
    subscription,
    tier: deriveBillingTier(profile, subscription),
  };
}

async function getLatestSubscription(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function deriveBillingTier(profile, subscription) {
  if (subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return subscription.billing_tier;
  }

  return profile?.billing_tier || "free";
}

function getUsageWindowStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function getUsageSummary(userId, tier) {
  const supabase = getSupabaseAdmin();
  const periodStart = getUsageWindowStart();
  const { count, error } = await supabase
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "analysis_run")
    .gte("created_at", periodStart);

  if (error) {
    throw error;
  }

  const used = count || 0;
  const limit = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    periodStart,
  };
}

async function recordUsageEvent(userId, cacheKey, metadata = {}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: "analysis_run",
    cache_key: cacheKey,
    metadata,
  });

  if (error) {
    throw error;
  }
}

function getTierPriceId(plan) {
  if (plan === "pro") {
    return process.env.STRIPE_PRICE_PRO_MONTHLY;
  }

  if (plan === "business") {
    return process.env.STRIPE_PRICE_BUSINESS_MONTHLY;
  }

  return null;
}

async function ensureStripeCustomer(profile, user) {
  if (profile.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: profile.email || user.email,
    name: profile.full_name || user.user_metadata?.full_name || undefined,
    metadata: {
      user_id: user.id,
    },
  });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", user.id);

  if (error) {
    throw error;
  }

  return customer.id;
}

async function syncSubscriptionFromStripe(stripeSubscription) {
  const supabase = getSupabaseAdmin();
  const stripePriceId = stripeSubscription.items.data[0]?.price?.id;
  const billingTier =
    stripePriceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY
      ? "business"
      : stripePriceId === process.env.STRIPE_PRICE_PRO_MONTHLY
        ? "pro"
        : "free";
  const userId = stripeSubscription.metadata?.user_id || stripeSubscription.customer_details?.metadata?.user_id;

  if (!userId) {
    return;
  }

  const subscriptionRecord = {
    id: stripeSubscription.id,
    user_id: userId,
    stripe_customer_id: String(stripeSubscription.customer),
    stripe_price_id: stripePriceId,
    status: stripeSubscription.status,
    billing_tier: billingTier,
    current_period_end: stripeSubscription.items.data[0]?.current_period_end
      ? new Date(stripeSubscription.items.data[0].current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };

  const { error: subscriptionError } = await supabase
    .from("subscriptions")
    .upsert(subscriptionRecord, { onConflict: "id" });

  if (subscriptionError) {
    throw subscriptionError;
  }

  const nextTier = ACTIVE_SUBSCRIPTION_STATUSES.has(stripeSubscription.status) ? billingTier : "free";
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: String(stripeSubscription.customer),
      billing_tier: nextTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }
}

const analysisSchema = {
  name: "trafficscout_location_analysis",
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
    cacheBackend: hasRedisConfig ? "upstash-redis" : "memory",
    rateLimitBackend: hasRedisConfig ? "upstash-redis" : "memory",
    cacheTtlMs: CACHE_TTL_MS,
    rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: RATE_LIMIT_MAX_REQUESTS,
  });
});

app.get("/api/monitoring-test", () => {
  throw new Error("TrafficScout backend monitoring test");
});

app.get("/api/account", async (request, response) => {
  try {
    const context = await getAuthenticatedContext(request);
    if (!context) {
      response.status(401).json({ error: "Sign in required." });
      return;
    }

    const usage = await getUsageSummary(context.user.id, context.tier);
    response.json({
      user: context.profile,
      tier: context.tier,
      usage,
      subscription: context.subscription,
      plans: PLAN_LIMITS,
    });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/account", method: "GET" } });
    response.status(500).json({ error: error?.message || "Could not load account." });
  }
});

app.post("/api/billing/checkout", async (request, response) => {
  try {
    const context = await getAuthenticatedContext(request);
    if (!context) {
      response.status(401).json({ error: "Sign in required." });
      return;
    }

    const { plan } = request.body ?? {};
    const priceId = getTierPriceId(plan);
    if (!priceId) {
      response.status(400).json({ error: "Unknown plan selected." });
      return;
    }

    const stripe = getStripeClient();
    const customerId = await ensureStripeCustomer(context.profile, context.user);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/dashboard?checkout=cancelled`,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        user_id: context.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: context.user.id,
          plan,
        },
      },
    });

    response.json({ url: session.url });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/billing/checkout", method: "POST" } });
    response.status(500).json({ error: error?.message || "Could not create checkout session." });
  }
});

app.post("/api/billing/portal", async (request, response) => {
  try {
    const context = await getAuthenticatedContext(request);
    if (!context) {
      response.status(401).json({ error: "Sign in required." });
      return;
    }

    const customerId = await ensureStripeCustomer(context.profile, context.user);
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/dashboard`,
    });

    response.json({ url: session.url });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/billing/portal", method: "POST" } });
    response.status(500).json({ error: error?.message || "Could not create billing portal session." });
  }
});

app.post("/api/stripe/webhook", async (request, response) => {
  try {
    const stripe = getStripeClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      response.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
      return;
    }

    const signature = request.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(request.body, signature, secret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.customer && session.metadata?.user_id) {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: String(session.customer),
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.metadata.user_id);
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      await syncSubscriptionFromStripe(event.data.object);
    }

    if (event.type === "customer.subscription.deleted") {
      await syncSubscriptionFromStripe(event.data.object);
    }

    response.json({ received: true });
  } catch (error) {
    reportServerError(error, { route: { path: "/api/stripe/webhook", method: "POST" } });
    response.status(400).send(error?.message || "Webhook failed");
  }
});

app.post("/api/analyze", async (request, response) => {
  try {
    if (!(await applyRateLimit(request, response))) {
      return;
    }

    const context = await getAuthenticatedContext(request);
    if (!context) {
      response.status(401).json({ error: "Sign in required before analyzing locations." });
      return;
    }

    const { location } = request.body ?? {};
    if (!location?.name || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      response.status(400).json({ error: "A resolved location with coordinates is required." });
      return;
    }

    const cacheKey = buildAnalysisCacheKey(location);
    const cached = await getCachedAnalysis(cacheKey);
    if (cached) {
      response.setHeader("X-Cache", "HIT");
      response.setHeader("X-Plan", context.tier);
      response.json(cached);
      return;
    }

    const usage = await getUsageSummary(context.user.id, context.tier);
    response.setHeader("X-Plan", context.tier);
    response.setHeader("X-Usage-Limit", usage.limit);
    response.setHeader("X-Usage-Remaining", usage.remaining);

    if (usage.remaining <= 0) {
      response.status(403).json({
        error: `You have reached the ${context.tier} plan limit for this month.`,
        code: "plan_limit_reached",
        tier: context.tier,
        usage,
      });
      return;
    }

    response.setHeader("X-Cache", "MISS");

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

    const result = await getOpenAIClient().responses.create({
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
    await setCachedAnalysis(cacheKey, payload);
    await recordUsageEvent(context.user.id, cacheKey, {
      tier: context.tier,
      locationName: location.name,
    });

    response.json(payload);
  } catch (error) {
    reportServerError(error, { route: { path: "/api/analyze", method: "POST" } });
    response.status(500).json({ error: error?.message || "Analysis failed." });
  }
});

app.use((error, request, response, _next) => {
  reportServerError(error, {
    route: {
      path: request.path,
      method: request.method,
    },
  });

  if (response.headersSent) {
    return;
  }

  if (request.path.startsWith("/api/")) {
    response.status(500).json({ error: error?.message || "Internal Server Error" });
    return;
  }

  response.status(500).send(error?.message || "Internal Server Error");
});

process.on("unhandledRejection", (reason) => {
  reportServerError(reason instanceof Error ? reason : new Error(String(reason)), {
    process: { event: "unhandledRejection" },
  });
});

process.on("uncaughtException", (error) => {
  reportServerError(error, { process: { event: "uncaughtException" } });
});

app.listen(port, () => {
  console.log(`TrafficScout analysis server listening on http://localhost:${port}`);
  console.log(
    `Analysis cache TTL: ${Math.round(CACHE_TTL_MS / 1000)}s | Rate limit: ${RATE_LIMIT_MAX_REQUESTS}/${Math.round(
      RATE_LIMIT_WINDOW_MS / 1000
    )}s`
  );
  console.log(`Shared cache backend: ${hasRedisConfig ? "Upstash Redis" : "in-memory fallback"}`);
  console.log(`Monitoring: ${sentryDsn ? "Sentry enabled" : "Sentry disabled"}`);
});
