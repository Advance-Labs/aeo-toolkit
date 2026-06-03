import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UrlInputForm } from './UrlInputForm.js';

describe('UrlInputForm', () => {
  it('calls onSubmit with the normalized URL when a bare host is entered', () => {
    const onSubmit = vi.fn();
    render(<UrlInputForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Website URL'), {
      target: { value: 'example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('https://example.com');
  });

  it('passes through an explicit scheme unchanged', () => {
    const onSubmit = vi.fn();
    render(<UrlInputForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Website URL'), {
      target: { value: 'http://docs.example.com/path' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(onSubmit).toHaveBeenCalledWith('http://docs.example.com/path');
  });

  it('shows a validation error and does not submit when empty (edge case)', () => {
    const onSubmit = vi.fn();
    render(<UrlInputForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a url/i);
  });

  it('disables the control and shows a busy label while loading', () => {
    render(<UrlInputForm onSubmit={vi.fn()} loading />);
    const button = screen.getByRole('button', { name: 'Analyzing…' });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Website URL')).toBeDisabled();
  });
});
