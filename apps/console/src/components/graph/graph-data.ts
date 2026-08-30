/**
 * Pure mapping layer between the `@advance-labs/backlinks` engine shapes and the data
 * `react-force-graph-3d` consumes. Kept free of React and WebGL so the logic is
 * unit-testable in a plain Node environment (the canvas wrapper stays thin).
 *
 * Responsibilities:
 *  - `toForceGraphData` — project a {@link BacklinkGraph} onto force-graph nodes
 *    (with a derived `val` for sizing and a brand `color` per node type) + links.
 *  - `mergeGraph` — combine an expand result into an existing graph, deduping
 *    nodes and links by identity so progressive exploration never double-counts.
 */
import type {
  BacklinkGraph,
  GraphEdge,
  GraphEdgeKind,
  GraphNode,
  GraphNodeType,
  MentionType,
} from '@advance-labs/backlinks';

/** Brand palette keyed by node type. Mirrors the spec's 3D-scene encoding. */
export const NODE_COLORS: Readonly<Record<GraphNodeType, string>> = {
  root: '#22D3EE',
  'referring-domain': '#8B5CF6',
  'backlink-page': '#6366F1',
  mention: '#64748B',
  competitor: '#F59E0B',
};

/** Fallback colour for an unexpected/unknown node type (defensive). */
const FALLBACK_COLOR = '#64748B';

/**
 * A force-graph node. Carries the engine fields the UI needs plus the two
 * derived presentation fields (`val`, `color`). `react-force-graph-3d` mutates
 * nodes at runtime (adds x/y/z), so every extra field is optional + plain data.
 */
export interface FgNode {
  id: string;
  type: GraphNodeType;
  domain: string;
  url?: string;
  title?: string;
  authority?: number;
  mentionType?: MentionType;
  dofollow?: boolean;
  firstSeen?: string;
  /** Derived node size: grows with authority + in-degree. Root is boosted. */
  val: number;
  /** Derived render colour from the node type (brand palette). */
  color: string;
}

/** A force-graph link. Endpoints are node ids before the engine resolves them. */
export interface FgLink {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  dofollow: boolean;
  anchorText?: string;
}

/** The full payload handed to `<ForceGraph3D graphData={...} />`. */
export interface ForceGraphData {
  nodes: FgNode[];
  links: FgLink[];
}

/** Resolve a node's brand colour, tolerating an unknown type. */
export function colorForType(type: GraphNodeType): string {
  return NODE_COLORS[type] ?? FALLBACK_COLOR;
}

/** Fixed render size for the root node — strictly above the non-root ceiling. */
export const ROOT_VAL = 14;

/** Largest size any non-root node can reach (1 base + 4 authority + capped degree). */
const MAX_NON_ROOT_VAL = 1 + 4 + 6; // === 11, below ROOT_VAL by design

/**
 * Derive a node's render size. Authority (0–100) contributes a gentle curve and
 * in-degree (how many things point at it) adds weight, so well-referenced nodes
 * read as hubs. The root is always the largest so it anchors the scene visually:
 * the degree term is capped so no leaf can ever out-size the root.
 */
export function nodeVal(node: GraphNode, inDegree: number): number {
  if (node.type === 'root') {
    // Root sits at the centre and must dominate regardless of measured signal.
    return ROOT_VAL;
  }
  const authority = typeof node.authority === 'number' ? clamp(node.authority, 0, 100) : 0;
  const authorityComponent = authority / 25; // 0–4
  // Capped sqrt so a hyper-connected node still stays below the root.
  const degreeComponent = clamp(Math.sqrt(Math.max(0, inDegree)), 0, 6);
  return round2(clamp(1 + authorityComponent + degreeComponent, 1, MAX_NON_ROOT_VAL));
}

/**
 * Project a {@link BacklinkGraph} onto force-graph data. The root node is always
 * included (even if it is also present in `nodes`) and never duplicated.
 */
export function toForceGraphData(graph: BacklinkGraph): ForceGraphData {
  const inDegree = computeInDegree(graph.edges);

  const seen = new Set<string>();
  const nodes: FgNode[] = [];

  const pushNode = (node: GraphNode): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(mapNode(node, inDegree.get(node.id) ?? 0));
  };

  // Root first so it is guaranteed present and ordered at the front.
  pushNode(graph.root);
  for (const node of graph.nodes) pushNode(node);

  const links = mapLinks(graph.edges);

  return { nodes, links };
}

/**
 * Combine an expand result (`b`) into an existing graph (`a`), deduping by id.
 * Nodes are keyed by `id`; links by their `source|target|kind` triple so the
 * same backlink discovered twice collapses to one strand. The first occurrence
 * wins for nodes (the established node keeps its already-rendered identity).
 */
export function mergeGraph(a: ForceGraphData, b: ForceGraphData): ForceGraphData {
  const nodeById = new Map<string, FgNode>();
  for (const node of a.nodes) nodeById.set(node.id, node);
  for (const node of b.nodes) {
    if (!nodeById.has(node.id)) nodeById.set(node.id, node);
  }

  const linkByKey = new Map<string, FgLink>();
  const keyFor = (link: FgLink): string => `${link.source} ${link.target} ${link.kind}`;
  for (const link of a.links) linkByKey.set(keyFor(link), link);
  for (const link of b.links) {
    const key = keyFor(link);
    if (!linkByKey.has(key)) linkByKey.set(key, link);
  }

  return {
    nodes: [...nodeById.values()],
    links: [...linkByKey.values()],
  };
}

/** Map one engine node to a force-graph node with derived presentation fields. */
function mapNode(node: GraphNode, inDegree: number): FgNode {
  const fg: FgNode = {
    id: node.id,
    type: node.type,
    domain: node.domain,
    val: nodeVal(node, inDegree),
    color: colorForType(node.type),
  };
  // Only carry optional fields when present, to keep the payload lean + stable.
  if (node.url !== undefined) fg.url = node.url;
  if (node.title !== undefined) fg.title = node.title;
  if (node.authority !== undefined) fg.authority = node.authority;
  if (node.mentionType !== undefined) fg.mentionType = node.mentionType;
  if (node.dofollow !== undefined) fg.dofollow = node.dofollow;
  if (node.firstSeen !== undefined) fg.firstSeen = node.firstSeen;
  return fg;
}

/** Map engine edges to force-graph links, preserving direction + metadata. */
function mapLinks(edges: GraphEdge[]): FgLink[] {
  return edges.map((edge) => {
    const link: FgLink = {
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      dofollow: edge.dofollow,
    };
    if (edge.anchorText !== undefined) link.anchorText = edge.anchorText;
    return link;
  });
}

/** Count how many edges point *at* each node (its in-degree). */
function computeInDegree(edges: GraphEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return counts;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
