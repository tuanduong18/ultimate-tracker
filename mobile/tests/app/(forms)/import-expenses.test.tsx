import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ImportExpenses from '@/app/(forms)/import-expenses';
import { ApiError } from '@/lib/api-error';
import { api, resetApi, serve } from '../../support/api';
import { renderScreen } from '../../support/app';
import { resetRouter, router } from '../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const mockPick = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: () => mockPick() }));

const mockBytes = new Uint8Array([1, 2, 3]);
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ bytes: async () => mockBytes })),
}));

const mockShare = jest.fn(async (_bytes: Uint8Array, _name: string, _type: string) => undefined);
jest.mock('@/lib/share-file', () => ({
  shareFile: (bytes: Uint8Array, name: string, type: string) => mockShare(bytes, name, type),
}));

function picked(name = 'november.xlsx', size = 2048) {
  return { canceled: false, assets: [{ name, size, uri: `file:///cache/${name}` }] };
}

function row(n: number, overrides: object = {}) {
  return {
    row: n,
    spent_on: '2026-11-01',
    description: `Lunch ${n}`,
    category: 'Food',
    new_category: false,
    amount: '12.50',
    currency: 'SGD',
    duplicate: false,
    ...overrides,
  };
}

const PREVIEW = {
  rows: [row(2), row(3, { category: 'Pets', new_category: true }), row(4, { duplicate: true })],
  problems: [{ row: 5, column: 'Amount', message: 'Not a number' }],
};

beforeEach(() => {
  resetApi();
  resetRouter();
  mockPick.mockReset().mockResolvedValue(picked());
  mockShare.mockClear();
  serve({
    '/finance/expenses/import/preview': PREVIEW,
    '/finance/expenses/import': {
      imported: 2,
      duplicates_skipped: 1,
      problem_rows_skipped: 1,
      categories_created: ['Pets'],
    },
  });
});

describe('ImportExpenses', () => {
  it('hands the template to the share sheet', async () => {
    await renderScreen(<ImportExpenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Get the template' }));

    await waitFor(() =>
      expect(mockShare).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'expenses-template.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    );
    expect(api.download).toHaveBeenCalledWith('/finance/expenses/import/template');
  });

  it('shows what the file would import before anything is saved', async () => {
    await renderScreen(<ImportExpenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a file' }));

    expect(
      await screen.findByRole('header', { name: '2 expenses ready to import' })
    ).toBeOnTheScreen();
    expect(api.upload).toHaveBeenCalledWith('/finance/expenses/import/preview', mockBytes);
    expect(screen.getByText('From november.xlsx')).toBeOnTheScreen();
    expect(screen.getByText(/^Creates a new category/)).toHaveTextContent(/Pets\.$/);
    expect(screen.getByRole('header', { name: '1 row can’t be imported' })).toBeOnTheScreen();
    expect(
      screen.getByRole('switch', {
        name: 'Also import 1 row that looks like an expense you already have',
      })
    ).not.toBeChecked();
    // Nothing written yet: only the preview was asked for.
    expect(api.upload).toHaveBeenCalledTimes(1);
  });

  it('imports, says what was left out, and Done goes back', async () => {
    await renderScreen(<ImportExpenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a file' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Import 2 expenses' }));

    expect(await screen.findByRole('header', { name: 'Imported 2 expenses.' })).toBeOnTheScreen();
    expect(api.upload).toHaveBeenLastCalledWith(
      '/finance/expenses/import?include_duplicates=false',
      mockBytes
    );
    expect(screen.getByText('Left out 1 duplicate and 1 row with problems.')).toBeOnTheScreen();
    expect(screen.getByText('New category: Pets.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('keeps the likely duplicates when asked', async () => {
    await renderScreen(<ImportExpenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a file' }));
    await fireEvent.press(await screen.findByRole('switch'));
    await fireEvent.press(screen.getByRole('button', { name: 'Import 3 expenses' }));

    await waitFor(() =>
      expect(api.upload).toHaveBeenLastCalledWith(
        '/finance/expenses/import?include_duplicates=true',
        mockBytes
      )
    );
  });

  it('refuses a file over 5 MB without sending it', async () => {
    mockPick.mockResolvedValue(picked('huge.xlsx', 6 * 1024 * 1024));
    await renderScreen(<ImportExpenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a file' }));

    expect(await screen.findByText(/^That file is over 5 MB\./)).toBeOnTheScreen();
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is closed without a file', async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    await renderScreen(<ImportExpenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a file' }));

    expect(api.upload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeOnTheScreen();
  });

  it('shows the server’s reason when it can’t read the file', async () => {
    api.upload.mockRejectedValueOnce(
      new ApiError(422, {
        code: 'IMPORT_FILE_REJECTED',
        message: 'That file isn’t a spreadsheet we can read.',
      })
    );
    await renderScreen(<ImportExpenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a file' }));

    expect(await screen.findByText('That file isn’t a spreadsheet we can read.')).toBeOnTheScreen();
  });
});
