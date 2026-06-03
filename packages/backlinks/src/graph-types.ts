/**
 * Backlink-graph domain shapes.
 *
 * A backlink graph is a small, layered directed graph built from the free
 * providers in this package. The root site sits at the centre; each *referring
 * domain* that links to (or mentions) it becomes a node one hop out, and the
 * individual *backlink pages* / *mentions* hang off their domain. Competitor
 * nodes model the directional "who else links here" signal. The shapes are kept
 * deliberately flat and JSON-serialisable so a visualiser (or an MCP tool) can
 * consume them without a translation layer.
 */

/** The kind of node in a backlink graph. */
export type GraphNodeType =
  | 'root'
  | 'referring-domain'
  | 'backlink-page'
  | 'mention'
  | 'competitor';

/** How a mention relates to the root: an actual link vs a bare name-drop. */
export type MentionType = 'linked' | 'unlinked';

/** A node in the backlink graph. `id` is stable within one graph build. */
export interface GraphNode {
  /** Stable identifier within a single graph (canonical url or domain). */
  id: string;
  type: GraphNodeType;
  /** Registrable host the node belongs to (lowercased, `www.`-stripped). */
  domain: string;
  /** The specific page url, when the node represents one (omitted for domains). */
  url?: string;
  /** Best-effort human title (search result title, etc.). */
  title?: string;
  /** Heuristic 0–100 authority score; higher = stronger source. */
  authority?: number;
  /** For `mention` nodes: whether the brand is linked or only named. */
  mentionType?: MentionType;
  /** Whether the link/mention passes SEO equity (no nofollow/sponsored/ugc). */
  dofollow?: boolean;
  /** ISO-8601 first-seen timestamp, when a provider supplied one. */
  firstSeen?: string;
}

/** The kind of relationship a graph edge encodes. */
export type GraphEdgeKind = 'backlink' | 'mention' | 'competitor';

/** A directed edge from `source` node id to `target` node id. */
export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  dofollow: boolean;
  /** Anchor text of the link, when known. */
  anchorText?: string;
}

/** Aggregate statistics over a backlink graph (always from a sampled crawl). */
export interface BacklinkGraphStats {
  /** Count of distinct referring domains discovered. */
  referringDomains: number;
  /** Count of distinct backlink/mention pages discovered. */
  backlinks: number;
  /** Fraction (0–1) of backlinks that are dofollow. */
  dofollowRatio: number;
  /** Referring domains by link count, descending. */
  topSources: { domain: string; count: number }[];
  /**
   * Always `true`: the free sources are a sample, never a complete index, so
   * downstream consumers must present the data as directional, not exhaustive.
   */
  sampled: true;
}

/** A complete backlink graph: the root node, all nodes/edges, and stats. */
export interface BacklinkGraph {
  /** The root node (the site the graph was built for). */
  root: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: BacklinkGraphStats;
  /**
   * Non-fatal provider problems (a blocked scrape, a dead index, an empty
   * parse). Present only when something degraded — the graph is still returned,
   * assembled from whatever signals succeeded, never thrown.
   */
  warnings?: string[];
}
