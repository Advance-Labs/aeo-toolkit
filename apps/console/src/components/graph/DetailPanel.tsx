'use client';

/**
 * Overlay panel describing the currently-selected node. Shows the node's
 * identity + signals and offers an "Expand backlinks" action that asks the page
 * to fetch and merge the node's own backlinks for progressive exploration.
 */
import type { JSX } from 'react';
import type { FgNode } from './graph-data.js';

export interface DetailPanelProps {
  /** The selected node, or null when nothing is selected. */
  node: FgNode | null;
  /** Called when the user asks to expand the node's backlinks. */
  onExpand: (node: FgNode) => void;
  /** Called to dismiss the panel. */
  onClose: () => void;
  /** True while an expand request for this node is in flight. */
  expanding?: boolean;
  /** Error message from the last expand attempt, if any. */
  expandError?: string | null;
}

const TYPE_LABELS: Record<FgNode['type'], string> = {
  root: 'Root site',
  'referring-domain': 'Referring domain',
  'backlink-page': 'Backlink page',
  mention: 'Mention',
  competitor: 'Competitor',
};

export function DetailPanel({
  node,
  onExpand,
  onClose,
  expanding = false,
  expandError = null,
}: DetailPanelProps): JSX.Element | null {
  if (node === null) return null;

  const canExpand = node.type !== 'mention';

  return (
    <aside
      aria-label="Node details"
      className="pointer-events-auto flex w-80 max-w-[90vw] flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/90 p-4 text-sm text-slate-200 shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: node.color }}
          />
          <h2 className="break-all font-semibold text-slate-100">{node.domain}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <dl className="flex flex-col gap-2">
        <Row label="Type" value={TYPE_LABELS[node.type]} />
        {node.title !== undefined && node.title !== '' ? (
          <Row label="Title" value={node.title} />
        ) : null}
        {node.url !== undefined ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-slate-500">URL</dt>
            <dd>
              <a
                href={node.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-cyan-400 underline-offset-2 hover:underline"
              >
                {node.url}
              </a>
            </dd>
          </div>
        ) : null}
        {typeof node.authority === 'number' ? (
          <Row label="Authority" value={`${Math.round(node.authority)} / 100`} />
        ) : null}
        {node.mentionType !== undefined ? (
          <Row label="Mention" value={node.mentionType === 'linked' ? 'Linked' : 'Unlinked'} />
        ) : null}
        {node.dofollow !== undefined ? (
          <Row label="Link equity" value={node.dofollow ? 'dofollow' : 'nofollow'} />
        ) : null}
        {node.firstSeen !== undefined ? (
          <Row label="First seen" value={formatDate(node.firstSeen)} />
        ) : null}
      </dl>

      {canExpand ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onExpand(node)}
            disabled={expanding}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {expanding ? 'Expanding…' : 'Expand backlinks'}
          </button>
          {expandError !== null ? (
            <p role="alert" className="text-xs text-red-400">
              {expandError}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="break-words text-slate-200">{value}</dd>
    </div>
  );
}

/** Render an ISO timestamp as a friendly date, falling back to the raw string. */
function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
