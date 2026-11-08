import { ApiError } from '@/lib/api-error';
import { describeError } from '@/lib/describe-error';

const refusal = (status: number, code: string, message = 'Server words.', details?: unknown) =>
  new ApiError(status, { code, message, details });

describe('describeError', () => {
  it('words the codes a person can act on the way the web does', () => {
    expect(describeError(refusal(409, 'CATEGORY_NAME_TAKEN'), 'x')).toBe(
      'You already have a category with that name.'
    );
    expect(describeError(refusal(409, 'SUBSCRIPTION_CANCELLED'), 'x')).toMatch(
      /clear the cancellation to renew it/
    );
    expect(describeError(refusal(503, 'RATE_UNAVAILABLE'), 'x')).toBe(
      'Exchange rates are unavailable right now, so totals cannot be shown.'
    );
  });

  it('passes on the server’s own words only where they are written for people', () => {
    expect(describeError(refusal(422, 'INVALID_AMOUNT', 'JPY takes no decimals.'), 'x')).toBe(
      'JPY takes no decimals.'
    );
  });

  it('turns the first validation reason into a sentence naming its field', () => {
    const details = [{ loc: ['body', 'amount'], msg: 'Input should be greater than 0' }];
    expect(
      describeError(refusal(422, 'VALIDATION_ERROR', 'Request validation failed.', details), 'x')
    ).toBe('amount: Input should be greater than 0');
    const crossField = [{ loc: ['body'], msg: 'Value error, a custom budget needs ends_on' }];
    expect(describeError(refusal(422, 'VALIDATION_ERROR', 'v', crossField), 'x')).toBe(
      'a custom budget needs ends_on'
    );
    expect(describeError(refusal(422, 'VALIDATION_ERROR', 'v', []), 'x')).toBe(
      'Some of those details are not valid.'
    );
  });

  it('falls back to the caller’s sentence when the request never got an answer', () => {
    expect(
      describeError(new TypeError('Network request failed'), 'Could not save that expense.')
    ).toBe('Could not save that expense.');
  });
});
