/**
 * `AuditReportDocument` — a `@react-pdf/renderer` document that renders an `AuditReport`
 * (overall score + grade, per-category breakdown, and the prioritized top fixes).
 *
 * Pure presentation: it takes a fully-computed `AuditReport` (produced by `@aeo/scoring` and
 * assembled by the audit app) and turns it into PDF primitives. No I/O happens here — the actual
 * byte rendering lives in `renderAuditReportPdf`, which keeps this component trivially testable.
 */
import { Document, Image, Link, Page, Text, View } from '@react-pdf/renderer';
import type { JSX } from 'react';
import type { AuditReport, Finding, ScoreCategory } from '@aeo/types';
import {
  ADVANCE_LABS_MOON_DATA_URI,
  ADVANCE_LABS_WEBSITE,
  ADVANCE_LABS_WEBSITE_LABEL,
} from './brand.js';
import { categoryDescription } from './category-info.js';
import { scoreColor, severityColor, styles } from './styles.js';

export interface AuditReportDocumentProps {
  report: AuditReport;
}

/** Clamp a number into the 0..100 range so a malformed score never overflows a layout bar. */
function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/** Format an ISO timestamp for the header; fall back to the raw string if it is unparseable. */
function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/**
 * Advance Labs co-brand lockup: the faceted "moon" mark beside the "Advance Labs." wordmark
 * ("Advance" bold, "Labs" regular, a purple terminating dot). Mirrors the web logo on a white
 * surface. Presentational only.
 */
function BrandLockup(): JSX.Element {
  return (
    <View style={styles.brandLockup}>
      {/* @react-pdf Image has no alt prop; jsx-a11y is not enabled for this package. */}
      <Image style={styles.brandMoon} src={ADVANCE_LABS_MOON_DATA_URI} />
      <Text style={styles.brandWordmark}>
        <Text style={styles.brandWordAdvance}>Advance</Text>
        <Text style={styles.brandWordLabs}> Labs</Text>
        <Text style={styles.brandDot}>.</Text>
      </Text>
    </View>
  );
}

function CategoryRow({ category }: { category: ScoreCategory }): JSX.Element {
  const pct = clampPercent(category.score);
  const fill = scoreColor(pct);
  // `category.findings` includes both passed and failed rules; surface only what's failing so
  // the reader sees, at a glance, what this category is missing — not just a bare score.
  const missing = category.findings.filter((f) => !f.passed);

  return (
    <View style={styles.categoryBlock} wrap={false}>
      <View style={styles.categoryRow}>
        <Text style={styles.categoryLabel}>{category.label}</Text>
        <View style={styles.categoryBarTrack}>
          <View style={[styles.categoryBarFill, { width: `${pct}%`, backgroundColor: fill }]} />
        </View>
        <Text style={[styles.categoryScore, { color: fill }]}>{Math.round(pct)}</Text>
        <Text style={styles.categoryCounts}>
          {category.passedCount}/{category.passedCount + category.failedCount} ok
        </Text>
      </View>
      <Text style={styles.categoryDescription}>{categoryDescription(category.key)}</Text>
      {missing.length > 0 ? (
        <>
          <Text style={styles.categoryMissing}>
            <Text style={styles.categoryMissingLabel}>Missing: </Text>
            {missing.length} issue{missing.length === 1 ? '' : 's'} found in this category — see
            &quot;Top fixes&quot; below for full detail.
          </Text>
          {missing.slice(0, 4).map((f) => (
            <Text key={f.id} style={styles.categoryMissingItem}>
              • {f.title}
            </Text>
          ))}
          {missing.length > 4 ? (
            <Text style={styles.categoryMissingItem}>+ {missing.length - 4} more</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.categoryAllGood}>Nothing missing — every check in this category passes.</Text>
      )}
    </View>
  );
}

/** Plain-English gloss for each severity level, shown once as a legend above the fix list. */
const SEVERITY_EXPLAINER: Record<Finding['severity'], string> = {
  critical: 'blocks visibility outright — fix first',
  high: 'a major, direct hit to ranking or AI-citation odds',
  medium: 'a real gap worth closing this cycle',
  low: 'minor polish, low urgency',
  info: 'informational — no action required',
};

function FixItem({ finding }: { finding: Finding }): JSX.Element {
  const color = severityColor(finding.severity);
  const affected = finding.affectedUrls ?? [];
  return (
    <View style={[styles.fix, { borderLeftColor: color }]} wrap={false}>
      <Text style={styles.fixTitle}>{finding.title}</Text>
      <Text style={styles.fixMeta}>
        {finding.severity.toUpperCase()} ({SEVERITY_EXPLAINER[finding.severity]}) · {finding.category} ·
        weight {finding.weight}
      </Text>
      <Text style={styles.fixBody}>What this means: {finding.description}</Text>
      <Text style={styles.fixRecommendation}>Fix: {finding.recommendation}</Text>
      {affected.length > 0 ? (
        <Text style={styles.fixMeta}>
          Affected: {affected.slice(0, 3).join(', ')}
          {affected.length > 3 ? ` (+${affected.length - 3} more)` : ''}
        </Text>
      ) : null}
      {finding.docsUrl ? (
        <Link style={styles.fixDocsLink} src={finding.docsUrl}>
          Learn more about this check
        </Link>
      ) : null}
    </View>
  );
}

export function AuditReportDocument({ report }: AuditReportDocumentProps): JSX.Element {
  const { score } = report;
  const overall = clampPercent(score.overall);
  const headerColor = scoreColor(overall);

  return (
    <Document
      title={`AEO Audit — ${report.url}`}
      author="AEO Toolkit"
      creator="@aeo/pdf"
      producer="@aeo/pdf"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brandBar}>
            <BrandLockup />
            <Text style={styles.brandTag}>AEO TOOLKIT AUDIT</Text>
          </View>
          <View style={styles.headerMain}>
            <View>
              <Text style={styles.title}>AEO Audit Report</Text>
              <Text style={styles.subtitle}>{report.url}</Text>
              <Text style={styles.subtitle}>Generated {formatGeneratedAt(report.generatedAt)}</Text>
            </View>
            <View style={styles.scoreBlock}>
              <Text style={[styles.scoreNumber, { color: headerColor }]}>{Math.round(overall)}</Text>
              <Text style={[styles.scoreGrade, { color: headerColor }]}>Grade {score.grade}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryStat}>
            Pages crawled: <Text style={styles.summaryStatValue}>{report.pagesCrawled}</Text>
          </Text>
          <Text style={styles.summaryStat}>
            Passed: <Text style={styles.summaryStatValue}>{score.passedCount}</Text>
          </Text>
          <Text style={styles.summaryStat}>
            Failed: <Text style={styles.summaryStatValue}>{score.failedCount}</Text>
          </Text>
          <Text style={styles.summaryStat}>
            Critical: <Text style={styles.summaryStatValue}>{score.criticalCount}</Text>
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Category breakdown</Text>
        <Text style={styles.sectionIntro}>
          Each category below is one facet of how findable this site is to search engines and AI
          answer engines. The score is how many of that category&apos;s checks pass; the text
          under each bar explains what the category covers and, if anything failed, exactly what
          is missing.
        </Text>
        {score.categories.length > 0 ? (
          score.categories.map((category) => <CategoryRow key={category.key} category={category} />)
        ) : (
          <Text style={styles.empty}>No category data available.</Text>
        )}

        <Text style={styles.sectionTitle}>Top fixes</Text>
        {report.topFixes.length > 0 ? (
          <>
            <Text style={styles.sectionIntro}>
              Every failed check, most urgent first. Each item explains what was found
              (&quot;What this means&quot;), the exact change to make (&quot;Fix&quot;), and
              which pages it affects. Severity in parentheses tells you how much it&apos;s
              costing this site.
            </Text>
            {report.topFixes.map((finding) => (
              <FixItem key={finding.id} finding={finding} />
            ))}
          </>
        ) : (
          <Text style={styles.empty}>No outstanding fixes — nice work.</Text>
        )}

        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            <Text style={styles.footerName}>Advance Labs</Text>
            <Text style={styles.footerSep}>·</Text>
            <Link style={styles.footerLink} src={ADVANCE_LABS_WEBSITE}>
              {ADVANCE_LABS_WEBSITE_LABEL}
            </Link>
            <Text style={styles.footerSep}>·</Text>
            <Text style={styles.footerMeta}>Report by AEO Toolkit · {report.meta.crawler}</Text>
          </View>
          <Text
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
