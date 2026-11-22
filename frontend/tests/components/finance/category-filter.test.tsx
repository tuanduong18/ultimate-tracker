/** The chart category filter, and the query string a selection becomes. */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ALL_CATEGORIES,
  CategoryFilter,
  hiddenBy,
  isEmptySelection,
  listNames,
  savedSelection,
  selectionQuery,
  type CategorySelection,
} from '@/components/finance/category-filter';
import { FOOD, RENT } from '@/tests/support/finance';

describe('CategoryFilter', () => {
  function renderFilter(selection: CategorySelection = ALL_CATEGORIES) {
    const onChange = vi.fn();
    render(
      <CategoryFilter
        categories={[FOOD, RENT]}
        selection={selection}
        onChange={onChange}
        idPrefix="test"
      />
    );
    return onChange;
  }

  it('starts with everything included and says so', () => {
    renderFilter();

    expect(screen.getByRole('button', { name: 'All categories' })).toBeInTheDocument();
  });

  it('counts what is hidden, so a filtered chart never looks unfiltered', () => {
    renderFilter({ ids: ['c1'], uncategorized: false });

    // Rent and the uncategorised bucket are both out.
    expect(screen.getByRole('button', { name: /2 hidden/ })).toBeInTheDocument();
  });

  it('pins the full list when only the uncategorised bucket is unticked', () => {
    const onChange = renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'All categories' }));
    fireEvent.click(screen.getByLabelText('Uncategorised'));

    // Left as null, "everything" would include the bucket again on the next
    // render and the tick would not stick.
    expect(onChange).toHaveBeenCalledWith({ ids: ['c1', 'c2'], uncategorized: false });
  });

  it('drops a category when its box is unticked', () => {
    const onChange = renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'All categories' }));
    fireEvent.click(screen.getByLabelText('Rent'));

    expect(onChange).toHaveBeenCalledWith({ ids: ['c1'], uncategorized: true });
  });
});

describe('selectionQuery', () => {
  it('sends nothing at all while everything is included', () => {
    // The API's own default is everything, and a category created since this
    // chart opened should still appear.
    expect(selectionQuery(ALL_CATEGORIES)).toBe('');
  });

  it('names each chosen category', () => {
    expect(selectionQuery({ ids: ['c1', 'c2'], uncategorized: true })).toBe(
      '&category_ids=c1&category_ids=c2'
    );
  });

  it('switches off the bucket that has no id to name it by', () => {
    expect(selectionQuery({ ids: null, uncategorized: false })).toBe(
      '&include_uncategorized=false'
    );
  });

  it('recognises a selection of nothing', () => {
    expect(isEmptySelection({ ids: [], uncategorized: false })).toBe(true);
    expect(isEmptySelection(ALL_CATEGORIES)).toBe(false);
    expect(isEmptySelection({ ids: [], uncategorized: true })).toBe(false);
  });
});

describe('CategoryFilter on a chart, with a saved list', () => {
  function renderChartFilter(selection: CategorySelection, hidden: string[] = []) {
    const defaults = { hidden, onReset: vi.fn(), onSave: vi.fn().mockResolvedValue(undefined) };
    render(
      <CategoryFilter
        categories={[FOOD, RENT]}
        selection={selection}
        onChange={vi.fn()}
        idPrefix="test"
        defaults={defaults}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /categor/i }));
    return defaults;
  }

  it('says the charts start with every category, and offers no save until a box changes', () => {
    renderChartFilter(ALL_CATEGORIES);

    expect(screen.getByRole('status')).toHaveTextContent('Charts start with every category.');
    expect(screen.queryByRole('button', { name: 'Save as default' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });

  it('saves what the ticks leave out as the list every chart starts without', async () => {
    const defaults = renderChartFilter({ ids: ['c1'], uncategorized: true });

    fireEvent.click(screen.getByRole('button', { name: 'Save as default' }));

    expect(defaults.onSave).toHaveBeenCalledWith(['c2']);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Charts start with every category.'
    );
  });

  it('names what is saved, and resets to it after a look at everything', () => {
    const defaults = renderChartFilter(ALL_CATEGORIES, ['c2']);

    expect(screen.getByRole('status')).toHaveTextContent('Charts start without Rent.');
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset to the categories the charts start with' })
    );
    expect(defaults.onReset).toHaveBeenCalled();
  });

  it('offers neither while the ticks are the saved list', () => {
    renderChartFilter({ ids: ['c1'], uncategorized: true }, ['c2']);

    expect(screen.queryByRole('button', { name: 'Save as default' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });

  it('will not save a list that hides every category', () => {
    renderChartFilter({ ids: [], uncategorized: false });

    expect(screen.queryByRole('button', { name: 'Save as default' })).toBeNull();
  });

  it('says why a save failed, beside the button', async () => {
    const defaults = renderChartFilter({ ids: ['c1'], uncategorized: true });
    defaults.onSave.mockRejectedValue(new Error('offline'));

    fireEvent.click(screen.getByRole('button', { name: 'Save as default' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('the saved list', () => {
  it('opens a chart on every category, now and later, when nothing is hidden', () => {
    expect(savedSelection([FOOD, RENT], [])).toBe(ALL_CATEGORIES);
    // An id whose category was deleted since hides nothing.
    expect(savedSelection([FOOD, RENT], ['gone'])).toBe(ALL_CATEGORIES);
  });

  it('opens a chart without what is hidden, Uncategorised still in', () => {
    expect(savedSelection([FOOD, RENT], ['c2'])).toEqual({ ids: ['c1'], uncategorized: true });
  });

  it('reads back what a selection leaves out, in the user’s order', () => {
    expect(hiddenBy(ALL_CATEGORIES, [FOOD, RENT])).toEqual([]);
    expect(hiddenBy({ ids: [], uncategorized: true }, [FOOD, RENT])).toEqual(['c1', 'c2']);
    expect(hiddenBy({ ids: ['c2'], uncategorized: false }, [FOOD, RENT])).toEqual(['c1']);
  });

  it('names categories in a sentence', () => {
    expect(listNames(['Rent'])).toBe('Rent');
    expect(listNames(['Rent', 'Food'])).toBe('Rent and Food');
    expect(listNames(['Rent', 'Food', 'Travel'])).toBe('Rent, Food and Travel');
  });
});
