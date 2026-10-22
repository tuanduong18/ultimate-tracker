'use client';

import { useCallback } from 'react';

import { CategorySection } from '@/components/finance/category-section';
import { useFinanceBasics } from '@/lib/hooks/use-finance-basics';

/**
 * The Categories tab. Deleting a category rewrites rows on the other tabs, but
 * each of those refetches when it is opened, so there is nothing to tell here.
 */
export function CategoriesView() {
  const { categories } = useFinanceBasics();
  const onChange = useCallback(() => {}, []);

  return <CategorySection categories={categories} onChange={onChange} />;
}
