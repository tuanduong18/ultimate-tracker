import type { ImportPreview, ImportResult, ImportRow } from '@/lib/finance/types';

/**
 * The rules of the spreadsheet import, as the phone's import screen applies them — written
 * inside the web's ImportExpenses component there, and pulled out here so they can be tested on
 * their own. The words are the web's.
 */

/**
 * Mirrors the server's MAX_IMPORT_BYTES. The server still decides; this only saves uploading a
 * file it would refuse.
 */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export const TOO_LARGE =
  'That file is over 5 MB. Split it into smaller files and import them one at a time.';

/** Rows shown before importing: enough to see that dates and amounts were read right. */
export const SAMPLE = 5;

/**
 * What Android's file picker offers: Excel and CSV. CSV goes by several names depending on the
 * app that saved it, so each is listed; anything else the server still refuses in words.
 */
export const IMPORT_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
];

/** What Android is told an .xlsx file is, so the share sheet offers the apps that open one. */
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** "1 expense", "1,204 expenses". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** "Pets", "Pets and Gifts", "Pets, Gifts and Travel". */
export function listOf(names: readonly string[]): string {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What a preview means for the one decision left: whether to keep the likely duplicates. */
export interface ImportReview {
  /** The rows the import would write. */
  included: ImportRow[];
  /** How many rows look already recorded — left out unless the person says otherwise. */
  duplicates: number;
  /** How many rows have at least one problem (a row can have several). */
  problemRows: number;
  /** Categories the included rows would create, each once. */
  newCategories: string[];
  /** The answer to "what happened to my file?", first on the screen. */
  summary: string;
}

/**
 * Read a preview. Duplicates are off by default — re-importing a file is far more common than
 * buying the same thing twice in a day at the same price.
 */
export function reviewImport(preview: ImportPreview, withDuplicates: boolean): ImportReview {
  const included = preview.rows.filter((row) => withDuplicates || !row.duplicate);
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
  return {
    included,
    duplicates: preview.rows.filter((row) => row.duplicate).length,
    problemRows: new Set(preview.problems.map((problem) => problem.row)).size,
    newCategories,
    summary,
  };
}

/** The duplicates switch's words: what turning it on adds. */
export function duplicatesLabel(duplicates: number): string {
  return duplicates === 1
    ? 'Also import 1 row that looks like an expense you already have'
    : `Also import ${count(duplicates, 'row')} that look like expenses you already have`;
}

/** "Left out 2 duplicates and 1 row with problems." — or null when nothing was left out. */
export function leftOut(result: ImportResult): string | null {
  const parts = [
    result.duplicates_skipped > 0 && count(result.duplicates_skipped, 'duplicate'),
    result.problem_rows_skipped > 0 && `${count(result.problem_rows_skipped, 'row')} with problems`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? `Left out ${parts.join(' and ')}.` : null;
}
