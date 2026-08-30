import type { JSX } from 'react';
import type { Metadata } from 'next';
import {
  Badge,
  Breadcrumb,
  Container,
  GradientText,
  Reveal,
  Section,
  SpotlightCard,
} from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  SITE_NAME,
  SITE_URL,
  absolute,
  breadcrumbSchema,
  organizationSchema,
  websiteSchema,
} from '@/lib/seo';
import type { Crumb } from '@/lib/seo';
import { MCP_SERVERS } from '@/lib/mcp-catalog';
import type { McpServerMeta } from '@/lib/mcp-catalog';
import { CopyField } from './CopyField';

const PAGE_PATH = '/mcp';
const PAGE_URL = absolute(PAGE_PATH);
const SITE_ORIGIN = SITE_URL.replace(/\/$/, '');
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

const PAGE_DESCRIPTION =
  'Connect the AEO Toolkit to Claude, Cursor, and other AI clients over the Model Context Protocol (MCP). Free, hosted MCP servers for AI visibility, backlinks, and GA4 + Search Console.';

/** Visible breadcrumb trail (Home › MCP) — mirrored 1:1 into BreadcrumbList JSON-LD. */
const TRAIL: ReadonlyArray<Crumb> = [
  { name: 'Home', path: '/' },
  { name: 'MCP', path: PAGE_PATH },
];

/**
 * `/mcp` page metadata. Hand-written (not `toolMetadata`) because this is a connection/docs page, not a
 * tool under `/tools` — same shape, but the canonical and Open Graph URLs resolve to `/mcp`. The layout
 * title template appends ` — AEO Toolkit`, so the title here stays short. Twitter title/description are
 * set explicitly because Next does not inherit them from Open Graph.
 */
export const metadata: Metadata = {
  title: 'Connect to Claude & Cursor — MCP servers',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'Connect the AEO Toolkit to your AI client — MCP servers',
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Connect the AEO Toolkit to your AI client — MCP servers',
    description: PAGE_DESCRIPTION,
  },
};

/** Answer-first summary an LLM can lift verbatim — what these MCP servers are and how to connect. */
const ANSWER_FIRST =
  'The Model Context Protocol (MCP) lets AI clients like Claude and Cursor call tools directly. The AEO Toolkit exposes three free, hosted MCP servers — AI Visibility, Backlinks, and GA4 + Search Console — so your AI assistant can audit AEO, prospect backlinks, and query your own analytics in plain language. Add a server by pasting its connection URL into your client.';

const TOTAL_TOOLS = MCP_SERVERS.reduce((n, s) => n + s.tools.length, 0);

/**
 * MCP connection page. Server component: ships an answer-first explainer, one `SpotlightCard` per
 * server with a copyable connection URL, "Add to Claude.ai" steps, a Cursor `mcp.json` snippet, the
 * tool list, and example prompts — plus `SoftwareApplication` + per-server `ItemList` JSON-LD so answer
 * engines can resolve the integration. Machine clients connect to `/api/mcp/<slug>/mcp`; humans land
 * here. The connection strings come from `mcpEndpoint()` in `@/lib/mcp-catalog`, which owns the
 * transport-path detail so this page cannot drift from it.
 */
export default function McpPage(): JSX.Element {
  const breadcrumb = breadcrumbSchema(TRAIL);

  // SoftwareApplication for the connection layer + one ItemList of tools per server, so AI answer
  // engines can enumerate what the integration offers. All app-authored, no user input.
  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${SITE_NAME} — MCP servers`,
    url: PAGE_URL,
    description: PAGE_DESCRIPTION,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Model Context Protocol (MCP) integration',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    isPartOf: { '@id': WEBSITE_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  const toolLists = MCP_SERVERS.map((server) => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${server.name} tools`,
    description: server.blurb,
    url: `${PAGE_URL}#${server.slug}`,
    numberOfItems: server.tools.length,
    itemListElement: server.tools.map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: tool.name,
      description: tool.summary,
    })),
  }));

  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema(), software, ...toolLists, breadcrumb]} />

      {/* Hero */}
      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <header className="flex flex-col gap-5">
            <Breadcrumb trail={TRAIL} />
            <Badge tone="violet">Model Context Protocol</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Connect the AEO Toolkit to your <GradientText>AI client</GradientText>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{ANSWER_FIRST}</p>
            <p className="text-sm text-slate-400">
              {MCP_SERVERS.length} servers · {TOTAL_TOOLS} tools · free to connect
            </p>
          </header>
        </div>
      </Section>

      {/* What is MCP — beginner explainer */}
      <Section className="border-t border-white/[0.06] bg-grid py-14 sm:py-16">
        <Container>
          <Reveal>
            <div className="grid gap-6 lg:grid-cols-[1fr,1.3fr]">
              <div className="flex flex-col gap-3 lg:sticky lg:top-24">
                <span className="eyebrow">New to MCP?</span>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Tools your AI can <GradientText>actually call</GradientText>
                </h2>
              </div>
              <div className="surface flex flex-col gap-4 p-6">
                <p className="text-base leading-relaxed text-slate-300">
                  The Model Context Protocol is an open standard that lets AI clients — Claude, Cursor,
                  and others — call external tools directly. Instead of copying results back and forth,
                  your assistant runs the toolkit&apos;s functions for you and reasons over the output.
                </p>
                <p className="text-base leading-relaxed text-slate-400">
                  Each server below is a single connection URL. Paste it into your client once; from
                  then on you just ask in plain language and the AI picks the right tool. The two
                  open servers need no account. The GA4 + Search Console server connects to your own
                  Google data when prompted.
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Servers */}
      <Section className="border-t border-white/[0.06] py-14 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="eyebrow">The servers</span>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Three hosted <GradientText>MCP servers</GradientText>
              </h2>
              <p className="text-base leading-relaxed text-slate-400">
                Add any of these to your AI client. Connection details, tools, and example prompts for
                each are below.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-6">
            {MCP_SERVERS.map((server, i) => (
              <div key={server.slug} id={server.slug} className="scroll-mt-24">
                <Reveal delay={(i % 2) * 0.05}>
                  <ServerCard server={server} />
                </Reveal>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

/** Render one MCP server: connection URL, auth note, Claude steps, Cursor snippet, tools, prompts. */
function ServerCard({ server }: { server: McpServerMeta }): JSX.Element {
  const needsGoogle = server.auth === 'google-byok';
  const cursorSnippet = JSON.stringify(
    { mcpServers: { [server.slug]: { url: server.endpoint } } },
    null,
    2,
  );

  return (
    <SpotlightCard className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-semibold text-white">{server.name}</h3>
          <p className="max-w-xl text-sm leading-relaxed text-slate-400">{server.blurb}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {server.status === 'live' ? (
            <Badge tone="cyan">Live · no account</Badge>
          ) : (
            <Badge tone="violet">Connect Google</Badge>
          )}
          <Badge tone="neutral">{server.tools.length} tools</Badge>
        </div>
      </div>

      {/* Connection URL */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Connection URL
        </p>
        <div className="mt-2">
          <CopyField value={server.endpoint} label={`${server.name} connection URL`} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {needsGoogle
            ? 'Authentication: sign in with Google when your client prompts. Your tokens are scoped to your account and never shared.'
            : 'Authentication: none. Tools that call third-party AI (Perplexity, your LLM) take a request-scoped key you supply — it is never stored or logged.'}
        </p>
      </div>

      {/* Two-column setup: Claude + Cursor */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Add to Claude.ai */}
        <div className="surface flex flex-col gap-3 p-5">
          <h4 className="text-sm font-semibold text-white">Add to Claude.ai</h4>
          <ol className="flex flex-col gap-2 text-sm leading-relaxed text-slate-400">
            <li>
              <span className="text-slate-300">1.</span> Open{' '}
              <span className="text-slate-200">Settings → Connectors</span>.
            </li>
            <li>
              <span className="text-slate-300">2.</span> Click{' '}
              <span className="text-slate-200">Add custom connector</span>.
            </li>
            <li>
              <span className="text-slate-300">3.</span> Paste the connection URL above and save.
            </li>
            {needsGoogle ? (
              <li>
                <span className="text-slate-300">4.</span> Sign in with Google when prompted to
                connect your analytics.
              </li>
            ) : null}
          </ol>
        </div>

        {/* Cursor mcp.json */}
        <div className="surface flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-white">
              Cursor <code className="font-mono text-xs text-slate-400">mcp.json</code>
            </h4>
            <CopyField
              value={cursorSnippet}
              label={`${server.name} Cursor configuration`}
              variant="button"
            />
          </div>
          <pre className="overflow-x-auto rounded-lg border border-white/[0.08] bg-ink-950/60 p-3 text-xs leading-relaxed text-slate-300">
            <code className="font-mono">{cursorSnippet}</code>
          </pre>
        </div>
      </div>

      {/* Tools */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-white">Tools ({server.tools.length})</h4>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {server.tools.map((tool) => (
            <li
              key={tool.name}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <code className="font-mono text-xs text-brand-cyan">{tool.name}</code>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{tool.summary}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Example prompts */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-white">What you can ask</h4>
        <ul className="mt-3 flex flex-col gap-2">
          {server.examplePrompts.map((prompt) => (
            <li
              key={prompt}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm leading-relaxed text-slate-300"
            >
              <span aria-hidden className="mr-2 text-brand-violet">
                &ldquo;
              </span>
              {prompt}
            </li>
          ))}
        </ul>
      </div>
    </SpotlightCard>
  );
}
