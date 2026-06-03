import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreGauge } from './ScoreGauge.js';
import { sampleScore } from './fixtures.js';

describe('ScoreGauge', () => {
  it('renders the rounded overall score and grade', () => {
    render(<ScoreGauge score={sampleScore} />);
    expect(screen.getByText('71')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Grade C' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Overall score 71 out of 100, grade C/ }),
    ).toBeInTheDocument();
  });

  it('omits the critical count when there are no critical findings (edge case)', () => {
    render(<ScoreGauge score={{ ...sampleScore, criticalCount: 0 }} />);
    expect(screen.queryByText(/critical/)).not.toBeInTheDocument();
  });
});
