import { useState, type ReactNode } from 'react';

import { ArrangeList } from '@/components/arrange-list';
import { FormScreen, useLeaveGuard } from '@/components/form-screen';
import { Text } from '@/components/text';
import { api } from '@/lib/api-client';
import { inDraftOrder, moved, orderChanged } from '@/lib/arrange';
import { describeError } from '@/lib/describe-error';
import { useFinanceWrite } from '@/lib/finance/queries';

/**
 * Putting categories or budgets in the person's own order: the drag list, then Save order —
 * the phone's twin of the web's Arrange mode, saved in one request (`PUT …/order`) and kept on
 * every device. A draft until saved: leaving with an unsaved order asks first, and Save order
 * with nothing moved just closes, since there is nothing to send.
 *
 * The draft is kept as ids over the live list, so a row added or deleted from another device
 * while this is open lands where the server would put it (first) or drops out, as on the web.
 */
export function ArrangeScreen<T extends { id: string }>({
  title,
  items,
  path,
  nameOf,
  renderRow,
  hint,
}: {
  title: string;
  /** The rows in their stored order. */
  items: readonly T[];
  /** Where the order is saved: "/finance/categories/order". */
  path: string;
  nameOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  hint?: string;
}) {
  const [draft, setDraft] = useState<string[]>(() => items.map((item) => item.id));
  const [error, setError] = useState<string | null>(null);
  const ordered = inDraftOrder(items, draft);
  const changed = orderChanged(ordered, items);
  const leave = useLeaveGuard(changed);
  const save = useFinanceWrite((ids: string[]) => api.put<void>(path, { ids }));

  async function submit() {
    if (!changed) {
      leave();
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(ordered.map((item) => item.id));
      leave();
    } catch (err) {
      setError(describeError(err, 'Could not save that order.'));
    }
  }

  return (
    <FormScreen
      title={title}
      submitLabel="Save order"
      busy={save.isPending}
      error={error}
      onSubmit={submit}
    >
      <Text tone="fgMuted">
        {hint ??
          'Drag the handles or use the arrows, then Save order — it’s kept on all your devices.'}
      </Text>
      <ArrangeList
        items={ordered}
        nameOf={nameOf}
        renderRow={renderRow}
        onMove={(from, to) =>
          setDraft(
            moved(
              ordered.map((item) => item.id),
              from,
              to
            )
          )
        }
      />
    </FormScreen>
  );
}
