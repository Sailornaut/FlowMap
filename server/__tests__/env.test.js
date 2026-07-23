import { describe, expect, it } from "vitest";
import { REQUIRED_VARS, validateEnv } from "../env.js";

const complete = {
  NODE_ENV: "production",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  OPENAI_API_KEY: "sk-test",
  STRIPE_SECRET_KEY: "sk_live",
  STRIPE_WEBHOOK_SECRET: "whsec",
  STRIPE_PRICE_PRO_MONTHLY: "price_1",
  STRIPE_PRICE_ANALYSIS_ADDON: "price_2",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "token",
  SENTRY_DSN: "https://sentry.example/1",
  ALLOWED_ORIGIN: "https://example.com",
  VITE_SITE_URL: "https://example.com",
};

describe("validateEnv", () => {
  it("passes a complete environment with no findings", () => {
    expect(validateEnv(complete)).toEqual({ missing: [], warnings: [], fatal: false });
  });

  it("is fatal in production when required vars are missing", () => {
    const result = validateEnv({ NODE_ENV: "production" });
    expect(result.missing).toEqual(REQUIRED_VARS);
    expect(result.fatal).toBe(true);
  });

  it("is non-fatal in development, but still reports what's missing", () => {
    const result = validateEnv({ NODE_ENV: "development" });
    expect(result.missing).toEqual(REQUIRED_VARS);
    expect(result.fatal).toBe(false);
  });

  it("treats whitespace-only values as missing", () => {
    const result = validateEnv({ ...complete, OPENAI_API_KEY: "   " });
    expect(result.missing).toEqual(["OPENAI_API_KEY"]);
    expect(result.fatal).toBe(true);
  });

  it("reports unset optional vars as warnings, not as missing", () => {
    const result = validateEnv({ ...complete, SENTRY_DSN: "" });
    expect(result.missing).toEqual([]);
    expect(result.fatal).toBe(false);
    expect(result.warnings.some((warning) => warning.startsWith("SENTRY_DSN"))).toBe(true);
  });
});
