'use client';

import { CircleCheck, Download, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { PanelButton } from '@/components/finance/panel';
import { SheetDialog, SheetHeader } from '@/components/shared/sheet-dialog';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { announceExpensesChange } from '@/lib/finance-events';
import { describeError } from '@/lib/hooks/use-collection';
import { saveFile } from '@/lib/save-file';
import {
  formatMoney,
  type ImportPreview,
  type ImportResult,
  type ImportRow,
} from '@/lib/types/finance';

/**
 * Mirrors the server's MAX_IMPORT_BYTES. The server still decides; this only
 * saves uploading a file it would refuse.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const TOO_LARGE =
  'That file is over 5 MB. Split it into smaller files and import them one at a time.';

/** Rows shown before importing: enough to see that dates and amounts were read right. */
const SAMPLE = 5;

const ACCEPT =
  '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Step =
  | { kind: 'choose'; reading: string | null; error: string | null }
  | {
      kind: 'review';
      file: File;
      preview: ImportPreview;
      withDuplicates: boolean;
      busy: boolean;
      error: string | null;
    }
  | { kind: 'done'; result: ImportResult };

const START: Step = { kind: 'choose', reading: null, error: null };

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** "Pets", "Pets and Gifts", "Pets, Gifts and Travel". */
function listOf(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

const primary =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50';
const secondary =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted disabled:opacity-50';

/**
 * Import beside Export on the Transactions tab, and the dialog it opens.
 *
 * The flow is template → upload → check → import. The template comes first
 * because a fixed layout is what lets the import ask no questions: no column
 * mapping, no "which of these is the date?". Bank statements get pasted into
 * it; an exported file already has its shape.
 *
 * Nothing is saved on upload. The server reads the file and says what it
 * found — the rows ready to go, the ones that can't and why, the ones that
 * look already recorded — and only the confirm button writes, all of it in
 * one go. Rows with problems are left out rather than holding everything up:
 * the person sees exactly which, by spreadsheet row number, and re-uploading
 * the fixed file later skips the rows already in as duplicates.
 *
 * A dialog rather than a page: it is a short task started from a list, and
 * the list it adds to stays behind it. Outcomes are shown inside it, never in
 * a toast.
 */
export function ImportExpenses({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <PanelButton
        opensDialog
        label="Import expenses from a spreadsheet"
        title="Import expenses from a spreadsheet"
        onClick={() => setOpen(true)}
      >
        <span className="inline-flex items-center gap-1.5">
          <Upload aria-hidden className="size-3.5" />
          Import
        </span>
      </PanelButton>
      <SheetDialog open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <ImportBody titleId={titleId} onDone={() => setOpen(false)} onImported={onImported} />
      </SheetDialog>
    </>
  );
}

function ImportBody({
  titleId,
  onDone,
  onImported,
}: {
  titleId: string;
  onDone: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>(START);
  // Which upload is current: a file chosen while another is still being read
  // replaces it, and the older answer must not land on top.
  const latest = useRef(0);

  async function read(file: File) {
    const id = ++latest.current;
    if (file.size > MAX_BYTES) {
      setStep({ kind: 'choose', reading: null, error: TOO_LARGE });
      return;
    }
    setStep({ kind: 'choose', reading: file.name, error: null });
    try {
      const preview = await api.upload<ImportPreview>('/finance/expenses/import/preview', file);
      if (id !== latest.current) return;
      setStep({ kind: 'review', file, preview, withDuplicates: false, busy: false, error: null });
    } catch (err: unknown) {
      if (id !== latest.current) return;
      setStep({
        kind: 'choose',
        reading: null,
        error: describeError(
          err,
          `Could not read ${file.name}. Check your connection and try again.`
        ),
      });
    }
  }

  async function confirm(review: Extract<Step, { kind: 'review' }>) {
    setStep({ ...review, busy: true, error: null });
    try {
      const result = await api.upload<ImportResult>(
        `/finance/expenses/import?include_duplicates=${review.withDuplicates}`,
        review.file
      );
      announceExpensesChange();
      onImported();
      setStep({ kind: 'done', result });
    } catch (err: unknown) {
      setStep({
        ...review,
        busy: false,
        error: describeError(err, 'Could not import these expenses. Try again.'),
      });
    }
  }

  return (
    <>
      <SheetHeader titleId={titleId} title="Import expenses" onClose={onDone} />
      {step.kind === 'choose' && (
        <ChooseFile reading={step.reading} error={step.error} onFile={(file) => void read(file)} />
      )}
      {step.kind === 'review' && (
        <Review
          step={step}
          onToggleDuplicates={(withDuplicates) => setStep({ ...step, withDuplicates })}
          onConfirm={() => void confirm(step)}
          onAnother={() => setStep(START)}
        />
      )}
      {step.kind === 'done' && (
        <Done result={step.result} onDone={onDone} onAnother={() => setStep(START)} />
      )}
    </>
  );
}

/** A numbered step: the number in a quiet circle, then its content. */
function Numbered({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </li>
  );
}

/**
 * Step one and two on one screen: get the template, then choose the file.
 *
 * The file input stays mounted (and enabled) while the file is read, so focus
 * stays where it was; the status line under it says what is happening.
 */
function ChooseFile({
  reading,
  error,
  onFile,
}: {
  reading: string | null;
  error: string | null;
  onFile: (file: File) => void;
}) {
  const inputId = useId();
  const [template, setTemplate] = useState<
    { kind: 'idle' | 'busy' | 'done' } | { kind: 'failed'; message: string }
  >({ kind: 'idle' });

  async function downloadTemplate() {
    setTemplate({ kind: 'busy' });
    try {
      saveFile(await api.download('/finance/expenses/import/template'), 'expenses-template.xlsx');
      setTemplate({ kind: 'done' });
    } catch (err: unknown) {
      setTemplate({
        kind: 'failed',
        message: describeError(err, 'Could not download the template. Try again.'),
      });
    }
  }

  return (
    <ol className="space-y-6 p-5">
      <Numbered n={1}>
        <p className="text-sm font-medium">Fill in the template</p>
        <p className="text-sm text-fg-muted">
          An Excel sheet with your categories and currencies as drop-downs. A file exported from
          this tab works too.
        </p>
        <button
          type="button"
          className={secondary}
          disabled={template.kind === 'busy'}
          onClick={() => void downloadTemplate()}
        >
          <Download aria-hidden className="size-4" />
          {template.kind === 'busy' ? 'Downloading…' : 'Download template'}
        </button>
        <p role="status" className="text-xs text-fg-muted empty:hidden">
          {template.kind === 'done' ? 'Downloaded. Look for expenses-template.xlsx.' : ''}
        </p>
        {template.kind === 'failed' && (
          <p role="alert" className="text-xs text-negative">
            {template.message}
          </p>
        )}
      </Numbered>

      <Numbered n={2}>
        <label htmlFor={inputId} className="block text-sm font-medium">
          Choose the filled-in file
        </label>
        <p id={`${inputId}-hint`} className="text-sm text-fg-muted">
          Excel (.xlsx) or CSV. You’ll see what will be imported before anything is saved.
        </p>
        <input
          // Coming back from "Choose another file" removed the button that had
          // focus; this is where it belongs. On first open the dialog isn't
          // showing yet, so the browser's own dialog focus wins.
          autoFocus
          id={inputId}
          type="file"
          accept={ACCEPT}
          aria-describedby={`${inputId}-hint`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file again — fixed and re-saved
            // under its old name — still counts as a change.
            event.target.value = '';
            if (file) onFile(file);
          }}
          className="block w-full text-sm text-fg-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:bg-surface file:px-4 file:text-sm file:font-medium file:text-fg hover:file:bg-primary-soft"
        />
        <p role="status" className="text-xs text-fg-muted empty:hidden">
          {reading ? `Reading ${reading}…` : ''}
        </p>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
      </Numbered>
    </ol>
  );
}

/** "Lunch", category and date, amount — the row as the expense list will show it. */
function SampleRow({ row }: { row: ImportRow }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {row.description || <span className="text-fg-muted">No description</span>}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
          <span className="truncate">
            {row.category ?? 'Uncategorised'}
            {row.new_category && ' (new)'}
          </span>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">{formatDate(row.spent_on)}</span>
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium whitespace-nowrap tabular-nums">
        {formatMoney(row.amount, row.currency)}
      </span>
    </li>
  );
}

/**
 * What the server found, and the one decision left: whether to keep rows that
 * look already recorded. Off by default — re-importing a file is far more
 * common than buying the same thing twice in a day at the same price.
 *
 * Focus lands on the summary line, which is the answer to "what happened to
 * my file?"; the actions follow it in reading order.
 */
function Review({
  step,
  onToggleDuplicates,
  onConfirm,
  onAnother,
}: {
  step: Extract<Step, { kind: 'review' }>;
  onToggleDuplicates: (withDuplicates: boolean) => void;
  onConfirm: () => void;
  onAnother: () => void;
}) {
  const { file, preview, withDuplicates, busy, error } = step;
  const ids = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  // Once, as the review appears: the input that had focus has just gone.
  // An effect rather than autoFocus, which React honours on form controls only.
  useEffect(() => heading.current?.focus(), []);
  const included = preview.rows.filter((row) => withDuplicates || !row.duplicate);
  const duplicates = preview.rows.filter((row) => row.duplicate).length;
  const problemRows = new Set(preview.problems.map((problem) => problem.row)).size;
  const newCategories = [
    ...new Set(included.filter((row) => row.new_category).map((row) => row.category ?? '')),
  ];

  const summary =
    included.length > 0
      ? `${count(included.length, 'expense')} ready to import`
      : preview.rows.length > 0
        ? 'Everything in this file is already recorded'
        : preview.problems.length > 0
          ? 'Nothing in this file can be imported yet'
          : 'There are no expenses in this file';

  return (
    <div className="space-y-4 p-5">
      <div>
        <h3 ref={heading} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
          {summary}
        </h3>
        <p className="truncate text-xs text-fg-muted">From {file.name}</p>
      </div>

      {preview.rows.length === 0 && preview.problems.length === 0 && (
        <p className="text-sm text-fg-muted">
          Fill in rows under the column names, save, and upload it again.
        </p>
      )}

      {included.length > 0 && (
        <div className="space-y-1.5">
          <ul aria-label="The first expenses to import" className="space-y-1.5">
            {included.slice(0, SAMPLE).map((row) => (
              <SampleRow key={row.row} row={row} />
            ))}
          </ul>
          {included.length > SAMPLE && (
            <p className="text-xs text-fg-muted">
              and {(included.length - SAMPLE).toLocaleString()} more
            </p>
          )}
        </div>
      )}

      {newCategories.length > 0 && (
        <p className="text-sm">
          {newCategories.length === 1 ? 'Creates a new category' : 'Creates new categories'}:{' '}
          {listOf(newCategories)}.
        </p>
      )}

      {duplicates > 0 && (
        <div className="rounded-lg border border-border p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={withDuplicates}
              aria-describedby={`${ids}-duplicates`}
              onChange={(event) => onToggleDuplicates(event.target.checked)}
            />
            <span>
              {duplicates === 1
                ? 'Also import 1 row that looks like an expense you already have'
                : `Also import ${count(duplicates, 'row')} that look like expenses you already have`}
            </span>
          </label>
          <p id={`${ids}-duplicates`} className="mt-1 pl-6 text-xs text-fg-muted">
            Same date, amount, currency and description. Left out unless you tick this.
          </p>
        </div>
      )}

      {preview.problems.length > 0 && (
        <section
          aria-labelledby={`${ids}-problems`}
          className="rounded-lg border border-negative/30 bg-negative-soft p-3"
        >
          <h4 id={`${ids}-problems`} className="text-sm font-semibold text-negative">
            {count(problemRows, 'row')} can’t be imported
          </h4>
          <ul
            // Scrolls when long, so it is focusable to scroll by keyboard.
            tabIndex={0}
            aria-label="Rows that can’t be imported"
            className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm"
          >
            {preview.problems.map((problem, index) => (
              <li key={`${problem.row}-${problem.column}-${index}`}>
                <span className="font-medium">Row {problem.row}</span>
                <span aria-hidden> · </span>
                {problem.column}: {problem.message}
              </li>
            ))}
          </ul>
          {/* text-fg: fg-muted is 4.40:1 on negative-soft in light mode. */}
          <p className="mt-2 text-xs text-fg">
            {included.length > 0
              ? 'Import the rest now and fix these in the file later: uploading it again leaves out what is already in.'
              : 'Fix them in the file and upload it again.'}
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {included.length > 0 && (
          <button type="button" className={primary} disabled={busy} onClick={onConfirm}>
            {busy ? 'Importing…' : `Import ${count(included.length, 'expense')}`}
          </button>
        )}
        <button type="button" className={secondary} disabled={busy} onClick={onAnother}>
          Choose another file
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

/** What was imported and what was left out, in place, with the likely next step focused. */
function Done({
  result,
  onDone,
  onAnother,
}: {
  result: ImportResult;
  onDone: () => void;
  onAnother: () => void;
}) {
  const skipped = [
    result.duplicates_skipped > 0 && count(result.duplicates_skipped, 'duplicate'),
    result.problem_rows_skipped > 0 && `${count(result.problem_rows_skipped, 'row')} with problems`,
  ].filter((part): part is string => Boolean(part));
  const created = result.categories_created;

  return (
    <div className="space-y-5 p-5">
      <p role="status" className="flex items-start gap-3 text-sm">
        <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-positive" />
        <span>
          <span className="font-medium">Imported {count(result.imported, 'expense')}.</span>
          {skipped.length > 0 && (
            <span className="block text-fg-muted">Left out {skipped.join(' and ')}.</span>
          )}
          {created.length > 0 && (
            <span className="block text-fg-muted">
              {created.length === 1 ? 'New category' : 'New categories'}: {listOf(created)}.
            </span>
          )}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" autoFocus className={primary} onClick={onDone}>
          Done
        </button>
        <button type="button" className={secondary} onClick={onAnother}>
          Import another file
        </button>
      </div>
    </div>
  );
}
