import { Stack } from 'expo-router';
import { View } from 'react-native';

import { CategoryBadge } from '@/components/finance/category-badge';
import { ArrangeScreen } from '@/components/finance/arrange-screen';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { loadError, useCategories } from '@/lib/finance/queries';
import { SPACE } from '@/theme/scale';

/**
 * Arranging categories: the order every picker and filter follows, whose first category starts
 * every new expense.
 */
export default function ArrangeCategories() {
  const categories = useCategories();

  if (!categories.data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Arrange categories' }} />
        <Screen>
          {categories.error ? (
            <ErrorState
              message={loadError(categories, 'Could not load this list.') ?? ''}
              onRetry={() => categories.refetch()}
            />
          ) : (
            <LoadingState rows={4} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <ArrangeScreen
      title="Arrange categories"
      items={categories.data}
      path="/finance/categories/order"
      nameOf={(category) => category.name}
      renderRow={(category) => (
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACE.md,
          }}
        >
          <CategoryBadge
            colour={category.colour}
            name={category.name}
            icon={category.icon}
            size="sm"
          />
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {category.name}
          </Text>
        </View>
      )}
    />
  );
}
