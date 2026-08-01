import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FixList } from './FixList.js';
import { sampleFindings } from './fixtures.js';

describe('FixList', () => {
  it('shows only failed findings, highest severity first', () => {
    render(<FixList findings={sampleFindings} />);
    // Assert on DIRECT children of the fix list. Findings render a nested list of affected
    // URLs, so both an unscoped listitem query and a `within` query would also match those.
    const fixes = screen.getByRole('list', { name: 'Prioritized fixes' });
    const items = [...fixes.children] as HTMLElement[];
    // Two failed findings; the passing "HTTPS enabled" one is filtered out.
    expect(items).toHaveLength(2);
    // Critical sorts ahead of high.
    expect(within(items[0]!).getByText('Missing meta description')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Missing llms.txt')).toBeInTheDocument();
    expect(screen.queryByText('HTTPS enabled')).not.toBeInTheDocument();
  });

  it('renders an all-clear message when nothing failed (edge case)', () => {
    const passing = sampleFindings.map((f) => ({ ...f, passed: true }));
    render(<FixList findings={passing} />);
    expect(screen.getByRole('status')).toHaveTextContent(/everything passed/i);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  describe('affected URLs', () => {
    // These used to render as a bare count, which names a problem without locating it.
    // Rules like tech.sitemap-covers-pages are only actionable with the URLs visible.
    const withUrls = (urls: string[]) => [
      { ...sampleFindings.find((f) => !f.passed)!, id: 'x', affectedUrls: urls },
    ];

    it('lists short URL sets inline', () => {
      render(<FixList findings={withUrls(['https://a.example/one', 'https://a.example/two'])} />);
      expect(screen.getByText('2 affected URLs')).toBeInTheDocument();
      expect(screen.getByText('https://a.example/one')).toBeInTheDocument();
      expect(screen.getByText('https://a.example/two')).toBeInTheDocument();
    });

    it('collapses long URL sets behind a disclosure but still renders them', () => {
      const many = Array.from({ length: 12 }, (_, i) => `https://a.example/page-${i}`);
      render(<FixList findings={withUrls(many)} />);
      expect(screen.getByText(/12 affected URLs/)).toBeInTheDocument();
      // Inside <details>, so present in the DOM (and findable/copyable) even when collapsed.
      expect(screen.getByText('https://a.example/page-11')).toBeInTheDocument();
    });

    it('uses the singular for one URL', () => {
      render(<FixList findings={withUrls(['https://a.example/solo'])} />);
      expect(screen.getByText('1 affected URL')).toBeInTheDocument();
    });
  });
});
