import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { listProducts, formatMZN, type ProductListItem } from '@/lib/api';
import { brand, radius, space, shadow } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setError(false);
    listProducts()
      .then((r) => setItems(r.items ?? []))
      .catch(() => setError(true));
  }, []);

  // Pull-to-refresh: re-fetch and keep the spinner until the request settles.
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setError(false);
    listProducts()
      .then((r) => setItems(r.items ?? []))
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(load, [load]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Não foi possível carregar os produtos.</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (items === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(p) => p.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.green} colors={[brand.green]} />
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
          ]}
          onPress={() => router.push({ pathname: '/produto/[slug]', params: { slug: item.slug } })}>

          <View style={styles.media}>
            {item.image ? (
              <Image source={{ uri: item.image.url }} style={styles.image} resizeMode="cover" />
            ) : null}
            {item.discountPercent ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>-{item.discountPercent}%</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.price}>{formatMZN(item.priceCents)}</Text>
          {item.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={brand.muted} />
              <Text style={styles.location} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  muted: { color: brand.muted },
  retry: {
    backgroundColor: brand.green,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  list: { padding: space.md, backgroundColor: brand.bg },
  row: { gap: space.md },
  card: { flex: 1, marginBottom: space.md },
  media: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
    ...shadow.sm,
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: brand.yellow,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    ...shadow.sm,
  },
  badgeText: { color: brand.ink, fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },
  title: { marginTop: space.sm, fontSize: 13, lineHeight: 17, color: brand.text },
  price: { marginTop: 2, fontSize: 15, fontWeight: '800', color: brand.green, letterSpacing: -0.2 },
  locationRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 2 },
  location: { fontSize: 11, color: brand.muted, flexShrink: 1 },
});
