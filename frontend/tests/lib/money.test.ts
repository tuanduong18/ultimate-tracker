import { describe, expect, it } from 'vitest';

import { sumAmounts } from '@/lib/money';

describe('sumAmounts', () => {
  it('adds without the error that adding the numbers directly would', () => {
    // 0.1 + 0.2 is 0.30000000000000004 as floats, which is the whole reason
    // the API sends these as strings in the first place.
    expect(sumAmounts(['0.1', '0.2'])).toBe('0.3');
  });

  it('keeps the widest scale any of its inputs carried', () => {
    // Numeric(20, 3) hands back three places; a total that dropped them would
    // disagree with the rows above it.
    expect(sumAmounts(['12.500', '0.25'])).toBe('12.750');
  });

  it('adds whole amounts without inventing a decimal point', () => {
    // VND has no minor unit, so "50000.0" would be wrong, not just noisy.
    expect(sumAmounts(['50000', '25000'])).toBe('75000');
  });

  it('totals a realistic set of rows exactly', () => {
    expect(sumAmounts(['19.99', '5.01', '100.00', '0.01'])).toBe('125.01');
  });

  it('handles negatives, since remaining can be an overspend', () => {
    expect(sumAmounts(['100.00', '-25.50'])).toBe('74.50');
  });

  it('is zero for nothing at all', () => {
    expect(sumAmounts([])).toBe('0');
  });

  it('skips a malformed row rather than returning NaN', () => {
    // A total reading "NaN" beside a pie chart is worse than one that is short
    // by a row, and the API's validation makes this a bug rather than input.
    expect(sumAmounts(['10.00', 'oops', '5.00'])).toBe('15.00');
  });

  it('carries across the decimal point correctly', () => {
    expect(sumAmounts(['0.99', '0.01'])).toBe('1.00');
    expect(sumAmounts(['0.05', '-0.10'])).toBe('-0.05');
  });
});
