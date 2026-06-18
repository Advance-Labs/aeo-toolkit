/**
 * Shared StyleSheet for the audit report layout. Kept in a runtime (non-tsx) module so the
 * component file stays focused on structure. `@react-pdf/renderer` styles are a CSS-like subset.
 */
import { StyleSheet } from '@react-pdf/renderer';

/** Brand-ish palette used across the report. */
export const palette = {
  ink: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  surface: '#f9fafb',
  accent: '#2563eb',
  critical: '#b91c1c',
  high: '#c2410c',
  medium: '#a16207',
  low: '#4b5563',
  info: '#2563eb',
  good: '#15803d',
  /** Advance Labs brand purple — co-branding accent (wordmark dot, footer link, rule). */
  brand: '#7c3aed',
} as const;

/**
 * Map a 0..100 score to a display color so the gauge reads at a glance.
 * Thresholds mirror the A–F grade bands used by `@aeo/scoring`.
 */
export function scoreColor(score: number): string {
  if (score >= 80) return palette.good;
  if (score >= 60) return palette.medium;
  return palette.critical;
}

/** Severity → color, for the fix list dots/labels. */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return palette.critical;
    case 'high':
      return palette.high;
    case 'medium':
      return palette.medium;
    case 'low':
      return palette.low;
    default:
      return palette.info;
  }
}

export const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    color: palette.ink,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingBottom: 12,
  },
  // Top brand strip: Advance Labs lockup (left) + a quiet "AEO Toolkit audit" tag (right).
  brandBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMoon: {
    width: 18,
    height: 18,
    marginRight: 6,
  },
  brandWordmark: {
    fontSize: 12,
  },
  brandWordAdvance: {
    fontFamily: 'Helvetica-Bold',
    color: palette.ink,
  },
  brandWordLabs: {
    fontFamily: 'Helvetica',
    color: palette.ink,
  },
  brandDot: {
    fontFamily: 'Helvetica-Bold',
    color: palette.brand,
  },
  brandTag: {
    fontSize: 8,
    color: palette.muted,
    letterSpacing: 0.4,
  },
  // The original header row (report title + subtitles on the left, score gauge on the right).
  headerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  subtitle: {
    fontSize: 9,
    color: palette.muted,
    marginTop: 2,
  },
  scoreBlock: {
    alignItems: 'flex-end',
  },
  scoreNumber: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
  },
  scoreGrade: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  summaryStat: {
    marginRight: 18,
    fontSize: 9,
    color: palette.muted,
  },
  summaryStatValue: {
    fontFamily: 'Helvetica-Bold',
    color: palette.ink,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  categoryLabel: {
    width: '40%',
    fontSize: 10,
  },
  categoryBarTrack: {
    width: '40%',
    height: 6,
    backgroundColor: palette.surface,
    borderRadius: 3,
    marginRight: 8,
  },
  categoryBarFill: {
    height: 6,
    borderRadius: 3,
  },
  categoryScore: {
    width: '12%',
    textAlign: 'right',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  categoryCounts: {
    width: '20%',
    textAlign: 'right',
    fontSize: 8,
    color: palette.muted,
  },
  fix: {
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
  },
  fixTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  fixMeta: {
    fontSize: 8,
    color: palette.muted,
    marginTop: 1,
    marginBottom: 2,
  },
  fixBody: {
    fontSize: 9,
    color: palette.ink,
  },
  fixRecommendation: {
    fontSize: 9,
    color: palette.accent,
    marginTop: 2,
  },
  empty: {
    fontSize: 9,
    color: palette.muted,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 8,
    color: palette.muted,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 6,
  },
  // Contact strip: brand name + clickable website + the AEO Toolkit attribution.
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerName: {
    fontFamily: 'Helvetica-Bold',
    color: palette.ink,
  },
  footerLink: {
    color: palette.brand,
    textDecoration: 'none',
  },
  footerMeta: {
    color: palette.muted,
  },
  footerSep: {
    color: palette.border,
    marginHorizontal: 5,
  },
  footerPage: {
    color: palette.muted,
  },
});
