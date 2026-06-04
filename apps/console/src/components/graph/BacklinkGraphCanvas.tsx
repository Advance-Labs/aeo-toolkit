'use client';

/**
 * Thin client-only wrapper around `react-force-graph-3d`. WebGL has no SSR, so
 * the library is dynamically imported with `{ ssr: false }` — this keeps
 * `next build` from ever trying to render a GL context on the server, and lazy
 * loads the heavy three.js bundle only in the browser.
 *
 * All testable logic lives in `graph-data.ts`; this file is intentionally a
 * declarative pass-through of accessors so it needs no unit test (it would
 * require a real GL context to render).
 */
import dynamic from 'next/dynamic';
import type { ComponentType, JSX } from 'react';
import type { FgLink, FgNode, ForceGraphData } from './graph-data.js';

// next/dynamic with ssr:false guarantees the WebGL canvas is browser-only.
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-slate-400">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-cyan"
      />
      <span>Loading 3D engine…</span>
    </div>
  ),
}) as ComponentType<ForceGraph3DProps>;

/**
 * The subset of `react-force-graph-3d` props this wrapper drives. The library's
 * own prop types use `[index: string]: any`, which our lint config forbids, so
 * we declare a precise local surface and bridge at the call site with a single
 * cast through `unknown`.
 */
interface ForceGraph3DProps {
  graphData: ForceGraphData;
  backgroundColor?: string;
  nodeColor?: (node: FgNode) => string;
  nodeVal?: (node: FgNode) => number;
  nodeLabel?: (node: FgNode) => string;
  nodeOpacity?: number;
  nodeResolution?: number;
  linkColor?: (link: FgLink) => string;
  linkOpacity?: number;
  linkWidth?: (link: FgLink) => number;
  linkDirectionalParticles?: (link: FgLink) => number;
  linkDirectionalParticleWidth?: (link: FgLink) => number;
  linkDirectionalParticleSpeed?: (link: FgLink) => number;
  onNodeClick?: (node: FgNode) => void;
  cooldownTicks?: number;
  warmupTicks?: number;
  showNavInfo?: boolean;
  width?: number;
  height?: number;
}

export interface BacklinkGraphCanvasProps {
  /** Force-graph data (already projected from a BacklinkGraph). */
  data: ForceGraphData;
  /** Called when a node is clicked, with the clicked node. */
  onNodeClick?: (node: FgNode) => void;
}

/** dofollow links pulse with more, faster particles; nofollow read as faint. */
function particleCount(link: FgLink): number {
  return link.dofollow ? 4 : 1;
}

function particleWidth(link: FgLink): number {
  return link.dofollow ? 2 : 1;
}

function linkColor(link: FgLink): string {
  // dofollow = bright/solid; nofollow = dim. Mention/competitor get a tint.
  if (!link.dofollow) return 'rgba(100, 116, 139, 0.35)';
  switch (link.kind) {
    case 'competitor':
      return 'rgba(245, 158, 11, 0.7)';
    case 'mention':
      return 'rgba(139, 92, 246, 0.6)';
    case 'backlink':
    default:
      return 'rgba(99, 102, 241, 0.8)';
  }
}

function linkWidth(link: FgLink): number {
  return link.dofollow ? 1.2 : 0.6;
}

/** Build an HTML tooltip string for a node (the library renders it as innerHTML). */
function nodeTooltip(node: FgNode): string {
  const lines: string[] = [];
  lines.push(`<strong>${escapeHtml(node.domain)}</strong>`);
  if (node.title !== undefined && node.title !== '') {
    lines.push(escapeHtml(truncate(node.title, 80)));
  }
  lines.push(`<span style="opacity:0.7">${escapeHtml(typeLabel(node.type))}</span>`);
  if (typeof node.authority === 'number') {
    lines.push(`<span style="opacity:0.7">Authority ${Math.round(node.authority)}/100</span>`);
  }
  if (node.dofollow !== undefined) {
    lines.push(`<span style="opacity:0.7">${node.dofollow ? 'dofollow' : 'nofollow'}</span>`);
  }
  return [
    '<div style="',
    'padding:8px 10px;border-radius:10px;background:rgba(10,12,27,0.94);',
    'border:1px solid rgba(255,255,255,0.12);color:#e7eaf3;',
    'box-shadow:0 12px 30px -12px rgba(0,0,0,0.8);',
    'font-size:12px;line-height:1.45;max-width:240px;',
    '">',
    lines.join('<br/>'),
    '</div>',
  ].join('');
}

function typeLabel(type: FgNode['type']): string {
  switch (type) {
    case 'root':
      return 'Root site';
    case 'referring-domain':
      return 'Referring domain';
    case 'backlink-page':
      return 'Backlink page';
    case 'mention':
      return 'Mention';
    case 'competitor':
      return 'Competitor';
    default:
      return type;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Render the 3D backlink graph. The root node is already sized larger via its
 * derived `val` in `graph-data.ts`, so it reads as the anchor of the scene.
 */
export function BacklinkGraphCanvas({ data, onNodeClick }: BacklinkGraphCanvasProps): JSX.Element {
  // Cap simulation cooldown so large graphs settle quickly rather than spinning.
  const props: ForceGraph3DProps = {
    graphData: data,
    backgroundColor: '#070a17',
    nodeColor: (node) => node.color,
    nodeVal: (node) => node.val,
    nodeLabel: nodeTooltip,
    nodeOpacity: 0.92,
    nodeResolution: 16,
    linkColor,
    linkOpacity: 0.6,
    linkWidth,
    linkDirectionalParticles: particleCount,
    linkDirectionalParticleWidth: particleWidth,
    linkDirectionalParticleSpeed: (link) => (link.dofollow ? 0.01 : 0.005),
    cooldownTicks: 200,
    showNavInfo: false,
    ...(onNodeClick === undefined ? {} : { onNodeClick }),
  };

  return (
    // The library auto-sizes to its parent when width/height are omitted, so a
    // full-bleed wrapper keeps the canvas filling the viewport behind overlays.
    // `ForceGraph3D` is cast to ComponentType<ForceGraph3DProps> at import, so the
    // library's own `any`-indexed prop types (which our lint forbids) never leak.
    <div className="h-full w-full">
      <ForceGraph3D {...props} />
    </div>
  );
}
