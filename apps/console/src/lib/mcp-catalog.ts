/**
 * Shared MCP server + tool metadata — the single source of truth for the human-facing `/mcp`
 * connection page.
 *
 * Hand-authored from the three server registrations under `src/mcp/<slug>/server.ts` (the servers are
 * NOT executed here — this is static catalog data the App-Router page renders). Each tool summary is
 * distilled from that server's `description` docstring so the page stays accurate without importing the
 * MCP SDK into the page bundle. Endpoints are derived from `SITE_URL` so they track the deployed origin.
 */

import { SITE_URL } from './seo';

/** One MCP tool: its wire name (verbatim from the server registration) and a one-line summary. */
export interface McpToolMeta {
  /** Exact tool name as registered on the MCP server (what the AI client invokes). */
  name: string;
  /** Crisp one-line description of what the tool does, for the human-facing page. */
  summary: string;
}

/** One MCP server exposed over Streamable HTTP at `endpoint`, with its tool catalog. */
export interface McpServerMeta {
  /** Stable URL/anchor slug; also the last path segment of the endpoint. */
  slug: 'ai-visibility' | 'ga-gsc' | 'backlink';
  /** Human display name, e.g. "AI Visibility MCP". */
  name: string;
  /** One-sentence description of the server's purpose. */
  blurb: string;
  /** Streamable-HTTP endpoint an MCP client connects to (`${SITE_URL}/api/mcp/<slug>`). */
  endpoint: string;
  /** Authentication model: open, or bring-your-own Google account (OAuth at connect time). */
  auth: 'none' | 'google-byok';
  /** Operational status: live and open, or requires a Google connection to return data. */
  status: 'live' | 'needs-google';
  /** Natural-language example prompts a user can ask their AI client once connected. */
  examplePrompts: string[];
  /** The server's tools, in registration order. */
  tools: McpToolMeta[];
}

/** Build a server's Streamable-HTTP endpoint URL from the deployed origin, tolerating a trailing slash. */
function mcpEndpoint(slug: McpServerMeta['slug']): string {
  return `${SITE_URL.replace(/\/$/, '')}/api/mcp/${slug}`;
}

/**
 * Every MCP server the toolkit exposes, with the exact tool set each registers.
 *
 * Ordering and tool names mirror `registerAiVisibilityTools`, `registerBacklinkTools`, and
 * `registerGaGscTools` so the page documents reality. Summaries are condensed from each tool's
 * registered `description`.
 */
export const MCP_SERVERS: readonly McpServerMeta[] = [
  {
    slug: 'ai-visibility',
    name: 'AI Visibility MCP',
    blurb:
      'Audit a site for answer-engine optimization and measure whether AI answer engines actually cite it.',
    endpoint: mcpEndpoint('ai-visibility'),
    auth: 'none',
    status: 'live',
    examplePrompts: [
      'Analyze https://example.com for AEO and list its top fixes.',
      'Is example.com cited when someone asks "best CRM for startups"?',
      'Compare example.com against two competitors for "project management tools".',
    ],
    tools: [
      {
        name: 'analyze_website_aeo',
        summary:
          'Crawl a URL, parse its HTML and structured data, and score it for answer-engine optimization with prioritized fixes.',
      },
      {
        name: 'check_ai_visibility',
        summary:
          'Query Perplexity Sonar with a prompt and check whether the URL is cited as a source, and at what rank (BYOK).',
      },
      {
        name: 'discover_ranking_prompts',
        summary:
          'Generate realistic user prompts a site should aim to be cited for on a topic, optionally live-testing a few (BYOK).',
      },
      {
        name: 'get_visibility_report',
        summary:
          'Combine an AEO audit with per-prompt visibility checks into one report with an overall citation rate (BYOK).',
      },
      {
        name: 'compare_competitor_visibility',
        summary:
          'Run one Perplexity Sonar query and rank several competitor URLs by whether and where each is cited (BYOK).',
      },
    ],
  },
  {
    slug: 'backlink',
    name: 'Backlink MCP',
    blurb:
      'Prospect link-building opportunities, find brand mentions, vet pages, and draft outreach — all from free web signals.',
    endpoint: mcpEndpoint('backlink'),
    auth: 'none',
    status: 'live',
    examplePrompts: [
      'Find guest-post and resource-page prospects for "headless CMS".',
      'Find unlinked mentions of my brand "Acme" on acme.com so I can chase backlinks.',
      'Draft a short outreach email to the editor of example.com about a guest post.',
    ],
    tools: [
      {
        name: 'find_prospects',
        summary:
          'Find guest-post, resource-page, and roundup link prospects for a topic via classic outreach footprints, merged by host.',
      },
      {
        name: 'find_mentions',
        summary:
          'Find linked and unlinked mentions of a brand across the web, flagging unlinked ones as backlink opportunities.',
      },
      {
        name: 'extract_contact_info',
        summary:
          'Fetch a page and extract contact emails (including de-obfuscated and mailto) plus social media handles.',
      },
      {
        name: 'check_page_history',
        summary:
          'Return a Wayback Machine timeline for a URL: snapshot count, first/last archived dates, and direct archive links.',
      },
      {
        name: 'generate_outreach_email',
        summary:
          'Draft a short, personalized cold outreach email (subject + body) from a contact and context, using your own LLM key (BYOK).',
      },
      {
        name: 'verify_page_links',
        summary:
          'Fetch a page and confirm whether it links to a target domain, reporting anchor text, rel attributes, and dofollow status.',
      },
      {
        name: 'find_competitor_link_sources',
        summary:
          "Approximate the pages linking to a competitor using free DuckDuckGo signals — a directional prospecting starting point.",
      },
    ],
  },
  {
    slug: 'ga-gsc',
    name: 'GA4 + GSC MCP',
    blurb:
      'Query your own Google Analytics 4 and Search Console data in natural language after connecting your Google account.',
    endpoint: mcpEndpoint('ga-gsc'),
    auth: 'google-byok',
    status: 'needs-google',
    examplePrompts: [
      'List my Search Console sites and show the top queries for example.com over the last 28 days.',
      'Find high-impression, low-CTR queries on example.com that need better titles.',
      'Compare Search Console clicks and impressions for the last 28 days vs the prior 28.',
    ],
    tools: [
      {
        name: 'list_ga4_properties',
        summary:
          'List the Google Analytics 4 properties the connected account can access (propertyId + displayName).',
      },
      {
        name: 'list_gsc_sites',
        summary:
          'List the Google Search Console properties the connected account can access (siteUrl + permission level).',
      },
      {
        name: 'ga4_run_report',
        summary:
          'Run a GA4 report for a property over date ranges with chosen dimensions and metrics, returning named rows.',
      },
      {
        name: 'gsc_search_analytics',
        summary:
          'Query Search Console Search Analytics over a date range, optionally broken down by query, page, country, device, or date.',
      },
      {
        name: 'gsc_top_queries',
        summary:
          'Return the top search queries for a site over the last N days, ranked by clicks (with impressions, CTR, position).',
      },
      {
        name: 'gsc_ctr_gaps',
        summary:
          'Surface high-impression, low-CTR queries over the last N days — prime targets for title and meta rewrites.',
      },
      {
        name: 'compare_periods',
        summary:
          'Compare aggregate Search Console performance between two date ranges, returning per-metric absolute and relative deltas.',
      },
    ],
  },
];
