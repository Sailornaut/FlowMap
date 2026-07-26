// @ts-check
/**
 * Shared PDF styles for TrafficScout reports.
 *
 * @react-pdf/renderer uses its own layout primitives (not HTML/CSS),
 * so we define styles using StyleSheet.create().
 */

import { StyleSheet, Font } from "@react-pdf/renderer";

// ── Colors ────────────────────────────────────────────────────────────

export const COLORS = {
  primary: "#1e3a5f",
  primaryLight: "#2d5a8e",
  accent: "#0ea5e9",
  success: "#16a34a",
  warning: "#ea580c",
  danger: "#dc2626",
  muted: "#6b7280",
  mutedLight: "#9ca3af",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  background: "#ffffff",
  backgroundAlt: "#f9fafb",
  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
};

// ── Verdict colors ────────────────────────────────────────────────────

export const VERDICT_COLORS = {
  recommend: COLORS.success,
  neutral: COLORS.muted,
  avoid: COLORS.warning,
  disqualified: COLORS.danger,
};

// ── Site rating colors ───────────────────────────────────────────────

export const RATING_COLORS = {
  "Excellent Opportunity": "#16a34a",
  "Strong Candidate": "#2563eb",
  "Promising with Reservations": "#0ea5e9",
  "Mixed Opportunity": "#ea580c",
  "Limited Opportunity": "#dc2626",
  "Unsuitable": "#991b1b",
};

// ── Typography ────────────────────────────────────────────────────────

export const FONT_SIZES = {
  xs: 7,
  sm: 8,
  base: 9,
  md: 10,
  lg: 12,
  xl: 14,
  "2xl": 18,
  "3xl": 24,
  "4xl": 32,
};

// ── Shared styles ─────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  // Page
  page: {
    fontFamily: "Helvetica",
    fontSize: FONT_SIZES.base,
    color: COLORS.text,
    paddingTop: 60,
    paddingBottom: 50,
    paddingHorizontal: 50,
  },

  // Header / Footer
  header: {
    position: "absolute",
    top: 20,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  headerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.mutedLight,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  footerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.mutedLight,
  },
  pageNumber: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.mutedLight,
  },

  // Section titles
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    marginBottom: 8,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingBottom: 4,
  },
  subsectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },

  // Body text
  paragraph: {
    fontSize: FONT_SIZES.base,
    lineHeight: 1.5,
    marginBottom: 6,
    color: COLORS.textSecondary,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  small: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },

  // Tables
  table: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: FONT_SIZES.sm,
    fontFamily: "Helvetica-Bold",
    color: COLORS.background,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: COLORS.backgroundAlt,
  },
  tableCell: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },

  // Cards / callouts
  callout: {
    backgroundColor: COLORS.backgroundAlt,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  calloutText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 1.4,
  },

  // Badges
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: FONT_SIZES.xs,
    fontFamily: "Helvetica-Bold",
  },

  // Rating badge
  ratingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  ratingText: {
    fontSize: FONT_SIZES.lg,
    fontFamily: "Helvetica-Bold",
    color: COLORS.background,
  },

  // Score breakdown bar
  scoreBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  scoreBarLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    width: 110,
  },
  scoreBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    marginRight: 6,
  },
  scoreBarFill: {
    height: 8,
    borderRadius: 2,
  },
  scoreBarValue: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    width: 36,
    textAlign: "right",
  },

  // Evidence bullets
  evidencePositive: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    lineHeight: 1.4,
    marginBottom: 2,
  },
  evidenceNegative: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.warning,
    lineHeight: 1.4,
    marginBottom: 2,
  },

  // Benchmark comparison
  benchmarkRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  benchmarkMetric: {
    fontSize: FONT_SIZES.sm,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textSecondary,
    width: 120,
  },
  benchmarkValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontFamily: "Helvetica-Bold",
    width: 80,
  },
  benchmarkRef: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    width: 80,
  },

  // Risk cards
  riskCard: {
    backgroundColor: COLORS.backgroundAlt,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  riskTitle: {
    fontSize: FONT_SIZES.sm,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  riskBody: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    lineHeight: 1.4,
  },

  // Data gap list
  dataGapItem: {
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
  },
  dataGapLabel: {
    fontSize: FONT_SIZES.sm,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textSecondary,
  },
  dataGapDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    lineHeight: 1.3,
  },

  // Interpretation text
  interpretationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 1.5,
    marginBottom: 4,
    fontStyle: "italic",
  },

  // Layout helpers
  row: {
    flexDirection: "row",
  },
  spaceBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
});
