import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { useEffect } from 'react';

import { ApiError } from '@/lib/api-error';
import { QueryProvider, shouldRetry } from '@/lib/query';

const mockUseSession = jest.fn();
jest.mock('@/auth/session', () => ({ useSession: () => mockUseSession() }));

/** Hands the provider's client to the test, after render, as React's rules want. */
function Capture({ onClient }: { onClient: (client: QueryClient) => void }) {
  const client = useQueryClient();
  useEffect(() => onClient(client), [client, onClient]);
  return null;
}

describe('shouldRetry', () => {
  it('asks again after a dropped connection or a server still waking, up to three times', () => {
    expect(shouldRetry(0, new TypeError('Network request failed'))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, { code: 'X', message: 'asleep' }))).toBe(true);
    expect(shouldRetry(3, new TypeError('Network request failed'))).toBe(false);
  });

  it('never repeats a refusal, which would only delay its explanation', () => {
    expect(shouldRetry(0, new ApiError(422, { code: 'VALIDATION_ERROR', message: 'no' }))).toBe(
      false
    );
    expect(shouldRetry(0, new ApiError(404, { code: 'NOT_FOUND', message: 'gone' }))).toBe(false);
  });
});

describe('QueryProvider', () => {
  it('forgets everything one account loaded when it signs out', async () => {
    let client: QueryClient | undefined;
    const keep = (found: QueryClient) => {
      client = found;
    };

    mockUseSession.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    const screen = await render(
      <QueryProvider>
        <Capture onClient={keep} />
      </QueryProvider>
    );
    client?.setQueryData(['finance', 'expenses'], [{ id: 'e1' }]);

    mockUseSession.mockReturnValue({ session: null, loading: false });
    await screen.rerender(
      <QueryProvider>
        <Capture onClient={keep} />
      </QueryProvider>
    );

    expect(client?.getQueryData(['finance', 'expenses'])).toBeUndefined();
  });
});
