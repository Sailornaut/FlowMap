// Legacy plan configuration — retired. Access is now role-based, not tier-based.
// Kept as a stub to avoid breaking any remaining imports during cleanup.

export const PLAN_CONFIG = {};

export function getPlanConfig() {
  return { key: "internal", label: "Internal", totalLimit: null, priceLabel: "", blurb: "" };
}

export function getNextUpgradeTier() {
  return null;
}
