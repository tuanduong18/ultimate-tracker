import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Ultimate Tracker</h1>
      <p className="max-w-md text-center text-fg-muted">
        One place for your finances, fitness, steps, time, and wellness — then the insights that
        connect them.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
