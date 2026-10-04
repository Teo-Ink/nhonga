import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { aiSearch, listProducts, formatMZN, type ProductListItem } from '@/lib/api';
import { FavoriteButton } from '@/components/FavoriteButton';
import { brand, radius, space, shadow } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const CATEGORIES: { slug: string; label: string; icon: IconName }[] = [
  { slug: '', label: 'Todos', icon: 'apps-outline' },
  { slug: 'viaturas', label: 'Viaturas', icon: 'car-sport-outline' },
  { slug: 'imoveis', label: 'Imóveis', icon: 'home-outline' },
  { slug: 'empregos', label: 'Empregos', icon: 'briefcase-outline' },
  { slug: 'servicos', label: 'Serviços', icon: 'construct-outline' },
  { slug: 'eventos', label: 'Eventos', icon: 'ticket-outline' },
  { slug: 'moda', label: 'Moda', icon: 'shirt-outline' },
  { slug: 'electronica', label: 'Eletrónica', icon: 'tv-outline' },
  { slug: 'telemoveis', label: 'Telemóveis', icon: 'phone-portrait-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Responsive grid: 2 columns on a phone, more on tablets / wide (web) screens.
  const numColumns = width >= 1100 ? 5 : width >= 820 ? 4 : width >= 560 ? 3 : 2;

  const [items, setItems] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchByImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const a = res.assets[0];
    const image = `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`;
    setImgBusy(true);
    try {
      const r = await aiSearch({ image });
      if (!r.configured) {
        Alert.alert(
          'Pesquisa por imagem',
          'A pesquisa por IA ainda não está ligada nesta demonstração.',
        );
        return;
      }
      if (r.query) {
        setCategory('');
        setQuery(r.query);
      }
    } catch {
      Alert.alert('Pesquisa por imagem', 'Não foi possível pesquisar agora. Tente novamente.');
    } finally {
      setImgBusy(false);
    }
  }, []);

  const fetchList = useCallback((q: string, cat: string) => {
    setError(false);
    return listProducts(48, q, cat || undefined)
      .then((r) => setItems(r.items ?? []))
      .catch(() => setError(true));
  }, []);

  // Load on mount and whenever the query/category changes. Typed queries are
  // debounced; a category tap or cleared search fetches immediately.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const typed = query.trim().length > 0;
    if (typed) setSearching(true);
    debounceRef.current = setTimeout(
      () => {
        void fetchList(query, category).finally(() => setSearching(false));
      },
      typed ? 350 : 0,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, category, fetchList]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchList(query, category).finally(() => setRefreshing(false));
  }, [fetchList, query, category]);

  let body: React.ReactNode;
  if (error) {
    body = (
      <View style={styles.center}>
        <Text style={styles.muted}>Não foi possível carregar os produtos.</Text>
        <Pressable style={styles.retry} onPress={() => void fetchList(query, category)}>
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
        key={`cols-${numColumns}`}
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={numColumns}
        style={styles.listWrap}
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
            onPress={() =>
              router.push({ pathname: '/produto/[slug]', params: { slug: item.slug } })
            }
          >
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
      <View style={styles.inner}>
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
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityLabel="Limpar pesquisa"
            >
              <Ionicons name="close-circle" size={18} color={brand.muted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void searchByImage()}
            hitSlop={8}
            disabled={imgBusy}
            accessibilityLabel="Pesquisar por imagem"
            style={styles.camBtn}
          >
            {imgBusy ? (
              <ActivityIndicator size="small" color={brand.green} />
            ) : (
              <Ionicons name="camera-outline" size={20} color={brand.green} />
            )}
          </Pressable>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsBar}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((c) => {
            const on = category === c.slug;
            return (
              <Pressable
                key={c.slug || 'all'}
                onPress={() => setCategory(c.slug)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Ionicons name={c.icon} size={15} color={on ? '#fff' : brand.green} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {body}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.bg },
  // Centre + cap the content so it doesn't stretch on tablet / web widths.
  inner: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginTop: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
  },
  searchInput: { flex: 1, color: brand.text, fontSize: 15, paddingVertical: 0 },
  camBtn: { width: 24, alignItems: 'center', justifyContent: 'center' },
  chipsBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: space.md, gap: space.sm, paddingBottom: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
  },
  chipOn: { backgroundColor: brand.green, borderColor: brand.green },
  chipText: { fontSize: 13, fontWeight: '600', color: brand.text },
  chipTextOn: { color: '#fff' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xl * 2,
  },
  muted: { color: brand.muted, textAlign: 'center' },
  retry: {
    backgroundColor: brand.green,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  listWrap: { flex: 1, width: '100%' },
  list: { padding: space.md, backgroundColor: brand.bg, flexGrow: 1 },
  row: { gap: space.md },
  card: { flex: 1, marginBottom: space.md, maxWidth: 260 },
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
