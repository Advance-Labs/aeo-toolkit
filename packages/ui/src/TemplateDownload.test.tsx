import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TemplateDownload } from './TemplateDownload.js';
import { sampleTemplate } from './fixtures.js';

describe('TemplateDownload', () => {
  it('renders the filename, reason, and content', () => {
    render(<TemplateDownload template={sampleTemplate} />);
    expect(screen.getByRole('heading', { name: 'llms.txt' })).toBeInTheDocument();
    expect(screen.getByText(/missing an llms.txt manifest/i)).toBeInTheDocument();
    expect(screen.getByText(/A sample llms.txt manifest/)).toBeInTheDocument();
  });

  it('invokes the injected onDownload with the template (edge case: I/O mocked)', () => {
    const onDownload = vi.fn();
    render(<TemplateDownload template={sampleTemplate} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith(sampleTemplate);
  });
});
