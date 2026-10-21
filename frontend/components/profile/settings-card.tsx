import type { ReactNode } from 'react';

/** The card both forms are drawn in. */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Save button plus the outcome of the last attempt, shared by both forms. */
export function SaveRow({
  busy,
  dirty,
  saved,
  error,
}: {
  busy: boolean;
  dirty: boolean;
  saved: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={busy || !dirty}
        className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-fg shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      {saved && !dirty && <p className="text-sm text-positive">Saved.</p>}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
