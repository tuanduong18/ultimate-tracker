import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PrimaryButton } from '@/components/button';
import { Card, RowDivider } from '@/components/card';
import { FormError } from '@/components/form-error';
import { Icon } from '@/components/icon';
import { SwitchRow } from '@/components/switch-row';
import { Text } from '@/components/text';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { describeError } from '@/lib/describe-error';
import {
  count,
  duplicatesLabel,
  IMPORT_TYPES,
  leftOut,
  listOf,
  MAX_IMPORT_BYTES,
  reviewImport,
  SAMPLE,
  TOO_LARGE,
  XLSX_TYPE,
} from '@/lib/finance/import';
import { useFinanceWrite } from '@/lib/finance/queries';
import type { ImportPreview, ImportResult, ImportRow } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';
import { shareFile } from '@/lib/share-file';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

interface Chosen {
  name: string;
  bytes: Uint8Array;
}

type Step =
  | { kind: 'choose'; reading: string | null; error: string | null }
  | {
      kind: 'review';
      file: Chosen;
      preview: ImportPreview;
      withDuplicates: boolean;
      error: string | null;
    }
  | { kind: 'done'; result: ImportResult };

const START: Step = { kind: 'choose', reading: null, error: null };

/**
 * Importing expenses from a spreadsheet — the twin of the web's Import dialog on Transactions,
 * with the same flow and the same words: template → choose the file → check → import.
 *
 * The template comes first because a fixed layout is what lets the import ask no questions: no
 * column mapping, no "which of these is the date?". Nothing is saved when the file is chosen:
 * the server reads it and says what it found — the rows ready to go, the ones that can't and
 * why, the ones that look already recorded — and only Import writes, all of it in one go.
 *
 * A full-screen form over the tabs, as adding is: a short task started from a list, with the
 * list waiting behind it. The phone's differences are the phone's parts: the template goes to
 * Android's share sheet (save it to Files or Drive, open it in Sheets) and the file comes from
 * Android's file picker; the duplicates choice is a switch. Outcomes stay on this screen, never
 * in a toast. Back leaves at any step: nothing is saved until Import, and choosing the file
 * again is one tap.
 */
export default function ImportExpenses() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(START);
  // Which file is current: one chosen while another is still being read replaces it, and the
  // older answer must not land on top.
  const latest = useRef(0);
  const importFile = useFinanceWrite(
    ({ file, withDuplicates }: { file: Chosen; withDuplicates: boolean }) =>
      api.upload<ImportResult>(
        `/finance/expenses/import?include_duplicates=${withDuplicates}`,
        file.bytes
      )
  );

  async function choose() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: IMPORT_TYPES,
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const id = ++latest.current;
    if ((asset.size ?? 0) > MAX_IMPORT_BYTES) {
      setStep({ kind: 'choose', reading: null, error: TOO_LARGE });
      return;
    }
    setStep({ kind: 'choose', reading: asset.name, error: null });
    try {
      const bytes = await new File(asset.uri).bytes();
      const preview = await api.upload<ImportPreview>('/finance/expenses/import/preview', bytes);
      if (id !== latest.current) return;
      setStep({
        kind: 'review',
        file: { name: asset.name, bytes },
        preview,
        withDuplicates: false,
        error: null,
      });
    } catch (err) {
      if (id !== latest.current) return;
      setStep({
        kind: 'choose',
        reading: null,
        error: describeError(
          err,
          `Could not read ${asset.name}. Check your connection and try again.`
        ),
      });
    }
  }

  async function confirm(review: Extract<Step, { kind: 'review' }>) {
    setStep({ ...review, error: null });
    try {
      const result = await importFile.mutateAsync({
        file: review.file,
        withDuplicates: review.withDuplicates,
      });
      setStep({ kind: 'done', result });
    } catch (err) {
      setStep({
        ...review,
        error: describeError(err, 'Could not import these expenses. Try again.'),
      });
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Import expenses' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: SPACE.lg,
          paddingBottom: SPACE.xxl + insets.bottom,
          gap: SPACE.xl,
        }}
      >
        {step.kind === 'choose' && (
          <ChooseFile reading={step.reading} error={step.error} onChoose={() => void choose()} />
        )}
        {step.kind === 'review' && (
          <Review
            step={step}
            busy={importFile.isPending}
            onToggleDuplicates={(withDuplicates) => setStep({ ...step, withDuplicates })}
            onConfirm={() => void confirm(step)}
            onAnother={() => void choose()}
          />
        )}
        {step.kind === 'done' && (
          <Done
            result={step.result}
            onDone={() => router.back()}
            onAnother={() => setStep(START)}
          />
        )}
      </ScrollView>
    </>
  );
}

/** A numbered step: the number in a quiet circle, then its content — the web's two steps. */
function Numbered({ n, children }: { n: number; children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: SPACE.md }}>
      <View
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 28,
          height: 28,
          borderRadius: RADIUS.pill,
          backgroundColor: colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="label" tone="fgMuted">
          {n}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: SPACE.sm }}>{children}</View>
    </View>
  );
}

/**
 * Step one and two on one screen: get the template, then choose the filled-in file. The status
 * line under the button says what is happening while the file is read.
 */
function ChooseFile({
  reading,
  error,
  onChoose,
}: {
  reading: string | null;
  error: string | null;
  onChoose: () => void;
}) {
  const [template, setTemplate] = useState<
    { kind: 'idle' | 'busy' } | { kind: 'failed'; message: string }
  >({ kind: 'idle' });

  async function getTemplate() {
    setTemplate({ kind: 'busy' });
    try {
      const bytes = await api.download('/finance/expenses/import/template');
      await shareFile(bytes, 'expenses-template.xlsx', XLSX_TYPE);
      setTemplate({ kind: 'idle' });
    } catch (err) {
      setTemplate({
        kind: 'failed',
        message: describeError(err, 'Could not get the template. Try again.'),
      });
    }
  }

  return (
    <>
      <Numbered n={1}>
        <Text variant="bodyStrong" accessibilityRole="header">
          Fill in the template
        </Text>
        <Text tone="fgMuted">
          An Excel sheet with your categories and currencies as drop-downs. A file exported from
          Transactions works too.
        </Text>
        <Button
          label={template.kind === 'busy' ? 'Getting the template…' : 'Get the template'}
          icon="download"
          accessibilityHint="Opens the share sheet, to save it or open it in a spreadsheet app"
          disabled={template.kind === 'busy'}
          onPress={() => void getTemplate()}
        />
        {template.kind === 'failed' && <FormError message={template.message} />}
      </Numbered>

      <Numbered n={2}>
        <Text variant="bodyStrong" accessibilityRole="header">
          Choose the filled-in file
        </Text>
        <Text tone="fgMuted">
          Excel (.xlsx) or CSV. You’ll see what will be imported before anything is saved.
        </Text>
        <PrimaryButton
          label={reading ? 'Reading…' : 'Choose a file'}
          icon="upload_file"
          disabled={reading !== null}
          accessibilityHint="Opens your phone’s file picker"
          onPress={onChoose}
        />
        {reading ? (
          <Text variant="caption" tone="fgMuted" accessibilityLiveRegion="polite">
            Reading {reading}…
          </Text>
        ) : null}
        {error ? <FormError message={error} /> : null}
      </Numbered>
    </>
  );
}

/**
 * "Lunch", category and date, amount — the row as Transactions will show it: a row without a
 * description leads with its category instead. No badge, because a category the import is about
 * to create has no colour yet.
 */
function SampleRow({ row }: { row: ImportRow }) {
  const category = `${row.category ?? 'Uncategorised'}${row.new_category ? ' (new)' : ''}`;
  const money = formatMoney(row.amount, row.currency);
  const detail = row.description
    ? `${category} · ${formatDate(row.spent_on)}`
    : formatDate(row.spent_on);
  return (
    <View
      accessible
      accessibilityLabel={`${row.description || category}, ${money}, ${detail}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1}>{row.description || category}</Text>
        <Text variant="caption" tone="fgMuted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text variant="bodyStrong" style={{ flexShrink: 0, fontVariant: ['tabular-nums'] }}>
        {money}
      </Text>
    </View>
  );
}

/**
 * What the server found, and the one decision left: whether to keep rows that look already
 * recorded. The summary comes first and is announced, as the answer to "what happened to my
 * file?"; the actions follow it in reading order.
 */
function Review({
  step,
  busy,
  onToggleDuplicates,
  onConfirm,
  onAnother,
}: {
  step: Extract<Step, { kind: 'review' }>;
  busy: boolean;
  onToggleDuplicates: (withDuplicates: boolean) => void;
  onConfirm: () => void;
  onAnother: () => void;
}) {
  const { colors } = useAppTheme();
  const { file, preview, withDuplicates, error } = step;
  const { included, duplicates, problemRows, newCategories, summary } = reviewImport(
    preview,
    withDuplicates
  );
  const sample = included.slice(0, SAMPLE);

  return (
    <>
      <View style={{ gap: SPACE.xs }} accessibilityLiveRegion="polite">
        <Text variant="heading" accessibilityRole="header">
          {summary}
        </Text>
        <Text variant="caption" tone="fgMuted" numberOfLines={1}>
          From {file.name}
        </Text>
      </View>

      {preview.rows.length === 0 && preview.problems.length === 0 && (
        <Text tone="fgMuted">Fill in rows under the column names, save, and choose it again.</Text>
      )}

      {sample.length > 0 && (
        <View style={{ gap: SPACE.sm }}>
          <Card>
            {sample.map((row, index) => (
              <View key={row.row}>
                {index > 0 && <RowDivider />}
                <SampleRow row={row} />
              </View>
            ))}
          </Card>
          {included.length > SAMPLE && (
            <Text variant="caption" tone="fgMuted">
              and {(included.length - SAMPLE).toLocaleString()} more
            </Text>
          )}
        </View>
      )}

      {newCategories.length > 0 && (
        <Text>
          {newCategories.length === 1 ? 'Creates a new category' : 'Creates new categories'}:{' '}
          {listOf(newCategories)}.
        </Text>
      )}

      {duplicates > 0 && (
        <Card>
          <SwitchRow
            label={duplicatesLabel(duplicates)}
            description="Same date, amount, currency and description. Left out unless you turn this on."
            value={withDuplicates}
            onChange={onToggleDuplicates}
            disabled={busy}
          />
        </Card>
      )}

      {preview.problems.length > 0 && (
        <View
          style={{
            gap: SPACE.sm,
            padding: SPACE.lg,
            borderRadius: RADIUS.card,
            backgroundColor: colors.negativeSoft,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <Icon name="error" size={20} tone="negative" />
            <Text variant="bodyStrong" tone="negative" accessibilityRole="header">
              {count(problemRows, 'row')} can’t be imported
            </Text>
          </View>
          {preview.problems.map((problem, index) => (
            <Text key={`${problem.row}-${problem.column}-${index}`}>
              <Text style={{ fontWeight: '600' }}>Row {problem.row}</Text> · {problem.column}:{' '}
              {problem.message}
            </Text>
          ))}
          <Text variant="caption">
            {included.length > 0
              ? 'Import the rest now and fix these in the file later: importing it again leaves out what is already in.'
              : 'Fix them in the file and choose it again.'}
          </Text>
        </View>
      )}

      <View style={{ gap: SPACE.md }}>
        {error ? <FormError message={error} /> : null}
        {included.length > 0 && (
          <PrimaryButton
            fullWidth
            label={busy ? 'Importing…' : `Import ${count(included.length, 'expense')}`}
            disabled={busy}
            accessibilityState={{ disabled: busy, busy }}
            onPress={onConfirm}
          />
        )}
        <Button
          fullWidth
          label="Choose another file"
          icon="upload_file"
          disabled={busy}
          onPress={onAnother}
        />
      </View>
    </>
  );
}

/** What was imported and what was left out, in place, with Done as the likely next step. */
function Done({
  result,
  onDone,
  onAnother,
}: {
  result: ImportResult;
  onDone: () => void;
  onAnother: () => void;
}) {
  const skipped = leftOut(result);
  const created = result.categories_created;
  return (
    <>
      <View
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}
      >
        <Icon name="check_circle" tone="positive" />
        <View style={{ flex: 1, gap: SPACE.xs }}>
          <Text variant="bodyStrong" accessibilityRole="header">
            Imported {count(result.imported, 'expense')}.
          </Text>
          {skipped ? <Text tone="fgMuted">{skipped}</Text> : null}
          {created.length > 0 ? (
            <Text tone="fgMuted">
              {created.length === 1 ? 'New category' : 'New categories'}: {listOf(created)}.
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ gap: SPACE.md }}>
        <PrimaryButton fullWidth label="Done" onPress={onDone} />
        <Button fullWidth label="Import another file" onPress={onAnother} />
      </View>
    </>
  );
}
