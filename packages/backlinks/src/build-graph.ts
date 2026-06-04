/**
 * Backlink graph builder.
 *
 * Fans out the free providers in this package (DuckDuckGo HTML search +
 * CommonCrawl index) for a root site, normalises and de-duplicates everything by
 * canonical url / registrable domain, then aggregates the page-level signals up
 * into a layered domain graph:
 *
 *   root ──backlink/mention──▶ referring-domain ──▶ backlink-page / mention
 *
 * Every provider call degrades gracefully: a failure becomes a `warnings[]` entry
 * carried on the graph stats path (never a throw), so a single dead source can
 * never sink the whole build. The result is explicitly `sampled: true` — the free
 * sources are directional, not a complete backlink index.
 */
import { search } from './duckduckgo.js';
import { queryIndex, resolveLatestIndex } from './commoncrawl.js';
import { queryDomainCaptures } from './wayback.js';
import { createLiveHttpClient, type HttpClient } from './http.js';
import type {
  BacklinkGraph,
  BacklinkGraphStats,
  GraphEdge,
  GraphNode,
  MentionType,
} from './graph-types.js';

/** A provider the builder may run. Lets a caller scope the fan-out. */
export type BacklinkSource = 'duckduckgo' | 'commoncrawl' | 'wayback';

export interface BuildBacklinkGraphOptions {
  /** Injectable HTTP seam. Defaults to a fresh live (non-rate-limited) client. */
  http?: HttpClient;
  /** Max pages to pull from each provider (kept polite). Default 25. */
  limit?: number;
  /** Which providers to run. Default: both. */
  sources?: BacklinkSource[];
  /** CommonCrawl monthly index override (forwarded to `queryIndex`). */
  commonCrawlIndex?: string;
  /** User-agent for the default live client (ignored when `http` is supplied). */
  userAgent?: string;
  /** Request timeout (ms) for the default live client. Default 10000. */
  requestTimeoutMs?: number;
}

const DEFAULT_LIMIT = 25;
const DEFAULT_USER_AGENT = 'aeo-backlinks/0.1 (+https://github.com/aeo-toolkit)';
const DEFAULT_TIMEOUT_MS = 10_000;

/** Normalise a domain string: strip scheme/path/port, leading `www.`, lowercase. */
export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  try {
    if (host.includes('://')) host = new URL(host).hostname;
  } catch {
    // fall through to manual stripping
  }
  host = host
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
  return host.replace(/^www\./, '');
}

/** Registrable host of a url (lowercased, `www.`-stripped), or `''` if unparseable. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** True when `host` equals `domain` or is a subdomain of it. */
function hostMatchesDomain(host: string, domain: string): boolean {
  const h = normalizeDomain(host);
  const d = normalizeDomain(domain);
  if (d === '') return false;
  return h === d || h.endsWith(`.${d}`);
}

/**
 * Canonicalise a url for de-duplication: drop the hash, lowercase the host, strip
 * a trailing slash on the path. Returns the input trimmed when unparseable so we
 * never throw mid-build.
 */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    let out = u.toString();
    // Collapse a lone trailing slash (but keep the root "/").
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return raw.trim();
  }
}

/**
 * Cheap heuristic authority score (0–100) from a host: shorter hosts and
 * well-known TLDs score a little higher. This is intentionally simple — the free
 * sources give us no real domain-authority signal, so we surface a coarse hint
 * rather than pretend precision.
 */
function estimateAuthority(host: string): number {
  if (host === '') return 0;
  const labels = host.split('.');
  const tld = labels[labels.length - 1] ?? '';
  let score = 50;
  // Fewer labels (apex domains) read as more authoritative than deep subdomains.
  score -= Math.max(0, labels.length - 2) * 8;
  // A short registrable name nudges up; a very long one nudges down.
  const sld = labels.length >= 2 ? (labels[labels.length - 2] ?? '') : host;
  if (sld.length > 0 && sld.length <= 6) score += 10;
  if (sld.length > 18) score -= 10;
  if (tld === 'gov' || tld === 'edu') score += 25;
  return Math.max(0, Math.min(100, score));
}

/** An intermediate page-level signal before domain aggregation. */
interface PageSignal {
  url: string;
  domain: string;
  title?: string;
  kind: 'backlink' | 'mention';
  mentionType: MentionType;
  dofollow: boolean;
  anchorText?: string;
  firstSeen?: string;
}

/** Convert a 14-digit CommonCrawl/CDX timestamp to ISO-8601, or undefined. */
function timestampToIso(ts: string | undefined): string | undefined {
  if (ts === undefined || !/^\d{14}$/.test(ts)) return undefined;
  const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(
    8,
    10,
  )}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

/**
 * Build a sampled backlink graph for `rootUrl` from the free providers.
 *
 * Never throws on provider failure: each source is run independently and its
 * problems surface as `warnings`, while the graph is assembled from whatever
 * signals succeeded. The returned graph is always `sampled: true`.
 */
export async function buildBacklinkGraph(
  rootUrl: string,
  opts: BuildBacklinkGraphOptions = {},
): Promise<BacklinkGraph> {
  const rootDomain = normalizeDomain(rootUrl);
  const limit = opts.limit && opts.limit > 0 ? opts.limit : DEFAULT_LIMIT;
  // Wayback is included by default as a reliable, datacenter-reachable fallback: DuckDuckGo
  // frequently 403s from server IPs and a single stale CommonCrawl index used to empty the graph,
  // so a third independent source keeps the graph populated even when the other two fail.
  const sources: BacklinkSource[] = opts.sources ?? ['duckduckgo', 'commoncrawl', 'wayback'];
  const http =
    opts.http ??
    createLiveHttpClient({
      userAgent: opts.userAgent ?? DEFAULT_USER_AGENT,
      requestTimeoutMs: opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

  const root: GraphNode = {
    // Prefix the root id so it never collides with a referring-domain node id — CommonCrawl
    // captures on the root domain legitimately produce an `acme.com` domain node, and a bare
    // `acme.com` root id would make those domain→page edges masquerade as root edges.
    id: rootDomain !== '' ? `root:${rootDomain}` : canonicalUrl(rootUrl),
    type: 'root',
    domain: rootDomain,
    url: canonicalUrl(rootUrl),
    authority: estimateAuthority(rootDomain),
  };

  const warnings: string[] = [];
  // De-dup page signals by canonical url; first writer wins, but we upgrade an
  // unlinked mention to a backlink if a later source proves a real link.
  const signalsByUrl = new Map<string, PageSignal>();

  const addSignal = (sig: PageSignal): void => {
    const key = canonicalUrl(sig.url);
    const existing = signalsByUrl.get(key);
    if (!existing) {
      signalsByUrl.set(key, { ...sig, url: key });
      return;
    }
    // Upgrade: a confirmed backlink beats a bare mention; dofollow beats nofollow.
    if (existing.kind === 'mention' && sig.kind === 'backlink') {
      existing.kind = 'backlink';
      existing.mentionType = 'linked';
    }
    if (sig.dofollow) existing.dofollow = true;
    if (!existing.title && sig.title) existing.title = sig.title;
    if (!existing.firstSeen && sig.firstSeen) existing.firstSeen = sig.firstSeen;
  };

  if (rootDomain === '') {
    warnings.push('Could not derive a root domain from the input URL.');
  }

  // --- DuckDuckGo: third-party mentions/links to the root domain. ---
  if (rootDomain !== '' && sources.includes('duckduckgo')) {
    const outcome = await search(http, `"${rootDomain}" -site:${rootDomain}`, limit);
    for (const w of outcome.warnings) warnings.push(`[duckduckgo] ${w}`);
    for (const r of outcome.results) {
      const host = hostOf(r.url);
      // Off-domain third party only — these are the referring candidates.
      if (host === '' || hostMatchesDomain(host, rootDomain)) continue;
      addSignal({
        url: r.url,
        domain: host,
        title: r.title || undefined,
        // Search alone can't prove an <a href>, so we model it as an unlinked
        // mention until a stronger source upgrades it.
        kind: 'mention',
        mentionType: 'unlinked',
        dofollow: false,
      });
    }
  }

  // --- CommonCrawl: pages the index has seen referencing the root domain. ---
  if (rootDomain !== '' && sources.includes('commoncrawl')) {
    // Resolve the latest crawl id at runtime unless the caller pinned one — a hard-pinned
    // index eventually 404s as CommonCrawl retires old crawls (the bug that emptied the graph).
    const index = opts.commonCrawlIndex ?? (await resolveLatestIndex(http));
    const cc = await queryIndex(http, rootDomain, { index, limit });
    for (const w of cc.warnings) warnings.push(`[commoncrawl] ${w}`);
    for (const c of cc.captures) {
      // CommonCrawl's wildcard is scoped to the root domain, so captures are on
      // the root itself — model them as linked backlink pages corroborating
      // coverage (a real crawled url referencing the domain).
      addSignal({
        url: c.url,
        domain: c.host,
        kind: 'backlink',
        mentionType: 'linked',
        dofollow: true,
        firstSeen: timestampToIso(c.timestamp),
      });
    }
  }

  // --- Wayback Machine: pages the Internet Archive has captured under the domain. ---
  // A reliable, datacenter-reachable coverage source; corroborates CommonCrawl and keeps the
  // graph populated when DuckDuckGo/CommonCrawl are blocked or empty.
  if (rootDomain !== '' && sources.includes('wayback')) {
    const wb = await queryDomainCaptures(http, rootDomain, limit);
    for (const w of wb.warnings) warnings.push(`[wayback] ${w}`);
    for (const c of wb.captures) {
      addSignal({
        url: c.url,
        domain: c.host,
        kind: 'backlink',
        mentionType: 'linked',
        dofollow: true,
        firstSeen: timestampToIso(c.timestamp),
      });
    }
  }

  // --- Aggregate page signals into a layered domain graph. ---
  const nodes: GraphNode[] = [root];
  const edges: GraphEdge[] = [];
  const domainNodeIds = new Map<string, string>();
  const linkCountByDomain = new Map<string, number>();

  for (const sig of signalsByUrl.values()) {
    // Ensure a referring-domain node + a root→domain edge exist once per domain.
    let domainId = domainNodeIds.get(sig.domain);
    if (domainId === undefined) {
      domainId = sig.domain;
      domainNodeIds.set(sig.domain, domainId);
      nodes.push({
        id: domainId,
        type: 'referring-domain',
        domain: sig.domain,
        authority: estimateAuthority(sig.domain),
      });
      edges.push({
        source: root.id,
        target: domainId,
        kind: sig.kind,
        dofollow: sig.dofollow,
      });
    }

    // The page node hanging off its referring domain.
    const pageNode: GraphNode = {
      id: sig.url,
      type: sig.kind === 'backlink' ? 'backlink-page' : 'mention',
      domain: sig.domain,
      url: sig.url,
      mentionType: sig.mentionType,
      dofollow: sig.dofollow,
      authority: estimateAuthority(sig.domain),
    };
    if (sig.title !== undefined) pageNode.title = sig.title;
    if (sig.firstSeen !== undefined) pageNode.firstSeen = sig.firstSeen;
    nodes.push(pageNode);

    edges.push({
      source: domainId,
      target: sig.url,
      kind: sig.kind,
      dofollow: sig.dofollow,
      ...(sig.anchorText !== undefined ? { anchorText: sig.anchorText } : {}),
    });

    linkCountByDomain.set(sig.domain, (linkCountByDomain.get(sig.domain) ?? 0) + 1);
  }

  // --- Stats. ---
  const pageSignals = [...signalsByUrl.values()];
  const dofollowCount = pageSignals.filter((s) => s.dofollow).length;
  const topSources = [...linkCountByDomain.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 10);

  const stats: BacklinkGraphStats = {
    referringDomains: domainNodeIds.size,
    backlinks: pageSignals.length,
    dofollowRatio: pageSignals.length === 0 ? 0 : dofollowCount / pageSignals.length,
    topSources,
    sampled: true,
  };

  // Surface graceful-degradation notices on the graph itself (only when present)
  // so a single dead source is observable without ever having thrown.
  const graph: BacklinkGraph = { root, nodes, edges, stats };
  if (warnings.length > 0) graph.warnings = warnings;
  return graph;
}
