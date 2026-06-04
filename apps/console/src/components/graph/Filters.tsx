'use client';

/**
 * Side-rail filter controls. Emits a {@link GraphFilter} the page applies to the
 * force-graph data *before* handing it to the canvas, so toggling never re-runs
 * the crawl. The filtering itself is the pure {@link applyFilter} helper, so the
 * logic is testable and the component stays a thin control surface.
 */
import type { JSX } from 'react';
import type { GraphNodeType } from '@aeo/backlinks';
import type { FgLink, FgNode, ForceGraphData } from './graph-data.js';

/** Node types the user can toggle on/off (root is always shown). */
export const FILTERABLE_TYPES: readonly GraphNodeType[] = [
  'referring-domain',
  'backlink-page',
  'mention',
  'competitor',
];

const TYPE_LABELS: Record<GraphNodeType, string> = {
  root: 'Root',
  'referring-domain': 'Referring domains',
  'backlink-page': 'Backlink pages',
  mention: 'Mentions',
  competitor: 'Competitors',
};

/** Swatch colors that mirror the canvas legend for at-a-glance correlation. */
const TYPE_SWATCH: Record<GraphNodeType, string> = {
  root: '#22D3EE',
  'referring-domain': '#6366F1',
  'backlink-page': '#818CF8',
  mention: '#8B5CF6',
  competitor: '#F59E0B',
};

export interface GraphFilter {
  /** When true, keep only dofollow links (and the nodes they connect). */
  dofollowOnly: boolean;
  /** The node types to show. Root is always implicitly visible. */
  visibleTypes: ReadonlySet<GraphNodeType>;
  /** Minimum authority (0–100); nodes below it are hidden (root exempt). */
  minAuthority: number;
}

/** The default, fully-permissive filter (everything visible). */
export function defaultFilter(): GraphFilter {
  return {
    dofollowOnly: false,
    visibleTypes: new Set<GraphNodeType>(['root', ...FILTERABLE_TYPES]),
    minAuthority: 0,
  };
}

/**
 * Apply a {@link GraphFilter} to force-graph data. Nodes failing the type or
 * authority test are dropped; links are then pruned to those whose endpoints
 * both survive (and, when `dofollowOnly`, to dofollow links). The root is never
 * filtered out so the scene always has its anchor.
 */
export function applyFilter(data: ForceGraphData, filter: GraphFilter): ForceGraphData {
  const keep = (node: FgNode): boolean => {
    if (node.type === 'root') return true;
    if (!filter.visibleTypes.has(node.type)) return false;
    const authority = typeof node.authority === 'number' ? node.authority : 0;
    return authority >= filter.minAuthority;
  };

  const nodes = data.nodes.filter(keep);
  const kept = new Set(nodes.map((node) => node.id));

  const links = data.links.filter((link: FgLink) => {
    if (filter.dofollowOnly && !link.dofollow) return false;
    return kept.has(link.source) && kept.has(link.target);
  });

  return { nodes, links };
}

export interface FiltersProps {
  filter: GraphFilter;
  onChange: (filter: GraphFilter) => void;
}

export function Filters({ filter, onChange }: FiltersProps): JSX.Element {
  const toggleType = (type: GraphNodeType): void => {
    const next = new Set(filter.visibleTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange({ ...filter, visibleTypes: next });
  };

  return (
    <section
      aria-label="Filters"
      className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-ink-900/80 p-4 text-sm text-slate-200 shadow-xl backdrop-blur-md"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filters</h3>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 transition-colors hover:text-white">
        <input
          type="checkbox"
          checked={filter.dofollowOnly}
          onChange={(event) => onChange({ ...filter, dofollowOnly: event.target.checked })}
          className="h-4 w-4 rounded border-white/20 bg-white/[0.06] text-brand-cyan focus:ring-2 focus:ring-brand-cyan/40 focus:ring-offset-0"
        />
        <span>Dofollow links only</span>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">
          Node types
        </legend>
        {FILTERABLE_TYPES.map((type) => (
          <label
            key={type}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 transition-colors hover:text-white"
          >
            <input
              type="checkbox"
              checked={filter.visibleTypes.has(type)}
              onChange={() => toggleType(type)}
              className="h-4 w-4 rounded border-white/20 bg-white/[0.06] text-brand-cyan focus:ring-2 focus:ring-brand-cyan/40 focus:ring-offset-0"
            />
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: TYPE_SWATCH[type] }}
            />
            <span>{TYPE_LABELS[type]}</span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">Min authority</span>
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-xs tabular-nums text-slate-200">
            {filter.minAuthority}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filter.minAuthority}
          onChange={(event) => onChange({ ...filter, minAuthority: Number(event.target.value) })}
          aria-label="Minimum authority"
          className="w-full accent-brand-cyan"
        />
      </label>
    </section>
  );
}
