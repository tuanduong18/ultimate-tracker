/** The chart category filter, and the query string a selection becomes. */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ALL_CATEGORIES,
  CategoryFilter,
  isEmptySelection,
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
