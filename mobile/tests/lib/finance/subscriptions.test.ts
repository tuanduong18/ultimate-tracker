import {
  formatInterval,
  hasEnded,
  inDays,
  isLive,
  nextStep,
  renewable,
} from '@/lib/finance/subscriptions';
import type { Subscription } from '@/lib/finance/types';

const TODAY = '2026-11-07';

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: 's',
    name: 'Netflix',
    amount: '15.49',
    currency: 'USD',
    interval_unit: 'month',
    interval_count: 1,
    category_id: null,
    started_on: '2026-01-22',
    trial_ends_on: null,
    next_billing_on: '2026-11-22',
    cancelled_on: null,
    note: null,
    created_at: '2026-01-22T00:00:00Z',
    ...overrides,
  };
}

describe('words', () => {
  it('says how often, and how soon', () => {
    expect(formatInterval('month', 1)).toBe('month');
    expect(formatInterval('month', 3)).toBe('3 months');
    expect(inDays(0)).toBe('today');
    expect(inDays(-2)).toBe('today');
    expect(inDays(1)).toBe('tomorrow');
    expect(inDays(5)).toBe('in 5 days');
  });
});

describe('nextStep', () => {
  it('gives a date for a renewal well ahead, and stands out within three days', () => {
    expect(nextStep(subscription({}), TODAY)).toEqual({
      text: expect.stringMatching(/^Renews .*2026$/),
      soon: false,
    });
    expect(nextStep(subscription({ next_billing_on: '2026-11-09' }), TODAY)).toEqual({
      text: 'Renews in 2 days',
      soon: true,
    });
  });

  it('says a trial is ending when the next charge is the end of the trial', () => {
    const trial = subscription({ trial_ends_on: '2026-11-08', next_billing_on: '2026-11-08' });
    expect(nextStep(trial, TODAY).text).toBe('Trial ends tomorrow');
  });

  it('names a cancellation that has happened, and one still ahead', () => {
    expect(nextStep(subscription({ cancelled_on: '2026-11-01' }), TODAY).text).toMatch(
      /^Cancelled /
    );
    expect(nextStep(subscription({ cancelled_on: '2026-12-31' }), TODAY).text).toMatch(/ · ends /);
  });

  it('says a charge was due when nothing has moved its date on yet', () => {
    expect(nextStep(subscription({ next_billing_on: '2026-11-01' }), TODAY).text).toMatch(
      /^Was due /
    );
  });
});

describe('state', () => {
  it('offers renewing early only while the next charge will happen', () => {
    expect(renewable(subscription({}))).toBe(true);
    expect(renewable(subscription({ cancelled_on: '2026-12-31' }))).toBe(true);
    expect(renewable(subscription({ cancelled_on: '2026-11-22' }))).toBe(false);
  });

  it('counts a subscription as live until the day it is cancelled from', () => {
    expect(isLive(subscription({ cancelled_on: '2026-11-08' }), TODAY)).toBe(true);
    expect(hasEnded(subscription({ cancelled_on: TODAY }), TODAY)).toBe(true);
  });
});
