import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { upload, download, saveFile } = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  saveFile: vi.fn(),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { upload, download, get: vi.fn(), post: vi.fn() } };
});
vi.mock('@/lib/save-file', () => ({ saveFile }));

import { ImportExpenses } from '@/components/finance/import-expenses';
import { ApiError } from '@/lib/api-client';
import { EXPENSES_CHANGED } from '@/lib/finance-events';
import type { ImportPreview, ImportRow } from '@/lib/types/finance';

function row(n: number, overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    row: n,
    spent_on: '2026-10-24',
    description: `Row ${n}`,
    category: 'Food',
    new_category: false,
    amount: '18.50',
    currency: 'SGD',
    duplicate: false,
    ...overrides,
  };
}

const PREVIEW: ImportPreview = {
  rows: [
    row(2, { description: 'Lunch' }),
    row(3, { description: 'Vet', category: 'Pets', new_category: true, amount: '80' }),
    row(4, { description: 'Coffee', duplicate: true }),
  ],
  problems: [{ row: 5, column: 'Amount', message: '“abc” isn’t an amount. Write it like 12.50.' }],
};

afterEach(() => vi.clearAllMocks());

async function open(onImported = vi.fn()) {
  render(<ImportExpenses onImported={onImported} />);
  fireEvent.click(screen.getByRole('button', { name: 'Import expenses from a spreadsheet' }));
  return screen.findByRole('dialog', { name: 'Import expenses' });
}

function choose(dialog: HTMLElement, file: File) {
  fireEvent.change(within(dialog).getByLabelText('Choose the filled-in file'), {
    target: { files: [file] },
  });
}

const FILE = new File(['Date,Amount'], 'october.csv', { type: 'text/csv' });

describe('ImportExpenses', () => {
  it('says it opens a dialog, and fetches nothing until it does', () => {
    render(<ImportExpenses onImported={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Import expenses from a spreadsheet' })
    ).toHaveAttribute('aria-haspopup', 'dialog');
    expect(upload).not.toHaveBeenCalled();
  });

  it('downloads the template through the API, which knows the categories', async () => {
    const blob = new Blob(['xlsx']);
    download.mockResolvedValue(blob);
    const dialog = await open();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Download template' }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(blob, 'expenses-template.xlsx'));
    expect(download).toHaveBeenCalledWith('/finance/expenses/import/template');
    expect(within(dialog).getByText(/Look for expenses-template\.xlsx/)).toBeInTheDocument();
  });

  it('shows what a file holds before anything is saved', async () => {
    upload.mockResolvedValue(PREVIEW);
    const dialog = await open();

    choose(dialog, FILE);

    const summary = await within(dialog).findByRole('heading', {
      name: '2 expenses ready to import',
    });
    expect(summary).toHaveFocus();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith('/finance/expenses/import/preview', FILE);
    const sample = within(dialog).getByRole('list', { name: 'The first expenses to import' });
    expect(
      within(sample)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual([expect.stringContaining('Lunch'), expect.stringContaining('Pets (new)')]);
    expect(within(dialog).getByText('Creates a new category: Pets.')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: '1 row can’t be imported' })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('list', { name: 'Rows that can’t be imported' })
    ).toHaveTextContent('Row 5 · Amount: “abc” isn’t an amount. Write it like 12.50.');
  });

  it('leaves likely duplicates out unless they are ticked in', async () => {
    upload.mockResolvedValueOnce(PREVIEW).mockResolvedValueOnce({
      imported: 3,
      duplicates_skipped: 0,
      problem_rows_skipped: 1,
      categories_created: ['Pets'],
    });
    const onImported = vi.fn();
    const changed = vi.fn();
    window.addEventListener(EXPENSES_CHANGED, changed);
    const dialog = await open(onImported);
    choose(dialog, FILE);

    fireEvent.click(
      await within(dialog).findByRole('checkbox', {
        name: 'Also import 1 row that looks like an expense you already have',
      })
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import 3 expenses' }));

    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Imported 3 expenses.Left out 1 row with problems.New category: Pets.'
    );
    expect(upload).toHaveBeenLastCalledWith(
      '/finance/expenses/import?include_duplicates=true',
      FILE
    );
    expect(within(dialog).getByRole('button', { name: 'Done' })).toHaveFocus();
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    window.removeEventListener(EXPENSES_CHANGED, changed);
  });

  it('offers no import when nothing in the file can go in', async () => {
    upload.mockResolvedValue({ rows: [], problems: PREVIEW.problems });
    const dialog = await open();

    choose(dialog, FILE);

    expect(
      await within(dialog).findByRole('heading', {
        name: 'Nothing in this file can be imported yet',
      })
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Choose another file' }));
    expect(within(dialog).getByLabelText('Choose the filled-in file')).toHaveFocus();
  });

  it('says why a file could not be read, and stays ready for another', async () => {
    upload.mockRejectedValue(
      new ApiError(422, {
        code: 'IMPORT_FILE_REJECTED',
        message: 'That’s an older .xls file. Save it as .xlsx or CSV, then import that.',
      })
    );
    const dialog = await open();

    choose(dialog, FILE);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('older .xls file');
    expect(within(dialog).getByLabelText('Choose the filled-in file')).toBeInTheDocument();
  });

  it('refuses a file over 5 MB without uploading it', async () => {
    const dialog = await open();

    choose(dialog, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.csv'));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That file is over 5 MB.');
    expect(upload).not.toHaveBeenCalled();
  });
});
