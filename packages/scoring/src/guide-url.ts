/**
 * Where each rule's fix guide lives: the rule's anchor on the generated rules pages of
 * docs.advancelabs.dev (apps/docs/scripts/generate.mjs), which links on to the agent skill that
 * owns the rule. Separate from a rule's `docsUrl`, which points at the primary source (Google,
 * schema.org) and stays as it is.
 */
const RULES_BASE = 'https://docs.advancelabs.dev/aeo-toolkit/rules';

const PAGE_BY_PREFIX: Readonly<Record<string, string>> = {
  tech: 'technical-seo',
  aeo: 'aeo',
  eeat: 'eeat',
};

/** The fix-guide URL for a rule id such as `aeo.ai-bots-allowed`, or undefined for an unknown family. */
export function ruleGuideUrl(ruleId: string): string | undefined {
  const page = PAGE_BY_PREFIX[ruleId.split('.')[0] ?? ''];
  return page ? `${RULES_BASE}/${page}/#${ruleId}` : undefined;
}
