import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportLayout } from './ReportLayout.js';

describe('ReportLayout', () => {
  it('renders the title as a heading and the children in main', () => {
    render(
      <ReportLayout title="Audit Report" subtitle="example.com">
        <p>Body content</p>
      </ReportLayout>,
    );
    expect(screen.getByRole('heading', { name: 'Audit Report' })).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders actions when provided (edge case)', () => {
    render(
      <ReportLayout title="Report" actions={<button type="button">Export</button>}>
        <span>x</span>
      </ReportLayout>,
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
