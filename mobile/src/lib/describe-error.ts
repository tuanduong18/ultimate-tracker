import { ApiError } from '@/lib/api-error';

/**
 * A failed request as a sentence a person can act on — the phone's copy of `describeError` in
 * frontend/lib/hooks/use-collection.ts, so both clients word the same refusal the same way.
 *
 * The server's own message is shown only where it is already written for people (amount and
 * date-range rules); everywhere else a code maps to words of ours. Anything that is not an
 * `ApiError` — no signal, a request that never reached the server — gets the caller's fallback,
 * which names what failed ("Could not save that expense.").
 */
export function describeError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  switch (err.code) {
    case 'CATEGORY_NAME_TAKEN':
      return 'You already have a category with that name.';
    case 'UNKNOWN_CATEGORY':
      return 'That category no longer exists — reload and try again.';
    case 'NOT_FOUND':
      return 'That item no longer exists — someone may have deleted it.';
    case 'INVALID_AMOUNT':
    case 'INVALID_DATE_RANGE':
    case 'IMPORT_FILE_REJECTED':
    case 'IMPORT_FILE_TOO_LARGE':
      // The backend's message is specific and already user-safe here.
      return err.message;
    case 'VALIDATION_ERROR':
      return firstValidationMessage(err.details) ?? 'Some of those details are not valid.';
    case 'SUBSCRIPTION_CANCELLED':
      return 'That subscription is cancelled before its next charge — clear the cancellation to renew it.';
    case 'RATE_UNAVAILABLE':
      return 'Exchange rates are unavailable right now, so totals cannot be shown.';
    default:
      return err.message || fallback;
  }
}

interface ValidationDetail {
  loc?: unknown;
  msg?: unknown;
}

/**
 * The first of Pydantic's reasons, readable: "amount: Input should be greater than 0", with the
 * "Value error, " prefix a cross-field rule carries taken off. `loc` is ['body', 'amount'] — the
 * field is its last segment, and 'body' alone means the whole payload, not worth naming.
 */
function firstValidationMessage(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const first = details[0] as ValidationDetail;
  const msg = typeof first?.msg === 'string' ? first.msg.replace(/^Value error, /, '') : null;
  if (!msg) return null;

  const loc = Array.isArray(first.loc) ? first.loc : [];
  const field = loc.length > 1 ? loc[loc.length - 1] : null;
  return typeof field === 'string' ? `${field}: ${msg}` : msg;
}
