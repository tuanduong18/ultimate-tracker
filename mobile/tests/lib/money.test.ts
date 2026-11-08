import { amountProblem, formatMoney, sumAmounts } from '@/lib/money';

describe('formatMoney', () => {
  it('writes an API amount in its own currency', () => {
    expect(formatMoney('12.500', 'USD')).toMatch(/12\.50/);
    expect(formatMoney('12.500', 'USD')).toMatch(/\$/);
  });

  it('shows a currency Intl does not know rather than throwing', () => {
    expect(formatMoney('5.00', 'ZZZ1')).toBe('5.00 ZZZ1');
  });

  it('shows an amount it cannot read as it came', () => {
    expect(formatMoney('oops', 'USD')).toBe('oops USD');
  });
});

describe('amountProblem', () => {
  it('accepts a plain decimal with up to three places', () => {
    expect(amountProblem(' 12.50 ')).toBeNull();
    expect(amountProblem('3.125')).toBeNull();
    expect(amountProblem('50000')).toBeNull();
  });

  it('describes what it wants instead of calling the amount invalid', () => {
    expect(amountProblem('')).toBe('Enter an amount like 12.50.');
    expect(amountProblem('12,50')).toBe('Enter an amount like 12.50.');
    expect(amountProblem('1.2345')).toBe('Enter an amount like 12.50.');
    expect(amountProblem('-4')).toBe('Enter an amount like 12.50.');
  });

  it('refuses zero', () => {
    expect(amountProblem('0.00')).toBe('The amount must be more than zero.');
  });
});

describe('sumAmounts', () => {
  it('adds without the error that adding the numbers directly would', () => {
    expect(sumAmounts(['0.1', '0.2'])).toBe('0.3');
  });

  it('keeps the widest scale any of its inputs carried', () => {
    expect(sumAmounts(['12.500', '0.25'])).toBe('12.750');
  });

  it('adds whole amounts without inventing a decimal point', () => {
    expect(sumAmounts(['50000', '25000'])).toBe('75000');
  });

  it('handles negatives, since remaining can be an overspend', () => {
    expect(sumAmounts(['100.00', '-25.50'])).toBe('74.50');
    expect(sumAmounts(['0.05', '-0.10'])).toBe('-0.05');
  });

  it('is zero for nothing, and skips a malformed row rather than returning NaN', () => {
    expect(sumAmounts([])).toBe('0');
    expect(sumAmounts(['10.00', 'oops', '5.00'])).toBe('15.00');
  });
});
