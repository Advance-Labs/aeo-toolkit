import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GradeBadge } from './GradeBadge.js';

describe('GradeBadge', () => {
  it('renders the grade letter with an accessible label', () => {
    render(<GradeBadge grade="A" />);
    const badge = screen.getByRole('status', { name: 'Grade A' });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('A');
  });

  it('applies failing-grade coloring for grade F (edge case)', () => {
    render(<GradeBadge grade="F" />);
    const badge = screen.getByRole('status', { name: 'Grade F' });
    expect(badge.className).toContain('text-red-800');
  });
});
