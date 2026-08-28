/**
 * Personal budgeting.
 *
 * Categories are wired to /finance/categories. Budgets, expenses and the
 * summary tiles are still placeholders — the sections mirror the API's
 * resources so each can be filled in without a re-layout.
 */

import { CategorySection } from '@/components/finance/category-section';

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{title}</h2>
        <button type="button" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
          {action}
        </button>
      </div>
      <div className="mt-3 rounded-lg border border-gray-200">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-center text-sm text-gray-500">{children}</p>;
}

export default function FinancePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Finance</h1>
      <p className="mt-2 text-sm text-gray-500">Track what you spend against what you planned.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Spent this month" value="—" hint="Across all categories" />
        <SummaryTile label="Budgeted" value="—" hint="Active budgets only" />
        <SummaryTile label="Remaining" value="—" hint="Budgeted minus spent" />
      </div>

      <Section title="Budgets" action="New budget">
        <EmptyState>
          No budgets yet. A budget caps spending across one or more categories.
        </EmptyState>
      </Section>

      <Section title="Recent expenses" action="Add expense">
        <EmptyState>Nothing logged yet.</EmptyState>
      </Section>

      <CategorySection />
    </main>
  );
}
