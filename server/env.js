// @ts-check
/**
 * Startup environment validation (docs/MIGRATION_PLAN.md, Phase 1).
 *
 * Pure function so it can be unit-tested without booting the server. The
 * server calls this once at startup: fatal problems stop a production boot
 * immediately instead of surfacing as lazy 500s on first use; in development
 * they are logged loudly but the server still boots so the app can run in the
 * "not configured" state the client already handles.
 */

/** Required for the server to do anything meaningful. */
const REQUIRED_VARS = [
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

/** Feature-scoped: missing values disable a feature but are not fatal. */
const OPTIONAL_VARS = [
  "STRIPE_SECRET_KEY", // legacy billing (deprecation planned, Phase 7)
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_ANALYSIS_ADDON",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SENTRY_DSN",
  "ALLOWED_ORIGIN",
  "VITE_SITE_URL",
];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ missing: string[], warnings: string[], fatal: boolean }}
 *   `fatal` is true when required vars are missing AND the environment is
 *   production — the caller should refuse to boot in that case.
 */
export function validateEnv(env) {
  const missing = REQUIRED_VARS.filter((name) => !String(env[name] || "").trim());
  const warnings = OPTIONAL_VARS.filter((name) => !String(env[name] || "").trim()).map(
    (name) => `${name} is not set; the dependent feature is disabled.`
  );

  const isProduction = env.NODE_ENV === "production";

  return {
    missing,
    warnings,
    fatal: isProduction && missing.length > 0,
  };
}

export { REQUIRED_VARS, OPTIONAL_VARS };
