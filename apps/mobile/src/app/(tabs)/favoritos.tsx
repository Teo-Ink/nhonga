import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { listProducts, type ProductListItem } from '@/lib/api';
import { ProductGridCard } from '@/components/ProductGridCard';
import { useFavorites } from '@/lib/favorites';
import { brand, space } from '@/lib/theme';

// Favourites: the listings the user has hearted (per-device + server-synced).
// Resolves them against the catalogue so they can be browsed and re-opened.
export default function FavoritesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1100 ? 5 : width >= 820 ? 4 : width >= 560 ? 3 : 2;
  const { isFavorite, count } = useFavorites();

  const [all, setAll] = useState<ProductListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return listProducts({ limit: 100 })
      .then((r) => setAll(r.items ?? []))
      .catch(() => setAll([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  // Re-filter whenever the favourites set or the catalogue changes.
  const items = useMemo(() => (all ?? []).filter((p) => isFavorite(p.id)), [all, isFavorite]);

  if (all === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} />
      </View>
    );
  }

  if (count === 0 || items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="heart-outline" size={40} color={brand.muted} />
        <Text style={styles.emptyTitle}>Ainda não guardaste favoritos</Text>
        <Text style={styles.muted}>Toque no coração de um anúncio para o guardar aqui.</Text>
      </View>
    );
  }

  return (
    <FlatList
      key={`cols-${numColumns}`}
      data={items}
      keyExtractor={(p) => p.id}
      numColumns={numColumns}
      style={styles.wrap}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={brand.green}
          colors={[brand.green]}
        />
      }
      ListHeaderComponent={<Text style={styles.header}>Os meus favoritos ({items.length})</Text>}
      renderItem={({ item }) => (
        <ProductGridCard
          item={item}
          onPress={() => router.push({ pathname: '/produto/[slug]', params: { slug: item.slug } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', backgroundColor: brand.bg },
  list: { padding: space.md },
  row: { gap: space.md },
  header: { fontSize: 16, fontWeight: '700', color: brand.text, marginBottom: space.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xl,
    backgroundColor: brand.bg,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: brand.text, marginTop: space.sm },
  muted: { color: brand.muted, textAlign: 'center' },
});
