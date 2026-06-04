'use client';

/**
 * Interactive island for the Backlink Graph tool — the single-page 3D explorer.
 *
 * Flow: UrlBar → stream the graph (SSE) for the "web grows live" effect, falling
 * back to a single POST when streaming is unavailable → project to force-graph
 * data → render the canvas inside a framed scene with a side rail (stats, filters,
 * details). Clicking a node selects it and reveals the DetailPanel; "Expand
 * backlinks" POSTs the node and merges the result so exploration is progressive.
 *
 * The WebGL canvas is isolated in `BacklinkGraphCanvas` (dynamic, ssr:false); all
 * data shaping lives in the pure `graph-data.ts`, so this orchestrator stays
 * declarative. Layout is a deterministic responsive grid (scene + rail) — no
 * floating overlays overlap, and the rail collapses below the scene on mobile.
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

/** Legend entries mirror the canvas node colors so the scene reads at a glance. */
const LEGEND: ReadonlyArray<{ label: string; color: string }> = [
  { label: 'Root', color: '#22D3EE' },
  { label: 'Referring domain', color: '#6366F1' },
  { label: 'Backlink page', color: '#818CF8' },
  { label: 'Mention', color: '#8B5CF6' },
  { label: 'Competitor', color: '#F59E0B' },
];

export function GraphExplorer(): JSX.Element {
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
  const showRail = graph !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* URL entry bar — centered above the scene, never overlapping it. */}
      <div className="flex justify-center">
        <UrlBar onSubmit={onSubmit} loading={status === 'building'} defaultValue={url} />
      </div>

      {/* Error toast */}
      {status === 'error' && errorMessage !== null ? (
        <div className="flex justify-center">
          <div
            role="alert"
            className="flex max-w-xl items-center gap-2.5 rounded-xl border border-red-400/40 bg-red-950/70 px-4 py-3 text-sm text-red-200 shadow-xl backdrop-blur"
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              aria-hidden
              className="shrink-0"
            >
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 5v3.5M8 11h.01"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            {errorMessage}
          </div>
        </div>
      ) : null}

      {/* Scene + side rail: a clear responsive grid (no overlapping panels). */}
      <div
        className={
          showRail
            ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'
            : 'grid grid-cols-1 gap-4'
        }
      >
        {/* The 3D scene, framed in a dark rounded surface panel. */}
        <div className="relative h-[58vh] min-h-[24rem] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070a17] shadow-glow lg:h-[calc(100dvh-18rem)]">
          {/* Soft brand vignette so the GL scene blends into the page chrome. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl shadow-[inset_0_0_120px_-40px_rgba(99,102,241,0.45)]"
          />

          <div className="absolute inset-0">
            {hasNodes && filteredData !== null ? (
              <BacklinkGraphCanvas data={filteredData} onNodeClick={setSelected} />
            ) : (
              <EmptyOrLoading status={status} hasGraph={graph !== null} />
            )}
          </div>

          {/* Legend — a glassy chip strip, bottom-left, pinned to the scene. */}
          {hasNodes ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-xl border border-white/[0.08] bg-ink-950/70 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-md">
              {LEGEND.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Side rail: details (when a node is selected) → stats → filters. */}
        {showRail && graph !== null ? (
          <div className="flex max-h-none flex-col gap-4 lg:max-h-[calc(100dvh-18rem)] lg:overflow-y-auto lg:pr-1">
            {selected !== null ? (
              <DetailPanel
                node={selected}
                onExpand={(node) => {
                  void onExpand(node);
                }}
                onClose={() => setSelected(null)}
                expanding={expandingId === selected.id}
                expandError={expandError}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-slate-500">
                Tip: click any node in the scene to inspect its authority, link equity, and source —
                then expand it to grow the graph.
              </p>
            )}
            <StatsSidebar stats={graph.stats} warnings={graph.warnings} />
            <Filters filter={filter} onChange={setFilter} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Centered placeholder shown when the canvas has no nodes to render. */
function EmptyOrLoading({ status, hasGraph }: { status: Status; hasGraph: boolean }): JSX.Element {
  const building = status === 'building';

  let title: string;
  let message: string;
  if (building) {
    title = hasGraph ? 'The web is growing…' : 'Gathering backlinks…';
    message = hasGraph
      ? 'Discovering more referring domains and merging them into the graph in real time.'
      : 'Pulling links from open indexes (DuckDuckGo, CommonCrawl, Wayback). This can take a moment.';
  } else if (status === 'done') {
    title = 'No backlinks found';
    message =
      'We did not discover any backlinks for this URL in the open indexes. Try another domain.';
  } else if (status === 'error') {
    title = 'Try again';
    message = 'Enter a URL above to map its backlink universe.';
  } else {
    title = 'Map a backlink universe';
    message =
      'Enter any domain or URL above to render its referring domains, backlink pages, and mentions in 3D.';
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-6 text-center">
      <div
        className="flex max-w-md flex-col items-center gap-3"
        aria-live="polite"
        aria-busy={building}
      >
        {building ? (
          <span
            aria-hidden
            className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-brand-cyan"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-cyan"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="18" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="17" r="2.6" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M7.7 7.4l2.6 7.4M16.3 8.6l-2.7 6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="text-sm leading-relaxed text-slate-400">{message}</p>
      </div>
    </div>
  );
}

/** Prefer a structured API message; otherwise fall back to a generic string. */
function toMessage(primary: unknown, secondary: unknown): string {
  if (primary instanceof GraphApiError) return primary.message;
  if (secondary instanceof GraphApiError) return secondary.message;
  return 'Something went wrong while building the backlink graph.';
}
