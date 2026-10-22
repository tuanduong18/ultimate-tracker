import type { Metadata } from 'next';

import { CategoriesView } from '@/components/finance/categories-view';

export const metadata: Metadata = { title: 'Categories' };

export default function CategoriesPage() {
  return (
    <div className="max-w-3xl">
      <CategoriesView />
    </div>
  );
}
