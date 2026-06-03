import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FixList } from './FixList.js';
import { sampleFindings } from './fixtures.js';

describe('FixList', () => {
  it('shows only failed findings, highest severity first', () => {
    render(<FixList findings={sampleFindings} />);
    const items = screen.getAllByRole('listitem');
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
});
