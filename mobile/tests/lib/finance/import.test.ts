import { count, duplicatesLabel, leftOut, listOf, reviewImport } from '@/lib/finance/import';
import type { ImportPreview, ImportRow } from '@/lib/finance/types';

function row(n: number, overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    row: n,
    spent_on: '2026-11-01',
    description: `Row ${n}`,
    category: 'Food',
    new_category: false,
    amount: '10.00',
    currency: 'SGD',
    duplicate: false,
    ...overrides,
  };
}

describe('count and listOf', () => {
  it('words a number of things, and a list of names, as the web does', () => {
    expect(count(1, 'expense')).toBe('1 expense');
    expect(count(1204, 'expense')).toBe('1,204 expenses');
    expect(listOf(['Pets'])).toBe('Pets');
    expect(listOf(['Pets', 'Gifts'])).toBe('Pets and Gifts');
    expect(listOf(['Pets', 'Gifts', 'Travel'])).toBe('Pets, Gifts and Travel');
  });
});

describe('reviewImport', () => {
  const preview: ImportPreview = {
    rows: [
      row(2),
      row(3, { duplicate: true }),
      row(4, { category: 'Pets', new_category: true }),
      row(5, { category: 'Pets', new_category: true }),
    ],
    problems: [
      { row: 6, column: 'Amount', message: 'Not a number' },
      { row: 6, column: 'Date', message: 'Not a date' },
      { row: 7, column: 'Currency', message: 'Unknown currency' },
    ],
  };

  it('leaves the likely duplicates out unless asked, and counts rows with problems once', () => {
    const review = reviewImport(preview, false);
    expect(review.included.map((r) => r.row)).toEqual([2, 4, 5]);
    expect(review.duplicates).toBe(1);
    expect(review.problemRows).toBe(2);
    expect(review.newCategories).toEqual(['Pets']);
    expect(review.summary).toBe('3 expenses ready to import');

    expect(reviewImport(preview, true).included).toHaveLength(4);
  });

  it('says why nothing would be imported', () => {
    expect(reviewImport({ rows: [row(2, { duplicate: true })], problems: [] }, false).summary).toBe(
      'Everything in this file is already recorded'
    );
    expect(reviewImport({ rows: [], problems: preview.problems }, false).summary).toBe(
      'Nothing in this file can be imported yet'
    );
    expect(reviewImport({ rows: [], problems: [] }, false).summary).toBe(
      'There are no expenses in this file'
    );
  });
});

describe('duplicatesLabel and leftOut', () => {
  it('words the duplicates switch for one and for many', () => {
    expect(duplicatesLabel(1)).toBe(
      'Also import 1 row that looks like an expense you already have'
    );
    expect(duplicatesLabel(3)).toBe('Also import 3 rows that look like expenses you already have');
  });

  it('says what an import left out, or nothing when it took everything', () => {
    const result = { imported: 4, duplicates_skipped: 2, problem_rows_skipped: 1 };
    expect(leftOut({ ...result, categories_created: [] })).toBe(
      'Left out 2 duplicates and 1 row with problems.'
    );
    expect(
      leftOut({
        imported: 4,
        duplicates_skipped: 0,
        problem_rows_skipped: 0,
        categories_created: [],
      })
    ).toBeNull();
  });
});
