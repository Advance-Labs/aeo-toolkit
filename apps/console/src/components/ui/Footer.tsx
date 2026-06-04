import Link from 'next/link';
import { LogoMark } from '@aeo/ui';
import { Container } from './Container';

const TOOLS = [
  { href: '/tools/audit', label: 'SEO Audit' },
  { href: '/tools/eeat', label: 'E-E-A-T Scanner' },
  { href: '/tools/llms-txt', label: 'llms.txt Generator' },
  { href: '/tools/chat', label: 'GA4 + GSC Chat' },
  { href: '/tools/graph', label: 'Backlink Graph' },
];

const RESOURCES = [
  { href: '/api/mcp/ai-visibility', label: 'AI Visibility MCP' },
  { href: '/api/mcp/ga-gsc', label: 'GA4 + GSC MCP' },
  { href: '/api/mcp/backlink', label: 'Backlink MCP' },
];

export function Footer(): React.ReactElement {
  return (
    <footer className="relative mt-16 border-t border-white/[0.08] py-14">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
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
          <FooterCol
            title="Company"
            links={[
              { href: 'https://github.com/Advance-Labs', label: 'GitHub' },
              { href: 'https://advancelabs.dev', label: 'Advance Labs' },
            ]}
          />
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-6 text-sm text-slate-500 sm:flex-row sm:items-center">
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
            <Link href={l.href} className="text-sm text-slate-400 transition hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
