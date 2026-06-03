import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryBreakdown } from './CategoryBreakdown.js';
import { sampleCategories } from './fixtures.js';

describe('CategoryBreakdown', () => {
  it('renders a labelled progressbar per category', () => {
    render(<CategoryBreakdown categories={sampleCategories} />);
    const crawl = screen.getByRole('progressbar', { name: 'Crawlability score' });
    expect(crawl).toHaveAttribute('aria-valuenow', '92');
    const aeo = screen.getByRole('progressbar', { name: 'AI Readiness score' });
    expect(aeo).toHaveAttribute('aria-valuenow', '48');
  });

  it('renders an empty-state message for no categories (edge case)', () => {
    render(<CategoryBreakdown categories={[]} />);
    expect(screen.getByText(/no category data/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
