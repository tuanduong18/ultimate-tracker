import { FinanceTabs } from '@/components/finance/finance-tabs';
import { QuickAddExpense } from '@/components/finance/quick-add-expense';
import { PageHeader } from '@/components/shared/page-header';

/**
 * The frame every Finance tab shares: one heading, Add expense beside it, and
 * the tab row — so moving between tabs changes only the content underneath,
 * and logging a purchase is one tap from any of them.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader
        title="Finance"
        description="Track what you spend against what you planned."
        actions={<QuickAddExpense />}
      />
      <FinanceTabs />
      <div className="mt-6">{children}</div>
    </main>
  );
}
