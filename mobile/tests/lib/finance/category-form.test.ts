import {
  categoryProblems,
  categoryValues,
  createPayload,
  updatePayload,
} from '@/lib/finance/category-form';
import type { Category } from '@/lib/finance/types';

const FOOD: Category = {
  id: 'food',
  name: 'Food',
  colour: '#22c55e',
  icon: 'food',
  created_at: '2026-08-01T00:00:00Z',
};

describe('category form rules', () => {
  it('starts a new category blank, in the neutral Slate, with no symbol', () => {
    expect(categoryValues(null)).toEqual({ name: '', colour: '#94a3b8', icon: null });
    expect(categoryValues(FOOD)).toEqual({ name: 'Food', colour: '#22c55e', icon: 'food' });
  });

  it('asks for a name', () => {
    expect(categoryProblems({ name: '  ', colour: '#94a3b8', icon: null })).toEqual({
      name: 'Enter a name for the category.',
    });
    expect(categoryProblems({ name: 'Food', colour: '#94a3b8', icon: null })).toEqual({});
  });

  it('creates with every field, the name trimmed', () => {
    expect(createPayload({ name: ' Coffee ', colour: '#78716c', icon: 'coffee' })).toEqual({
      name: 'Coffee',
      colour: '#78716c',
      icon: 'coffee',
    });
  });

  it('leaves the symbol out of an edit that didn’t change it, so the server keeps it', () => {
    expect(updatePayload({ name: 'Groceries', colour: '#22c55e', icon: 'food' }, FOOD)).toEqual({
      name: 'Groceries',
      colour: '#22c55e',
    });
  });

  it('sends a changed symbol, and null to clear one', () => {
    expect(updatePayload({ name: 'Food', colour: '#22c55e', icon: 'groceries' }, FOOD)).toEqual({
      name: 'Food',
      colour: '#22c55e',
      icon: 'groceries',
    });
    expect(updatePayload({ name: 'Food', colour: '#22c55e', icon: null }, FOOD)).toMatchObject({
      icon: null,
    });
  });
});
