export interface Entity {
  name: string;
  domain: string;
  aliases?: string[];
}

export interface AnswerInput {
  text: string;
  sources: string[];
}

export interface AnswerAnalysis {
  /** Entity name, alias or domain appears in the answer prose (word-boundary match). */
  named: boolean;
  /** Entity's domain (or a subdomain of it) is among the answer's source URLs. */
  cited: boolean;
  /** 1 + number of competitors first mentioned before the entity; null if not named in prose. */
  position: number | null;
  /** Names of competitors named in prose or cited as a source. */
  competitorsNamed: string[];
}

/** Strip protocol, www., path, query, hash and port to a bare lowercase host. */
export function normalizeDomain(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]!
    .replace(/:\d+$/, '');
}

/**
 * Every string that counts as "named": name, aliases, domain, and the domain's brand label.
 * The label is only used at 4+ chars: short labels ("hom" from hom.ca) match ordinary words
 * and silently inflate scores.
 */
export function entityTerms(entity: Entity): string[] {
  const terms = new Set<string>();
  const add = (t?: string) => {
    const v = t?.trim().toLowerCase();
    if (v) terms.add(v);
  };
  add(entity.name);
  (entity.aliases ?? []).forEach(add);
  const dom = normalizeDomain(entity.domain);
  if (dom) {
    add(dom);
    const brand = dom.split('.')[0];
    if (brand && brand.length >= 4) add(brand);
  }
  return [...terms];
}

function termRegex(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // Letter/digit lookarounds instead of \b, which misbehaves next to non-word characters.
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu');
}

function firstMatchIndex(text: string, terms: string[]): number {
  let best = -1;
  for (const t of terms) {
    const m = termRegex(t).exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/** Host equals the domain or is a subdomain of it. */
function domainInSources(domain: string, hosts: string[]): boolean {
  return domain ? hosts.some((h) => h === domain || h.endsWith('.' + domain)) : false;
}

export function analyzeAnswer(
  answer: AnswerInput,
  entity: Entity,
  competitors: Entity[] = [],
): AnswerAnalysis {
  const text = answer.text ?? '';
  const hosts = (answer.sources ?? []).map(normalizeDomain).filter(Boolean);

  const idx = firstMatchIndex(text, entityTerms(entity));
  const cited = domainInSources(normalizeDomain(entity.domain), hosts);

  const comp = competitors.map((c) => ({
    name: c.name || normalizeDomain(c.domain),
    idx: firstMatchIndex(text, entityTerms(c)),
    cited: domainInSources(normalizeDomain(c.domain), hosts),
  }));

  return {
    named: idx >= 0,
    cited,
    position: idx >= 0 ? comp.filter((c) => c.idx >= 0 && c.idx < idx).length + 1 : null,
    competitorsNamed: comp.filter((c) => c.idx >= 0 || c.cited).map((c) => c.name),
  };
}
