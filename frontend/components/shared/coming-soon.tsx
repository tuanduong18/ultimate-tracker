import { ArrowRight, CircleDashed } from 'lucide-react';
import Link from 'next/link';

import { IconBadge } from '@/components/shared/illustrations';
import { PageHeader } from '@/components/shared/page-header';
import type { PlannedModule, ModuleEntry } from '@/components/shared/nav-items';

/**
 * The page for a module that is not built yet.
 *
 * Says when it lands and what it will do — both from the release plan, via
 * MODULES — and points somewhere that works today, so a click on an unbuilt
 * module ends somewhere useful rather than at a blank page.
 */
export function ComingSoon({ module: entry }: { module: ModuleEntry & PlannedModule }) {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader title={entry.label} description={entry.blurb} />

      <section className="mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <IconBadge icon={entry.icon} size="lg" />
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <CircleDashed aria-hidden className="size-3.5" />
              Coming in {entry.release}
            </span>
            <h2 className="mt-3 text-xl font-semibold">{entry.label} is on its way</h2>
            <p className="mt-1 text-sm text-fg-muted">Here is what it will do.</p>
          </div>
        </div>

        <ul className="mt-8 space-y-3">
          {entry.planned.map((item) => (
            <li key={item} className="flex gap-3 text-sm">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>

        <Link
          href="/finance"
          className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90"
        >
          Meanwhile, Finance is ready
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>
    </main>
  );
}
