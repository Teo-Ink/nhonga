import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { aiSearch, listProducts, type ProductListItem, type SortKey } from '@/lib/api';
import { ProductGridCard } from '@/components/ProductGridCard';
import { brand, radius, space } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Mais relevantes' },
  { key: 'newest', label: 'Mais recentes' },
  { key: 'price_asc', label: 'Preço: mais baixo' },
  { key: 'price_desc', label: 'Preço: mais alto' },
];
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
  // Applied filters (drive the fetch).
  const [sort, setSort] = useState<SortKey>('relevance');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  // Draft filters (edited in the modal, committed on "Aplicar").
  const [filterOpen, setFilterOpen] = useState(false);
  const [dSort, setDSort] = useState<SortKey>('relevance');
  const [dMin, setDMin] = useState('');
  const [dMax, setDMax] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toCents = (s: string): number | undefined => {
    const n = Number(s.replace(/[^\d]/g, ''));
    return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
  };
  const minCents = toCents(minPrice);
  const maxCents = toCents(maxPrice);
  const filtersActive = sort !== 'relevance' || minCents !== undefined || maxCents !== undefined;

  function openFilters() {
    setDSort(sort);
    setDMin(minPrice);
    setDMax(maxPrice);
    setFilterOpen(true);
  }
  function applyFilters() {
    setSort(dSort);
    setMinPrice(dMin);
    setMaxPrice(dMax);
    setFilterOpen(false);
  }
  function clearFilters() {
    setDSort('relevance');
    setDMin('');
    setDMax('');
  }

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

  const fetchList = useCallback(() => {
    setError(false);
    return listProducts({
      limit: 48,
      q: query,
      category: category || undefined,
      sort,
      minPriceCents: minCents,
      maxPriceCents: maxCents,
    })
      .then((r) => setItems(r.items ?? []))
      .catch(() => setError(true));
  }, [query, category, sort, minCents, maxCents]);

  // Re-fetch whenever a filter/query/category changes. Typed queries are
  // debounced; other changes (category, sort, price) apply right away.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const typed = query.trim().length > 0;
    if (typed) setSearching(true);
    debounceRef.current = setTimeout(
      () => {
        void fetchList().finally(() => setSearching(false));
      },
      typed ? 350 : 0,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchList, query]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchList().finally(() => setRefreshing(false));
  }, [fetchList]);

  let body: React.ReactNode;
  if (error) {
    body = (
      <View style={styles.center}>
        <Text style={styles.muted}>Não foi possível carregar os produtos.</Text>
        <Pressable style={styles.retry} onPress={() => void fetchList()}>
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
          <ProductGridCard
            item={item}
            onPress={() =>
              router.push({ pathname: '/produto/[slug]', params: { slug: item.slug } })
            }
          />
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
          <Pressable
            onPress={openFilters}
            hitSlop={8}
            accessibilityLabel="Filtros"
            style={styles.camBtn}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={filtersActive ? brand.green : brand.muted}
            />
            {filtersActive ? <View style={styles.filterDot} /> : null}
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

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Filtros</Text>

            <Text style={styles.sheetLabel}>Ordenar</Text>
            {SORTS.map((s) => (
              <Pressable key={s.key} style={styles.sortRow} onPress={() => setDSort(s.key)}>
                <Ionicons
                  name={dSort === s.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={dSort === s.key ? brand.green : brand.muted}
                />
                <Text style={styles.sortLabel}>{s.label}</Text>
              </Pressable>
            ))}

            <Text style={styles.sheetLabel}>Preço (MT)</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                value={dMin}
                onChangeText={setDMin}
                placeholder="Mín"
                placeholderTextColor={brand.muted}
                keyboardType="numeric"
              />
              <Text style={styles.priceDash}>–</Text>
              <TextInput
                style={styles.priceInput}
                value={dMax}
                onChangeText={setDMax}
                placeholder="Máx"
                placeholderTextColor={brand.muted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.sheetActions}>
              <Pressable style={styles.sheetClear} onPress={clearFilters}>
                <Text style={styles.sheetClearText}>Limpar</Text>
              </Pressable>
              <Pressable style={styles.sheetApply} onPress={applyFilters}>
                <Text style={styles.sheetApplyText}>Ver resultados</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  filterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: brand.green,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: brand.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: brand.border,
    marginBottom: space.sm,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: brand.text, marginBottom: space.xs },
  sheetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: space.md,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  sortLabel: { fontSize: 15, color: brand.text },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  priceInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    backgroundColor: brand.bg,
    color: brand.text,
    fontSize: 15,
  },
  priceDash: { color: brand.muted, fontSize: 16 },
  sheetActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  sheetClear: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetClearText: { color: brand.text, fontWeight: '700' },
  sheetApply: {
    flex: 2,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetApplyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
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
});
