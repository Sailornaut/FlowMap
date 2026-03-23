export const PLAN_CONFIG = {
  free: {
    key: "free",
    label: "Free",
    totalLimit: 3,
    priceLabel: "$0",
    blurb: "Try TrafficScout with 3 total analyses before upgrading.",
  },
  pro: {
    key: "pro",
    label: "Pro",
    totalLimit: null,
    priceLabel: "$9/month",
    blurb: "Built for small businesses that need better location decisions.",
  },
  business: {
    key: "business",
    label: "Business",
    totalLimit: null,
    priceLabel: "Legacy",
    blurb: "Legacy unlimited access for earlier subscribers.",
  },
};

export function getPlanConfig(tier) {
  return PLAN_CONFIG[tier] || PLAN_CONFIG.free;
}

export function getNextUpgradeTier(tier) {
  if (tier === "free") return "pro";
  return null;
}
