/**
 * Dedup agent — Jaccard-similarity fingerprinting over post content.
 *
 * Pure functions only: no I/O. The fingerprint is a sorted, de-duplicated set of word
 * shingles (n-grams). Jaccard(|A ∩ B| / |A ∪ B|) over those shingle sets gives a cheap,
 * order-insensitive near-duplicate signal we use to avoid re-publishing the same article.
 */

/** Default shingle size — 2-word shingles balance recall and precision for prose. */
export const DEFAULT_SHINGLE_SIZE = 2;

/**
 * Normalize text into lowercase alphanumeric tokens.
 * Strips markdown punctuation, collapses whitespace, drops empties.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Build a sorted, de-duplicated shingle fingerprint from text.
 * For fewer tokens than `size`, the whole token list collapses to a single shingle so short
 * inputs still produce a stable, comparable fingerprint.
 */
export function fingerprint(text: string, size: number = DEFAULT_SHINGLE_SIZE): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];
  if (tokens.length < size) return [tokens.join(' ')];

  const shingles = new Set<string>();
  for (let i = 0; i + size <= tokens.length; i += 1) {
    shingles.add(tokens.slice(i, i + size).join(' '));
  }
  return [...shingles].sort();
}

/**
 * Jaccard similarity of two fingerprints (sorted shingle sets) in [0,1].
 * Two empty fingerprints are defined as identical (1); one empty vs non-empty is 0.
 */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setB = new Set(b);
  let intersection = 0;
  const seen = new Set<string>();
  for (const item of a) {
    if (seen.has(item)) continue;
    seen.add(item);
    if (setB.has(item)) intersection += 1;
  }
  // |A ∪ B| = |A| + |B| − |A ∩ B|, using de-duplicated sizes.
  const sizeA = new Set(a).size;
  const sizeB = setB.size;
  const union = sizeA + sizeB - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** A candidate compared against the existing corpus. */
export interface DedupCandidate {
  slug: string;
  fingerprint: string[];
}

/** The closest existing match found for a candidate. */
export interface DedupMatch {
  slug: string;
  similarity: number;
}

export interface DedupResult {
  isDuplicate: boolean;
  /** The single closest existing post, if any corpus entries exist. */
  nearest?: DedupMatch;
}

/**
 * Compare a candidate fingerprint against an existing corpus and decide whether it is a
 * near-duplicate of any existing post at or above `threshold`.
 */
export function checkDuplicate(
  candidate: readonly string[],
  corpus: readonly DedupCandidate[],
  threshold: number,
): DedupResult {
  let nearest: DedupMatch | undefined;
  for (const entry of corpus) {
    const similarity = jaccard(candidate, entry.fingerprint);
    if (nearest === undefined || similarity > nearest.similarity) {
      nearest = { slug: entry.slug, similarity };
    }
  }
  const isDuplicate = nearest !== undefined && nearest.similarity >= threshold;
  return nearest === undefined ? { isDuplicate } : { isDuplicate, nearest };
}
