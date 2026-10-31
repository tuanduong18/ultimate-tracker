import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, post, patch, delete: del } };
});

import { SubscriptionSection } from '@/components/finance/subscription-section';
import { formatDate } from '@/lib/dates';
import { EXPENSES_CHANGED } from '@/lib/finance-events';
import { useCollection } from '@/lib/hooks/use-collection';
import { formatMoney, type Category, type Subscription } from '@/lib/types/finance';

const FOOD: Category = {
  id: 'c1',
  name: 'Food',
  colour: '#22c55e',
  created_at: '2026-08-01T00:00:00Z',
};

/** Upper case on purpose: the preselection must not care. */
const SUBSCRIPTIONS: Category = {
  id: 'c2',
  name: 'SUBSCRIPTIONS',
  colour: '#f59e0b',
  created_at: '2026-08-01T00:00:00Z',
};

const STREAMING: Subscription = {
  id: 's1',
  name: 'Streaming',
  amount: '12.990',
  currency: 'USD',
  interval_unit: 'month',
  interval_count: 3,
  category_id: SUBSCRIPTIONS.id,
  started_on: '2099-01-31',
  trial_ends_on: null,
  next_billing_on: '2099-01-31',
  cancelled_on: null,
  note: null,
  created_at: '2026-08-01T00:00:00Z',
};

function Harness({ categories = [FOOD, SUBSCRIPTIONS] }: { categories?: Category[] }) {
  const subscriptions = useCollection<Subscription>('/finance/subscriptions');
  return (
    <SubscriptionSection
      subscriptions={subscriptions}
      categories={categories}
      currencies={['USD']}
      defaultCurrency="USD"
      onChange={() => {}}
    />
  );
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('SubscriptionSection', () => {
  it('shows what a subscription costs, how often, and where it lands', async () => {
    get.mockResolvedValue([STREAMING]);
    render(<Harness />);

    expect(await screen.findByText('Streaming')).toBeInTheDocument();
    expect(screen.getByText(/3 months/)).toBeInTheDocument();
    expect(screen.getByText(/SUBSCRIPTIONS/)).toBeInTheDocument();
  });

  it('marks each card with the first letter or digit of its name', async () => {
    get.mockResolvedValue([
      { ...STREAMING, id: 'a', name: 'iCloud+ 200GB' },
      { ...STREAMING, id: 'b', name: '(Old) plan' },
      { ...STREAMING, id: 'c', name: '1Password' },
    ]);
    render(<Harness />);

    expect(await screen.findByText('iCloud+ 200GB')).toBeInTheDocument();
    // Skips leading punctuation; a digit counts, as it does on an app icon.
    for (const initial of ['I', 'O', '1']) {
      expect(screen.getByText(initial, { selector: 'span[aria-hidden]' })).toBeInTheDocument();
    }
  });

  it('counts down inside the three-day reminder window', async () => {
    // Only Date is faked, so the findBy polling below still runs on real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    get.mockResolvedValue([{ ...STREAMING, next_billing_on: '2026-10-17' }]);
    render(<Harness />);

    expect(await screen.findByText('Renews in 2 days')).toBeInTheDocument();
  });

  it('marks a subscription whose cancellation date has passed', async () => {
    get.mockResolvedValue([{ ...STREAMING, cancelled_on: '2026-01-01', started_on: '2025-01-01' }]);
    render(<Harness />);

    expect(await screen.findByText(/Cancelled/)).toBeInTheDocument();
  });

  it('renews early once confirmed, saying what it logs', async () => {
    const music: Subscription = {
      ...STREAMING,
      id: 's2',
      name: 'Music',
      next_billing_on: '2099-02-15',
    };
    const renewed = { ...STREAMING, next_billing_on: '2099-04-30' };
    // Renewing moves Streaming's next charge past Music's, so the list re-sorts.
    get.mockResolvedValueOnce([STREAMING, music]).mockResolvedValueOnce([music, renewed]);
    post.mockResolvedValue(renewed);
    const expensesChanged = vi.fn();
    window.addEventListener(EXPENSES_CHANGED, expensesChanged);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Renew Streaming now' }));
    const money = formatMoney('12.990', 'USD');
    expect(screen.getByRole('group', { name: 'Confirm renewal' })).toHaveTextContent(
      `Renew now? Logs ${money} today for the ${formatDate('2099-01-31')} charge.`
    );
    // The way back has focus, so a stray Enter does not log money.
    expect(screen.getByRole('button', { name: 'Not now' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, renew' }));

    await waitFor(() =>
      expect(screen.getByText(`Renewed — ${money} logged today.`)).toBeInTheDocument()
    );
    expect(post).toHaveBeenCalledWith('/finance/subscriptions/s1/renew', {});
    expect(expensesChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`Renews ${formatDate('2099-04-30')}`)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Renew Streaming now' })).toHaveFocus()
    );
    window.removeEventListener(EXPENSES_CHANGED, expensesChanged);
  });

  it('backs out of a renewal without logging anything', async () => {
    get.mockResolvedValue([STREAMING]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Renew Streaming now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.getByRole('button', { name: 'Renew Streaming now' })).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it('offers no renewal for a charge its cancellation stops', async () => {
    get.mockResolvedValue([{ ...STREAMING, cancelled_on: STREAMING.next_billing_on }]);
    render(<Harness />);

    expect(await screen.findByText('Streaming')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew Streaming now' })).not.toBeInTheDocument();
  });

  it('preselects the Subscriptions category whatever its case', async () => {
    get.mockResolvedValue([]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New subscription' }));
    expect(screen.getByLabelText('Category')).toHaveValue(SUBSCRIPTIONS.id);
  });

  it('starts uncategorised when there is no Subscriptions category', async () => {
    get.mockResolvedValue([]);
    render(<Harness categories={[FOOD]} />);

    fireEvent.click(await screen.findByRole('button', { name: 'New subscription' }));
    expect(screen.getByLabelText('Category')).toHaveValue('');
  });

  it('sends uncategorised and no trial as explicit nulls', async () => {
    get.mockResolvedValueOnce([]).mockResolvedValueOnce([STREAMING]);
    post.mockResolvedValue(STREAMING);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New subscription' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Streaming' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.99' } });
    fireEvent.change(screen.getByLabelText('Every'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/finance/subscriptions',
        expect.objectContaining({
          name: 'Streaming',
          amount: '12.99',
          interval_unit: 'month',
          interval_count: 3,
          category_id: null,
          trial_ends_on: null,
        })
      )
    );
  });

  it('catches a trial that ends before the subscription starts', async () => {
    get.mockResolvedValue([]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New subscription' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Streaming' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.99' } });
    fireEvent.change(screen.getByLabelText('Started'), { target: { value: '2026-10-15' } });
    fireEvent.change(screen.getByLabelText('Free trial ends'), {
      target: { value: '2026-10-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/trial must end after/i);
    expect(post).not.toHaveBeenCalled();
  });
});
