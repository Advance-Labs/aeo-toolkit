import Link from 'next/link';
import { LogoMark } from '@advance-labs/ui';
import { Container } from './Container';

const TOOLS = [
  { href: '/tools/audit', label: 'SEO Audit' },
  { href: '/tools/eeat', label: 'E-E-A-T Scanner' },
  { href: '/tools/llms-txt', label: 'llms.txt Generator' },
  { href: '/tools/chat', label: 'GA4 + GSC Chat' },
  { href: '/tools/graph', label: 'Backlink Graph' },
];

// Point humans at the `/mcp` connection page (anchored to each server). The machine endpoints
// live at `/api/mcp/<slug>/mcp` and are for MCP clients only; the bare `/api/mcp/<slug>` always
// 404s, which is mcp-handler's own response and not a routing fault.
const RESOURCES = [
  { href: '/mcp#ai-visibility', label: 'AI Visibility MCP' },
  { href: '/mcp#ga-gsc', label: 'GA4 + GSC MCP' },
  { href: '/mcp#backlink', label: 'Backlink MCP' },
];

// The content cluster (#35–#37): footer links make it a site-wide hub, which is exactly the
// internal-linking pattern the SEO plan prescribes (and the scoring engine rewards).
const LEARN = [
  { href: '/guide/answer-engine-optimization', label: 'AEO Guide' },
  { href: '/glossary', label: 'Glossary' },
  { href: '/compare/aeo-vs-seo', label: 'AEO vs SEO' },
];

export function Footer(): React.ReactElement {
  return (
    <footer className="relative mt-16 border-t border-white/[0.08] py-14">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="max-w-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5"
              aria-label="AEO Toolkit home"
            >
              <LogoMark size={28} idSuffix="footer" />
              <span className="font-display text-lg font-semibold text-white">AEO Toolkit</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Audit, optimize, and track your visibility across AI answer engines — ChatGPT, Claude,
              Perplexity, and Google AI Overviews.
            </p>
          </div>
          <FooterCol title="Tools" links={TOOLS} />
          <FooterCol title="MCP servers" links={RESOURCES} />
          <FooterCol title="Learn" links={LEARN} />
          <FooterCol
            title="Company"
            links={[
              { href: '/about', label: 'About' },
              { href: 'https://github.com/Advance-Labs', label: 'GitHub' },
              { href: 'https://advancelabs.dev', label: 'Advance Labs' },
            ]}
          />
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-6 text-sm text-slate-400 sm:flex-row sm:items-center">
          <p>© 2026 Advance Labs Inc. All rights reserved.</p>
          <p>Built clean-room in TypeScript · MIT licensed</p>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}): React.ReactElement {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <FooterLink href={l.href}>{l.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Internal page routes use Next `<Link>` (prefetched RSC nav). Anything else — external sites and
 * raw API/MCP endpoints — uses a plain `<a>`: same-origin `<a>` is never RSC-prefetched, so MCP
 * endpoints (POST-only) don't get a stray GET prefetch that 404s the console. Endpoints/external
 * links open in a new tab.
 */
function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  const className = 'text-sm text-slate-400 transition hover:text-white';
  const isPageRoute = href.startsWith('/') && !href.startsWith('/api/');
  if (isPageRoute) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}
