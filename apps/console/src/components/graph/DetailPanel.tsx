'use client';

/**
 * Side-rail panel describing the currently-selected node. Shows the node's
 * identity + signals and offers an "Expand backlinks" action that asks the page
 * to fetch and merge the node's own backlinks for progressive exploration.
 */
import type { JSX } from 'react';
import { Button } from '@/components/ui/Button';
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
      className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-ink-900/85 p-4 text-sm text-slate-200 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 shrink-0 rounded-full ring-2 ring-white/10"
            style={{ backgroundColor: node.color }}
          />
          <h2 className="break-all font-semibold text-white">{node.domain}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <dl className="flex flex-col gap-2.5">
        <Row label="Type" value={TYPE_LABELS[node.type]} />
        {node.title !== undefined && node.title !== '' ? (
          <Row label="Title" value={node.title} />
        ) : null}
        {node.url !== undefined ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] uppercase tracking-wider text-slate-500">URL</dt>
            <dd>
              <a
                href={node.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-brand-cyan underline-offset-2 transition hover:text-cyan-300 hover:underline"
              >
                {node.url}
              </a>
            </dd>
          </div>
        ) : null}
        {typeof node.authority === 'number' ? <AuthorityRow authority={node.authority} /> : null}
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
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            onClick={() => onExpand(node)}
            disabled={expanding}
            size="sm"
            className="w-full"
          >
            {expanding ? (
              <>
                <Spinner />
                Expanding…
              </>
            ) : (
              <>
                <PlusIcon />
                Expand backlinks
              </>
            )}
          </Button>
          {expandError !== null ? (
            <p role="alert" className="text-xs text-red-300">
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
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="break-words text-slate-200">{value}</dd>
    </div>
  );
}

/** Authority as a value plus a slim gradient progress bar for quick read. */
function AuthorityRow({ authority }: { authority: number }): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round(authority)));
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500">
        <span>Authority</span>
        <span className="tabular-nums text-slate-300">{pct} / 100</span>
      </dt>
      <dd className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <span
          className="block h-full rounded-full bg-[linear-gradient(90deg,#6366F1,#8B5CF6_55%,#22D3EE)]"
          style={{ width: `${pct}%` }}
        />
      </dd>
    </div>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      aria-hidden
      className="animate-spin"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
