'use client';

/**
 * Backlink Graph — the single-page 3D explorer. Re-homed from the standalone
 * `backlink-graph` app into the console route segment.
 *
 * Flow: UrlBar → stream the graph (SSE) for the "web grows live" effect, falling
 * back to a single POST when streaming is unavailable → project to force-graph
 * data → render the canvas behind overlay panels (stats, filters, details).
 * Clicking a node opens the DetailPanel; "Expand backlinks" POSTs the node and
 * merges the result so exploration is progressive.
 *
 * The WebGL canvas is isolated in `BacklinkGraphCanvas` (dynamic, ssr:false);
 * all data shaping lives in the pure `graph-data.ts`, so this orchestrator stays
 * declarative. The shell layout supplies the page `<main>`, so the full-bleed
 * scene here lives in a contained, rounded panel (a `<div>`, not a nested `<main>`).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { BacklinkGraphCanvas } from '@/components/graph/BacklinkGraphCanvas.js';
import { DetailPanel } from '@/components/graph/DetailPanel.js';
import { Filters, applyFilter, defaultFilter } from '@/components/graph/Filters.js';
import type { GraphFilter } from '@/components/graph/Filters.js';
import { StatsSidebar } from '@/components/graph/StatsSidebar.js';
import { UrlBar } from '@/components/graph/UrlBar.js';
import {
  GraphApiError,
  expandNode,
  requestGraph,
  streamGraph,
} from '@/components/graph/graph-client.js';
import { mergeGraph, toForceGraphData } from '@/components/graph/graph-data.js';
import type { FgNode, ForceGraphData } from '@/components/graph/graph-data.js';
import type { BacklinkGraph, BacklinkGraphStats } from '@aeo/backlinks';

type Status = 'idle' | 'building' | 'done' | 'error';

interface GraphState {
  data: ForceGraphData;
  stats: BacklinkGraphStats;
  warnings: string[];
}

export default function GraphToolPage(): JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [url, setUrl] = useState<string>('');
  const [graph, setGraph] = useState<GraphState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [filter, setFilter] = useState<GraphFilter>(defaultFilter);
  const [selected, setSelected] = useState<FgNode | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [expandError, setExpandError] = useState<string | null>(null);

  // Abort any in-flight stream when a new build starts or the page unmounts.
  const abortRef = useRef<AbortController | null>(null);

  /** Fold one engine graph into the accumulated UI state (dedup via mergeGraph). */
  const absorb = useCallback((incoming: BacklinkGraph): void => {
    const next = toForceGraphData(incoming);
    setGraph((prev) => ({
      data: prev === null ? next : mergeGraph(prev.data, next),
      stats: incoming.stats,
      warnings: incoming.warnings ?? [],
    }));
  }, []);

  const build = useCallback(
    async (target: string): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('building');
      setUrl(target);
      setErrorMessage(null);
      setGraph(null);
      setSelected(null);
      setExpandError(null);

      try {
        // Preferred path: stream partial graphs so the web visibly grows. Each
        // snapshot is a progressively-larger graph; absorb (merge) folds it in.
        let received = false;
        for await (const event of streamGraph(target, controller.signal)) {
          if (event.type === 'error') throw new GraphApiError(event.message, 200, 'stream');
          received = true;
          absorb(event.graph);
        }
        if (!received) {
          // Stream produced nothing usable — fall back to the one-shot endpoint.
          absorb(await requestGraph(target));
        }
        setStatus('done');
      } catch (streamErr) {
        if (controller.signal.aborted) return; // superseded by a newer build
        // Streaming failed; try the non-streaming fallback before giving up.
        try {
          absorb(await requestGraph(target));
          setStatus('done');
        } catch (err) {
          setErrorMessage(toMessage(err, streamErr));
          setStatus('error');
        }
      }
    },
    [absorb],
  );

  const onSubmit = useCallback(
    (target: string): void => {
      void build(target);
    },
    [build],
  );

  const onExpand = useCallback(
    async (node: FgNode): Promise<void> => {
      // The expand endpoint keys off a URL; use the node's page URL when it has
      // one, otherwise derive an https URL from its domain.
      const locator = node.url ?? `https://${node.domain}`;
      setExpandingId(node.id);
      setExpandError(null);
      try {
        absorb(await expandNode(locator));
      } catch (err) {
        setExpandError(err instanceof GraphApiError ? err.message : 'Could not expand this node.');
      } finally {
        setExpandingId(null);
      }
    },
    [absorb],
  );

  // Apply filters to the accumulated data before it reaches the canvas.
  const filteredData = useMemo<ForceGraphData | null>(
    () => (graph === null ? null : applyFilter(graph.data, filter)),
    [graph, filter],
  );

  const hasNodes = filteredData !== null && filteredData.nodes.length > 0;

  return (
    <div className="relative h-[calc(100dvh-9rem)] min-h-[32rem] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020]">
      {/* Full-bleed canvas layer */}
      <div className="absolute inset-0">
        {hasNodes && filteredData !== null ? (
          <BacklinkGraphCanvas data={filteredData} onNodeClick={setSelected} />
        ) : (
          <EmptyOrLoading status={status} hasGraph={graph !== null} />
        )}
      </div>

      {/* Top overlay: URL entry */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <UrlBar onSubmit={onSubmit} loading={status === 'building'} defaultValue={url} />
      </div>

      {/* Error toast */}
      {status === 'error' && errorMessage !== null ? (
        <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center px-4">
          <div
            role="alert"
            className="pointer-events-auto max-w-xl rounded-lg border border-red-500/40 bg-red-950/80 px-4 py-3 text-sm text-red-200 shadow-xl backdrop-blur"
          >
            {errorMessage}
          </div>
        </div>
      ) : null}

      {/* Left overlay: stats + filters */}
      {graph !== null ? (
        <div className="pointer-events-none absolute left-0 top-24 bottom-4 flex flex-col gap-3 overflow-y-auto p-4">
          <StatsSidebar stats={graph.stats} warnings={graph.warnings} />
          <Filters filter={filter} onChange={setFilter} />
        </div>
      ) : null}

      {/* Right overlay: selected node details */}
      {selected !== null ? (
        <div className="pointer-events-none absolute right-0 top-24 flex justify-end p-4">
          <DetailPanel
            node={selected}
            onExpand={(node) => {
              void onExpand(node);
            }}
            onClose={() => setSelected(null)}
            expanding={expandingId === selected.id}
            expandError={expandError}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Centered placeholder shown when the canvas has no nodes to render. */
function EmptyOrLoading({ status, hasGraph }: { status: Status; hasGraph: boolean }): JSX.Element {
  let message: string;
  if (status === 'building') {
    message = hasGraph
      ? 'Discovering more backlinks — the graph is growing…'
      : 'Gathering backlinks from open indexes…';
  } else if (status === 'done') {
    message = 'No backlinks were discovered for this URL in the open indexes.';
  } else if (status === 'error') {
    message = 'Enter a URL above to try again.';
  } else {
    message = 'Enter a URL above to map its backlink universe.';
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-6 text-center">
      <p
        className="max-w-md text-sm text-slate-400"
        aria-live="polite"
        aria-busy={status === 'building'}
      >
        {message}
      </p>
    </div>
  );
}

/** Prefer a structured API message; otherwise fall back to a generic string. */
function toMessage(primary: unknown, secondary: unknown): string {
  if (primary instanceof GraphApiError) return primary.message;
  if (secondary instanceof GraphApiError) return secondary.message;
  return 'Something went wrong while building the backlink graph.';
}
