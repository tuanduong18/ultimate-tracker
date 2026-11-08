import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Card, RowDivider } from '@/components/card';
import { Fab } from '@/components/fab';
import { CategoryRow } from '@/components/finance/category-row';
import { HeaderAction } from '@/components/header-action';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { loadError, useCategories } from '@/lib/finance/queries';

/**
 * The person's categories, in their own order — the phone's twin of the web's Categories tab.
 * That order is the one every category picker uses, with the first starting every new expense,
 * so Arrange sits in the top bar while there is more than one. Tapping a category opens it to
 * rename, recolour, re-symbol or delete; New category is the floating button.
 */
export default function Categories() {
  const router = useRouter();
  const categories = useCategories();
  const list = categories.data ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Categories',
          headerRight:
            list.length > 1
              ? () => (
                  <HeaderAction
                    label="Arrange"
                    accessibilityLabel="Arrange categories"
                    onPress={() => router.push('/arrange-categories')}
                  />
                )
              : undefined,
        }}
      />
      <Screen withFab onRefresh={() => categories.refetch()}>
        {categories.isPending ? (
          <LoadingState rows={4} />
        ) : categories.error && !categories.data ? (
          <ErrorState
            message={loadError(categories, 'Could not load this list.') ?? ''}
            onRetry={() => categories.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon="sell"
            message="No categories yet. Create one before setting a budget."
          />
        ) : (
          <>
            <Text tone="fgMuted">
              The first one is where a new expense starts. Every list of categories follows this
              order.
            </Text>
            <Card>
              {list.map((category, index) => (
                <View key={category.id}>
                  {index > 0 && <RowDivider />}
                  <CategoryRow
                    category={category}
                    onPress={() =>
                      router.push({ pathname: '/category', params: { id: category.id } })
                    }
                  />
                </View>
              ))}
            </Card>
          </>
        )}
      </Screen>
      <Fab label="New" accessibilityLabel="New category" onPress={() => router.push('/category')} />
    </View>
  );
}
