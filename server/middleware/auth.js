// @ts-check
/**
 * Authentication middleware. Extracts Supabase bearer token, validates the
 * user, upserts the profile, and attaches the context to `req.authContext`.
 *
 * For routes that require internal-staff access, chain with `requireStaff`.
 */

import { getSupabaseAdmin } from "../services/supabase-admin.js";
import { hasInternalAccess } from "../access-control.js";

/**
 * @param {import("express").Request} req
 * @returns {string | null}
 */
function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * @param {import("@supabase/supabase-js").User} user
 */
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

  if (error) throw error;
  return data;
}

/**
 * Middleware: populates `req.authContext` if a valid session exists.
 * Does NOT reject unauthenticated requests (use `requireAuth` for that).
 */
export async function populateAuth(req, _res, next) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    req.authContext = null;
    return next();
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      req.authContext = null;
      return next();
    }

    const profile = await ensureProfile(user);
    req.authContext = { accessToken, user, profile };
    next();
  } catch (err) {
    req.authContext = null;
    next();
  }
}

/**
 * Middleware: rejects with 401 if not authenticated.
 */
export function requireAuth(req, res, next) {
  if (!req.authContext) {
    return res.status(401).json({ error: "Sign in required." });
  }
  next();
}

/**
 * Middleware: rejects with 403 if user lacks an internal role.
 * Must come after `populateAuth` + `requireAuth`.
 */
export function requireStaff(req, res, next) {
  if (!hasInternalAccess(req.authContext?.profile)) {
    return res.status(403).json({
      error: "This action requires a TrafficScout staff account.",
      code: "internal_access_required",
    });
  }
  next();
}
