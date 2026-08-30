/**
 * The declarative weighted rule engine — the heart of `@advance-labs/scoring`.
 *
 * `runRules` evaluates every {@link Rule} against a {@link ScoringContext},
 * turns each outcome into a {@link Finding}, groups findings by category, and
 * computes:
 *   - per-category score = weighted pass-ratio * 100
 *   - overall score      = weighted mean across categories
 *   - grade              = {@link scoreToGrade}(overall)
 *
 * Rules are pure with respect to the engine: `evaluate` may be sync or async,
 * and a throwing rule is treated as a (non-fatal) failure so one bad rule can
 * never crash a whole audit.
 */
import type {
  Finding,
  Rule,
  RuleOutcome,
  Score,
  ScoreCategory,
  ScoreCategoryKey,
  ScoringContext,
} from '@advance-labs/types';
import { clampScore, scoreToGrade } from './grade.js';

/** Human-readable labels for each category key, used in `ScoreCategory.label`. */
const CATEGORY_LABELS: Record<ScoreCategoryKey, string> = {
  crawlability: 'Crawlability',
  indexing: 'Indexing',
  metadata: 'Metadata',
  'structured-data': 'Structured Data',
  content: 'Content',
  aeo: 'Answer Engine Optimization',
  mobile: 'Mobile',
  security: 'Security',
  social: 'Social',
};

/** Severities that count toward `Score.criticalCount`. */
const CRITICAL_SEVERITIES = new Set(['critical', 'high']);

function labelFor(key: ScoreCategoryKey): string {
  return CATEGORY_LABELS[key] ?? key;
}

/** Convert a single rule + its outcome into a Finding. */
function toFinding(rule: Rule, outcome: RuleOutcome): Finding {
  const finding: Finding = {
    id: rule.id,
    category: rule.category,
    severity: rule.severity,
    title: rule.title,
    description: outcome.detail ? `${rule.description} ${outcome.detail}`.trim() : rule.description,
    recommendation: rule.recommendation,
    passed: outcome.passed,
    weight: rule.weight,
  };
  if (outcome.affectedUrls && outcome.affectedUrls.length > 0) {
    finding.affectedUrls = outcome.affectedUrls;
  }
  if (rule.docsUrl) finding.docsUrl = rule.docsUrl;
  return finding;
}

/** Safely evaluate one rule; a thrown error becomes a failed outcome. */
async function evaluateRule(rule: Rule, ctx: ScoringContext): Promise<RuleOutcome> {
  try {
    return await rule.evaluate(ctx);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'rule evaluation threw';
    return { passed: false, detail: `(evaluation error: ${detail})` };
  }
}

/** Build a ScoreCategory from the findings that belong to it. */
function buildCategory(key: ScoreCategoryKey, findings: Finding[]): ScoreCategory {
  let passedWeight = 0;
  let totalWeight = 0;
  let passedCount = 0;
  let failedCount = 0;

  for (const f of findings) {
    const w = f.weight > 0 ? f.weight : 0;
    totalWeight += w;
    if (f.passed) {
      passedWeight += w;
      passedCount += 1;
    } else {
      failedCount += 1;
    }
  }

  // Category score is the weighted pass ratio. A category with no weighted
  // rules (or no findings) scores 100 — nothing is wrong, nothing to fix.
  const score = totalWeight > 0 ? clampScore((passedWeight / totalWeight) * 100) : 100;
  // Category contribution weight = sum of its rule weights, so heavier rule
  // sets pull the overall score more (a natural emergent weighting).
  const weight = totalWeight;

  return {
    key,
    label: labelFor(key),
    score,
    weight,
    findings,
    passedCount,
    failedCount,
  };
}

/**
 * Evaluate `rules` against `ctx` and aggregate into categories + an overall score.
 * Categories appear in first-seen rule order so output ordering is deterministic.
 */
export async function runRules(
  ctx: ScoringContext,
  rules: Rule[],
): Promise<{ categories: ScoreCategory[]; score: Score }> {
  const byCategory = new Map<ScoreCategoryKey, Finding[]>();
  const order: ScoreCategoryKey[] = [];

  for (const rule of rules) {
    const outcome = await evaluateRule(rule, ctx);
    const finding = toFinding(rule, outcome);
    let bucket = byCategory.get(rule.category);
    if (!bucket) {
      bucket = [];
      byCategory.set(rule.category, bucket);
      order.push(rule.category);
    }
    bucket.push(finding);
  }

  const categories: ScoreCategory[] = order.map((key) =>
    buildCategory(key, byCategory.get(key) ?? []),
  );

  const score = aggregateScore(categories);
  return { categories, score };
}

/** Compute the overall Score (weighted mean of category scores) + tallies. */
export function aggregateScore(categories: ScoreCategory[]): Score {
  let weightedSum = 0;
  let weightTotal = 0;
  let passedCount = 0;
  let failedCount = 0;
  let criticalCount = 0;

  for (const cat of categories) {
    weightedSum += cat.score * cat.weight;
    weightTotal += cat.weight;
    passedCount += cat.passedCount;
    failedCount += cat.failedCount;
    for (const f of cat.findings) {
      if (!f.passed && CRITICAL_SEVERITIES.has(f.severity)) criticalCount += 1;
    }
  }

  const overall = weightTotal > 0 ? clampScore(weightedSum / weightTotal) : 100;

  return {
    overall: Math.round(overall),
    grade: scoreToGrade(overall),
    categories,
    passedCount,
    failedCount,
    criticalCount,
  };
}
