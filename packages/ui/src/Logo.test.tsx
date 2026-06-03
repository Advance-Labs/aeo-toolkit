import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo, LogoMark } from './Logo.js';

describe('LogoMark', () => {
  it('renders an accessible SVG mark with a default title', () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(screen.getByRole('img', { name: 'AEO Toolkit' })).toBeInTheDocument();
    expect(svg?.querySelector('title')?.textContent).toBe('AEO Toolkit');
  });

  it('folds idSuffix into the gradient id so multiple marks can coexist (edge case)', () => {
    const { container } = render(
      <>
        <LogoMark idSuffix="a" title="First mark" />
        <LogoMark idSuffix="b" title="Second mark" />
      </>,
    );
    expect(container.querySelector('#aeoTile-a')).not.toBeNull();
    expect(container.querySelector('#aeoTile-b')).not.toBeNull();
    const rects = container.querySelectorAll('rect');
    expect(rects[0]?.getAttribute('fill')).toBe('url(#aeoTile-a)');
    expect(rects[1]?.getAttribute('fill')).toBe('url(#aeoTile-b)');
  });
});

describe('Logo', () => {
  it('renders the mark and the "AEO" / "Toolkit" wordmark', () => {
    render(<Logo />);
    expect(screen.getByText('AEO')).toBeInTheDocument();
    expect(screen.getByText('Toolkit')).toBeInTheDocument();
  });

  it('applies light wordmark colors on the dark variant (edge case)', () => {
    render(<Logo variant="dark" />);
    expect(screen.getByText('AEO').className).toContain('text-[#F8FAFC]');
    expect(screen.getByText('Toolkit').className).toContain('text-[#94A3B8]');
  });
});
