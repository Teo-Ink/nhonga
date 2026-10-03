import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { listProducts, formatMZN, type ProductListItem } from '@/lib/api';
import { FavoriteButton } from '@/components/FavoriteButton';
import { brand, radius, space, shadow } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback((q: string) => {
    setError(false);
    return listProducts(48, q)
      .then((r) => setItems(r.items ?? []))
      .catch(() => setError(true));
  }, []);

  // Load on mount and whenever the query changes. Typed queries are debounced;
  // an empty query (initial load / cleared search) fetches immediately.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const typed = query.trim().length > 0;
    if (typed) setSearching(true);
    debounceRef.current = setTimeout(
      () => {
        void fetchList(query).finally(() => setSearching(false));
      },
      typed ? 350 : 0,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchList]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchList(query).finally(() => setRefreshing(false));
  }, [fetchList, query]);

  let body: React.ReactNode;
  if (error) {
    body = (
      <View style={styles.center}>
        <Text style={styles.muted}>Não foi possível carregar os produtos.</Text>
        <Pressable style={styles.retry} onPress={() => void fetchList(query)}>
          <Text style={styles.retryText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (items === null) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={brand.green}
            colors={[brand.green]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={32} color={brand.muted} />
            <Text style={styles.muted}>
              {query.trim() ? `Sem resultados para “${query.trim()}”.` : 'Ainda não há anúncios.'}
            </Text>
          </View>
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
              <FavoriteButton productId={item.id} />
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

  return (
    <View style={styles.screen}>
      {/* Sticky search bar — kept outside the list so typing never loses focus. */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={brand.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Pesquisar no Nhonga…"
          placeholderTextColor={brand.muted}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
        />
        {searching ? (
          <ActivityIndicator size="small" color={brand.muted} />
        ) : query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Limpar pesquisa">
            <Ionicons name="close-circle" size={18} color={brand.muted} />
          </Pressable>
        ) : null}
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginTop: space.md,
    marginBottom: space.xs,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
  },
  searchInput: { flex: 1, color: brand.text, fontSize: 15, paddingVertical: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xl * 2 },
  muted: { color: brand.muted, textAlign: 'center' },
  retry: {
    backgroundColor: brand.green,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  list: { padding: space.md, backgroundColor: brand.bg, flexGrow: 1 },
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
