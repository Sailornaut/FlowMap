// @ts-check
/**
 * Internal access control (docs/MIGRATION_PLAN.md, Phase 1).
 *
 * TrafficScout is pivoting to an internal tool: analysis endpoints must only
 * be reachable by invited staff. Access is granted by `profiles.role`
 * (migration 0001), never inferred from having a session — public sign-ups
 * are disabled at the Supabase level, but this server-side check must hold on
 * its own even if a stray account exists.
 */

export const INTERNAL_ROLES = Object.freeze(["admin", "analyst"]);

/**
 * @param {{ role?: string | null } | null | undefined} profile
 * @returns {boolean} true when the profile belongs to internal staff.
 */
export function hasInternalAccess(profile) {
  return Boolean(profile && profile.role && INTERNAL_ROLES.includes(profile.role));
}

/**
 * @param {{ role?: string | null } | null | undefined} profile
 * @returns {boolean} admin-only operations (invitations, settings, methodology edits).
 */
export function isAdmin(profile) {
  return Boolean(profile && profile.role === "admin");
}
