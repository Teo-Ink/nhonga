import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { listProducts, formatMZN, type ProductListItem } from '@/lib/api';
import { brand, radius, space } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    listProducts()
      .then((r) => setItems(r.items ?? []))
      .catch(() => setError(true));
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
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
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
            <Text style={styles.location} numberOfLines={1}>
              {item.location}
            </Text>
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
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: brand.yellow,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: brand.ink, fontWeight: '700', fontSize: 11 },
  title: { marginTop: space.sm, fontSize: 13, color: brand.text },
  price: { marginTop: 2, fontSize: 15, fontWeight: '700', color: brand.green },
  location: { marginTop: 2, fontSize: 11, color: brand.muted },
});
