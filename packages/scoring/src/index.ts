/**
 * @aeo/scoring — the keystone weighted rule engine + three rule sets + report
 * builders for the AEO Toolkit.
 *
 * Consumers (the audit app, E-E-A-T scanner, AI-visibility MCP, and Chrome
 * extension) import everything they need from this surface. All domain shapes
 * (`Score`, `Finding`, `ScoringContext`, `AuditReport`, `EeatReport`, …) live
 * in `@aeo/types` and are re-exported by consumers from there, not here.
 */

// Rule engine + grading.
export { runRules, aggregateScore } from './engine.js';
export { scoreToGrade, clampScore } from './grade.js';

// Rule sets.
export { technicalSeoRules } from './technical-seo-rules.js';
export { aeoRules } from './aeo-rules.js';
export { eeatScore, eeatSignalDefs } from './eeat-rules.js';

// Report builders.
export { auditScore, buildAuditReport, prioritizeFixes, auditRules } from './audit.js';
export type { BuildAuditReportOptions } from './audit.js';
export { generateTemplates } from './templates.js';

// Context helpers — useful for apps building their own ad-hoc rules.
export { KEY_AI_BOTS } from './context-utils.js';
