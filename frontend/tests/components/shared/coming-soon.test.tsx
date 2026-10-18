import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ComingSoon } from '@/components/shared/coming-soon';
import { MODULES, moduleFor } from '@/components/shared/nav-items';

describe('ComingSoon', () => {
  it('says when the module lands and what it will do', () => {
    const fitness = moduleFor('/fitness');
    if (fitness.status !== 'soon') throw new Error('fitness should be planned');
    render(<ComingSoon module={fitness} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Fitness' })).toBeInTheDocument();
    expect(screen.getByText('Coming in v0.2')).toBeInTheDocument();
    for (const item of fitness.planned) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('points somewhere that works today', () => {
    const gaming = moduleFor('/gaming');
    if (gaming.status !== 'soon') throw new Error('gaming should be planned');
    render(<ComingSoon module={gaming} />);

    expect(screen.getByRole('link', { name: /finance is ready/i })).toHaveAttribute(
      'href',
      '/finance'
    );
  });
});

describe('MODULES', () => {
  it('gives every planned module a release and at least one planned feature', () => {
    for (const entry of MODULES) {
      if (entry.status === 'soon') {
        expect(entry.release).not.toHaveLength(0);
        expect(entry.planned.length).toBeGreaterThan(0);
      }
    }
  });
});
