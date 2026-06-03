import { describe, expect, it } from 'vitest';
import type { BacklinkGraph } from '@aeo/backlinks';
import { NODE_COLORS, colorForType, mergeGraph, nodeVal, toForceGraphData } from './graph-data.js';
import type { ForceGraphData } from './graph-data.js';

/** Build a minimal BacklinkGraph for mapping tests. */
function makeGraph(): BacklinkGraph {
  return {
    root: { id: 'root', type: 'root', domain: 'example.com', url: 'https://example.com' },
    nodes: [
      { id: 'root', type: 'root', domain: 'example.com', url: 'https://example.com' },
      {
        id: 'ref.com',
        type: 'referring-domain',
        domain: 'ref.com',
        authority: 80,
      },
      {
        id: 'https://ref.com/post',
        type: 'backlink-page',
        domain: 'ref.com',
        url: 'https://ref.com/post',
        authority: 40,
        dofollow: true,
      },
      {
        id: 'https://news.com/story',
        type: 'mention',
        domain: 'news.com',
        url: 'https://news.com/story',
        mentionType: 'unlinked',
        dofollow: false,
      },
      { id: 'rival.com', type: 'competitor', domain: 'rival.com' },
    ],
    edges: [
      {
        source: 'ref.com',
        target: 'root',
        kind: 'backlink',
        dofollow: true,
        anchorText: 'example',
      },
      { source: 'https://ref.com/post', target: 'root', kind: 'backlink', dofollow: true },
      { source: 'https://news.com/story', target: 'root', kind: 'mention', dofollow: false },
      { source: 'rival.com', target: 'root', kind: 'competitor', dofollow: true },
    ],
    stats: {
      referringDomains: 2,
      backlinks: 3,
      dofollowRatio: 0.75,
      topSources: [{ domain: 'ref.com', count: 2 }],
      sampled: true,
    },
  };
}

describe('colorForType', () => {
  it('maps each node type to the brand palette', () => {
    expect(colorForType('root')).toBe('#22D3EE');
    expect(colorForType('referring-domain')).toBe('#8B5CF6');
    expect(colorForType('backlink-page')).toBe('#6366F1');
    expect(colorForType('mention')).toBe('#64748B');
    expect(colorForType('competitor')).toBe('#F59E0B');
  });

  it('agrees with the exported NODE_COLORS table', () => {
    expect(colorForType('root')).toBe(NODE_COLORS.root);
    expect(colorForType('competitor')).toBe(NODE_COLORS.competitor);
  });
});

describe('nodeVal', () => {
  it('always boosts the root above other nodes', () => {
    const root = nodeVal({ id: 'r', type: 'root', domain: 'x' }, 0);
    const other = nodeVal({ id: 'a', type: 'referring-domain', domain: 'a', authority: 100 }, 50);
    expect(root).toBeGreaterThan(other);
  });

  it('grows with authority', () => {
    const low = nodeVal({ id: 'a', type: 'referring-domain', domain: 'a', authority: 0 }, 0);
    const high = nodeVal({ id: 'a', type: 'referring-domain', domain: 'a', authority: 100 }, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('grows with in-degree', () => {
    const isolated = nodeVal({ id: 'a', type: 'referring-domain', domain: 'a' }, 0);
    const hub = nodeVal({ id: 'a', type: 'referring-domain', domain: 'a' }, 16);
    expect(hub).toBeGreaterThan(isolated);
  });

  it('treats a missing authority as zero', () => {
    const missing = nodeVal({ id: 'a', type: 'mention', domain: 'a' }, 0);
    const zero = nodeVal({ id: 'a', type: 'mention', domain: 'a', authority: 0 }, 0);
    expect(missing).toBe(zero);
  });
});

describe('toForceGraphData', () => {
  it('maps nodes with colour + derived val and carries engine fields', () => {
    const { nodes } = toForceGraphData(makeGraph());

    const ref = nodes.find((n) => n.id === 'ref.com');
    expect(ref).toBeDefined();
    expect(ref?.color).toBe('#8B5CF6');
    expect(ref?.authority).toBe(80);
    expect(ref?.val).toBeGreaterThan(0);

    const mention = nodes.find((n) => n.id === 'https://news.com/story');
    expect(mention?.color).toBe('#64748B');
    expect(mention?.mentionType).toBe('unlinked');
    expect(mention?.dofollow).toBe(false);
    expect(mention?.url).toBe('https://news.com/story');
  });

  it('includes the root exactly once even though it is also in nodes[]', () => {
    const { nodes } = toForceGraphData(makeGraph());
    const roots = nodes.filter((n) => n.type === 'root');
    expect(roots).toHaveLength(1);
    expect(nodes[0]?.id).toBe('root'); // root is ordered first
  });

  it('maps every edge to a link preserving direction + metadata', () => {
    const { links } = toForceGraphData(makeGraph());
    expect(links).toHaveLength(4);

    const anchored = links.find((l) => l.source === 'ref.com');
    expect(anchored).toEqual({
      source: 'ref.com',
      target: 'root',
      kind: 'backlink',
      dofollow: true,
      anchorText: 'example',
    });

    const nofollow = links.find((l) => l.kind === 'mention');
    expect(nofollow?.dofollow).toBe(false);
    expect(nofollow).not.toHaveProperty('anchorText');
  });

  it('boosts a node val with higher in-degree', () => {
    const { nodes } = toForceGraphData(makeGraph());
    // root has in-degree 4; a leaf with no inbound edges should be smaller
    const rootNode = nodes.find((n) => n.id === 'root');
    const leaf = nodes.find((n) => n.id === 'rival.com');
    expect(rootNode).toBeDefined();
    expect(leaf).toBeDefined();
  });
});

describe('mergeGraph', () => {
  const a: ForceGraphData = {
    nodes: [
      { id: 'root', type: 'root', domain: 'example.com', val: 12, color: '#22D3EE' },
      { id: 'ref.com', type: 'referring-domain', domain: 'ref.com', val: 3, color: '#8B5CF6' },
    ],
    links: [{ source: 'ref.com', target: 'root', kind: 'backlink', dofollow: true }],
  };

  it('dedups nodes by id, keeping the first occurrence', () => {
    const b: ForceGraphData = {
      nodes: [
        // duplicate id with a different val — original must win
        { id: 'ref.com', type: 'referring-domain', domain: 'ref.com', val: 99, color: '#000000' },
        { id: 'new.com', type: 'referring-domain', domain: 'new.com', val: 2, color: '#8B5CF6' },
      ],
      links: [],
    };
    const merged = mergeGraph(a, b);
    expect(merged.nodes).toHaveLength(3);
    const ref = merged.nodes.find((n) => n.id === 'ref.com');
    expect(ref?.val).toBe(3); // first occurrence preserved
    expect(merged.nodes.some((n) => n.id === 'new.com')).toBe(true);
  });

  it('dedups links by source|target|kind', () => {
    const b: ForceGraphData = {
      nodes: [
        { id: 'new.com', type: 'referring-domain', domain: 'new.com', val: 2, color: '#8B5CF6' },
      ],
      links: [
        // exact duplicate of a's link
        { source: 'ref.com', target: 'root', kind: 'backlink', dofollow: true },
        // a new link
        { source: 'new.com', target: 'root', kind: 'backlink', dofollow: false },
      ],
    };
    const merged = mergeGraph(a, b);
    expect(merged.links).toHaveLength(2);
    expect(merged.links.filter((l) => l.source === 'ref.com')).toHaveLength(1);
  });

  it('treats same endpoints but different kind as distinct links', () => {
    const b: ForceGraphData = {
      nodes: [],
      links: [{ source: 'ref.com', target: 'root', kind: 'mention', dofollow: false }],
    };
    const merged = mergeGraph(a, b);
    expect(merged.links).toHaveLength(2);
  });
});
