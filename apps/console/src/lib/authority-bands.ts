/**
 * What a score MEANS, separated from how a score is fetched.
 *
 * WHY ITS OWN FILE
 * `AuthorityView` is a client component and deliberately does not import
 * `./authority`: that module reads `process.env` for the API key, and pulling it
 * into the browser bundle to render one word beside a number would be a poor
 * trade at best and a way to ship secrets at worst. This file is pure — no I/O,
 * no environment, no imports — so the island can use it directly and the server
 * can re-export it.
 */

/** A reader-facing reading of a raw score. */
export interface AuthorityVerdict {
  /** Short band name shown beside the figure, e.g. "Establishing". */
  band: string;
  /** One sentence telling the reader what the band means for them. */
  meaning: string;
  /** Which state colour the figure wears: ok / warn / neutral. */
  tone: 'ok' | 'warn' | 'neutral';
}

/**
 * Band cut points.
 *
 * WHY THESE NUMBERS
 * Open PageRank is 0–10 and roughly logarithmic: the gap from 3 to 4 is a different
 * amount of work from 6 to 7, and the median indexed domain sits near 2–3. Arithmetic
 * thirds would therefore drop almost every visitor into a bottom band, which is the
 * scare-ware funnel this tool's whole positioning is selling against. The cuts below
 * are spaced to match the distribution instead: most real sites land in `Building` or
 * `Early`, and the top two bands are genuinely rare.
 *
 * Reference points from the live index: semrush.com 8.90, advancelabs.dev 1.35.
 *
 * WHY NOTHING IS EVER `warn`
 * `AuthorityVerdict.tone` permits 'warn' and this mapping never returns it. That is
 * the positioning, expressed in code: a low score is a description of a young site,
 * not a problem the reader has caused, and colouring it as a warning would sell
 * exactly the anxiety the copy elsewhere refuses to. If a future band needs 'warn',
 * that is a positioning change and should be argued for, not slipped in.
 *
 * We publish our own 1.35 against this scale, which is the test any band has to pass.
 */
const BANDS: readonly { min: number; band: string; meaning: string; tone: AuthorityVerdict['tone'] }[] = [
  {
    min: 7,
    band: 'Widely cited',
    meaning:
      'Among the most linked domains on the open web. Authority is not what is holding this site back.',
    tone: 'ok',
  },
  {
    min: 5,
    band: 'Established',
    meaning: 'A substantial link graph. This domain is cited by sites that are themselves cited.',
    tone: 'ok',
  },
  {
    min: 3,
    band: 'Building',
    meaning: 'A real footprint, above the median indexed domain. Links are accumulating.',
    tone: 'neutral',
  },
  {
    min: 1,
    band: 'Early',
    meaning:
      'In the graph with a modest link profile. This is the normal reading for a young site that has started earning mentions.',
    tone: 'neutral',
  },
  {
    min: 0,
    band: 'Barely linked',
    meaning:
      'In the graph, but only just. Very little points here yet, which is a starting position rather than a verdict.',
    tone: 'neutral',
  },
];

/**
 * Turn a raw score into something a reader can act on.
 *
 * `null` is handled as its own case and never falls through to the bottom band:
 * "absent from the index" is not "scored zero", and conflating them would be the
 * same class of lie as rendering a failed lookup as a 0.
 */
export function describeAuthority(score: number | null): AuthorityVerdict {
  if (score === null) {
    return {
      band: 'Not in the index',
      meaning:
        'This domain is absent from the webgraph. That is the usual result for a new or very small site, and it is not a score of zero.',
      tone: 'neutral',
    };
  }

  const match = BANDS.find((candidate) => score >= candidate.min);
  // Only reachable for a negative score, which the index does not produce. Treated
  // as unknown rather than as the bottom band, on the same principle as null.
  if (match === undefined) {
    return {
      band: 'Unreadable',
      meaning: 'This score is outside the range the index publishes, so we will not interpret it.',
      tone: 'neutral',
    };
  }

  return { band: match.band, meaning: match.meaning, tone: match.tone };
}
