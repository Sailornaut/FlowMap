export const PLAN_CONFIG = {
  free: {
    key: "free",
    label: "Free",
    monthlyLimit: 10,
    blurb: "Explore location analysis with a lighter monthly limit.",
  },
  pro: {
    key: "pro",
    label: "Pro",
    monthlyLimit: 250,
    blurb: "Higher monthly analysis limits for serious scouting workflows.",
  },
  business: {
    key: "business",
    label: "Business",
    monthlyLimit: 2000,
    blurb: "Expanded usage for teams running larger-scale location decisions.",
  },
};

export function getPlanConfig(tier) {
  return PLAN_CONFIG[tier] || PLAN_CONFIG.free;
}

export function getNextUpgradeTier(tier) {
  if (tier === "free") return "pro";
  if (tier === "pro") return "business";
  return null;
}
