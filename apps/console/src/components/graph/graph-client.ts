/**
 * Browser-side fetch helpers for the backlink-graph API. Centralizes the
 * request/response shapes so the page component stays declarative, and mirrors
 * the server contract exactly (see `src/app/api/graph/**`).
 *
 *  - POST `/api/graph`         body `{ url }`  → full {@link BacklinkGraph}.
 *  - POST `/api/graph/expand`  body `{ url }`  → {@link BacklinkGraph} of a node's backlinks.
 *  - GET  `/api/graph/stream?url=…`            → named SSE frames assembled into
 *    progressively-larger {@link BacklinkGraph} snapshots (the "web grows" effect).
 *
 * Secrets are never handled here: any BYOK key lives server-side in env. These
 * helpers only ever send a URL.
 */
import type { BacklinkGraph, BacklinkGraphStats, GraphEdge, GraphNode } from '@aeo/backlinks';

/** Thrown when the API responds with a non-2xx, structured error body. */
export class GraphApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'GraphApiError';
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  error: { code: string; message: string };
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as Record<string, unknown>)['error'];
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  return typeof e['code'] === 'string' && typeof e['message'] === 'string';
}

async function postGraph(path: string, url: string, fallback: string): Promise<BacklinkGraph> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const payload: unknown = await res.json().catch(() => null);
    if (isErrorBody(payload)) {
      throw new GraphApiError(payload.error.message, res.status, payload.error.code);
    }
    throw new GraphApiError(`${fallback} (HTTP ${res.status}).`, res.status, 'unknown');
  }
  return (await res.json()) as BacklinkGraph;
}

/** POST /api/graph — build the full backlink graph for a root URL. */
export function requestGraph(url: string): Promise<BacklinkGraph> {
  return postGraph('/api/graph', url, 'Could not build the backlink graph');
}

/**
 * POST /api/graph/expand — fetch the backlinks of a single node so its
 * neighborhood can be merged into the existing graph. The endpoint keys off the
 * node's `url`; for nodes without one (e.g. a bare domain) the caller passes the
 * best available locator.
 */
export function expandNode(url: string): Promise<BacklinkGraph> {
  return postGraph('/api/graph/expand', url, 'Could not expand this node');
}

/** Each yield is a progressively-larger graph snapshot, or a terminal error. */
export type GraphStreamEvent =
  | { type: 'graph'; graph: BacklinkGraph }
  | { type: 'error'; message: string };

/**
 * Open GET /api/graph/stream and assemble the named SSE frames
 * (`root`/`nodes`/`edges`/`stats`/`done`/`error`) into a growing
 * {@link BacklinkGraph}, yielding the latest snapshot after each batch so the
 * page can re-render the web as it fills in. The reader stops when the body ends
 * or `signal` aborts.
 *
 * Callers may instead use {@link requestGraph} as a one-shot fallback.
 */
export async function* streamGraph(
  url: string,
  signal?: AbortSignal,
): AsyncGenerator<GraphStreamEvent, void, void> {
  const query = new URLSearchParams({ url }).toString();
  const res = await fetch(`/api/graph/stream?${query}`, {
    headers: { Accept: 'text/event-stream' },
    ...(signal === undefined ? {} : { signal }),
  });

  if (!res.ok || res.body === null) {
    const payload: unknown = await res.json().catch(() => null);
    if (isErrorBody(payload)) {
      throw new GraphApiError(payload.error.message, res.status, payload.error.code);
    }
    throw new GraphApiError(
      `Could not stream the backlink graph (HTTP ${res.status}).`,
      res.status,
      'unknown',
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const assembler = new GraphAssembler();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const result = handleFrame(frame, assembler);
        if (result !== null) yield result;
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parse one SSE frame and fold it into the assembler, yielding what changed. */
function handleFrame(frame: string, assembler: GraphAssembler): GraphStreamEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return null;
  }

  switch (event) {
    case 'root':
      assembler.setRoot(data);
      return assembler.snapshot();
    case 'nodes':
      assembler.addNodes(data);
      return assembler.snapshot();
    case 'edges':
      assembler.addEdges(data);
      return assembler.snapshot();
    case 'stats':
      assembler.setStats(data);
      return assembler.snapshot();
    case 'error':
      return { type: 'error', message: errorMessage(data) };
    case 'done':
    default:
      return null;
  }
}

function errorMessage(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const message = (data as Record<string, unknown>)['message'];
    if (typeof message === 'string') return message;
  }
  return 'Stream error.';
}

/**
 * Accumulates named SSE frames into a {@link BacklinkGraph}. Nodes/edges are
 * deduped by identity so a snapshot is always internally consistent, and a
 * placeholder stats object is supplied until the real `stats` frame arrives.
 */
class GraphAssembler {
  private root: GraphNode | null = null;
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges = new Map<string, GraphEdge>();
  private stats: BacklinkGraphStats | null = null;
  private warnings: string[] = [];

  setRoot(data: unknown): void {
    if (isGraphNode(data)) {
      this.root = data;
      this.nodes.set(data.id, data);
    }
  }

  addNodes(data: unknown): void {
    if (!Array.isArray(data)) return;
    for (const item of data) {
      if (isGraphNode(item)) this.nodes.set(item.id, item);
    }
  }

  addEdges(data: unknown): void {
    if (!Array.isArray(data)) return;
    for (const item of data) {
      if (isGraphEdge(item)) this.edges.set(`${item.source} ${item.target} ${item.kind}`, item);
    }
  }

  setStats(data: unknown): void {
    if (typeof data !== 'object' || data === null) return;
    const obj = data as Record<string, unknown>;
    const stats = obj['stats'];
    if (isStats(stats)) this.stats = stats;
    const warnings = obj['warnings'];
    if (Array.isArray(warnings)) {
      this.warnings = warnings.filter((w): w is string => typeof w === 'string');
    }
  }

  /** A consistent BacklinkGraph snapshot, or null before the root is known. */
  snapshot(): GraphStreamEvent | null {
    if (this.root === null) return null;
    const graph: BacklinkGraph = {
      root: this.root,
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      stats: this.stats ?? this.provisionalStats(),
      warnings: this.warnings,
    };
    return { type: 'graph', graph };
  }

  /** Best-effort stats before the terminal `stats` frame lands. */
  private provisionalStats(): BacklinkGraphStats {
    const domains = new Set<string>();
    for (const node of this.nodes.values()) {
      if (node.type === 'referring-domain') domains.add(node.domain);
    }
    const dofollow = [...this.edges.values()].filter((e) => e.dofollow).length;
    const total = this.edges.size;
    return {
      referringDomains: domains.size,
      backlinks: total,
      dofollowRatio: total === 0 ? 0 : dofollow / total,
      topSources: [],
      sampled: true,
    };
  }
}

function isGraphNode(value: unknown): value is GraphNode {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['type'] === 'string' &&
    typeof obj['domain'] === 'string'
  );
}

function isGraphEdge(value: unknown): value is GraphEdge {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['source'] === 'string' &&
    typeof obj['target'] === 'string' &&
    typeof obj['kind'] === 'string' &&
    typeof obj['dofollow'] === 'boolean'
  );
}

function isStats(value: unknown): value is BacklinkGraphStats {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['referringDomains'] === 'number' &&
    typeof obj['backlinks'] === 'number' &&
    typeof obj['dofollowRatio'] === 'number' &&
    Array.isArray(obj['topSources'])
  );
}
