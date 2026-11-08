import {
  subscriptionPayload,
  subscriptionProblems,
  subscriptionValues,
  unitLabel,
  type SubscriptionValues,
} from '@/lib/finance/subscription-form';

const DEFAULTS = { currency: 'SGD', categoryId: 'subs', today: '2026-11-07' };
const FILLED: SubscriptionValues = {
  ...subscriptionValues(null, DEFAULTS),
  name: 'Netflix',
  amount: '15.49',
};

describe('subscriptionValues', () => {
  it('starts monthly, every 1, today, under the chosen category', () => {
    expect(subscriptionValues(null, DEFAULTS)).toEqual({
      name: '',
      amount: '',
      currency: 'SGD',
      interval_unit: 'month',
      interval_count: '1',
      category_id: 'subs',
      started_on: '2026-11-07',
      trial_ends_on: '',
      cancelled_on: '',
    });
  });
});

describe('subscriptionProblems', () => {
  it('accepts a complete subscription', () => {
    expect(subscriptionProblems(FILLED)).toEqual({});
  });

  it('wants a whole number of units, at least 1', () => {
    for (const count of ['0', '1.5', '', 'two']) {
      expect(subscriptionProblems({ ...FILLED, interval_count: count }).interval_count).toBe(
        'Bill every 1 or more — a whole number.'
      );
    }
  });

  it('puts a trial after the start and a cancellation on or after it', () => {
    expect(subscriptionProblems({ ...FILLED, trial_ends_on: '2026-11-07' }).trial_ends_on).toBe(
      'The trial must end after the start date.'
    );
    expect(subscriptionProblems({ ...FILLED, cancelled_on: '2026-11-06' }).cancelled_on).toBe(
      'The cancellation date must be on or after the start date.'
    );
    expect(subscriptionProblems({ ...FILLED, cancelled_on: '2026-11-07' })).toEqual({});
  });
});

describe('subscriptionPayload', () => {
  it('sends nullable fields explicitly, and no cancellation for a new one', () => {
    expect(
      subscriptionPayload({ ...FILLED, category_id: '', interval_count: ' 3 ' }, false)
    ).toEqual({
      name: 'Netflix',
      amount: '15.49',
      currency: 'SGD',
      interval_unit: 'month',
      interval_count: 3,
      category_id: null,
      started_on: '2026-11-07',
      trial_ends_on: null,
    });
  });

  it('sends the cancellation when editing — null resumes it', () => {
    expect(subscriptionPayload(FILLED, true)).toMatchObject({ cancelled_on: null });
    expect(subscriptionPayload({ ...FILLED, cancelled_on: '2026-12-31' }, true)).toMatchObject({
      cancelled_on: '2026-12-31',
    });
  });
});

describe('unitLabel', () => {
  it('reads singular for every 1 and plural otherwise', () => {
    expect(unitLabel('month', '1')).toBe('Month');
    expect(unitLabel('month', '3')).toBe('Months');
    expect(unitLabel('day', '')).toBe('Days');
  });
});
