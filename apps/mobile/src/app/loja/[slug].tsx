import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getShop, listProducts, recordEvent, type ProductListItem, type Shop } from '@/lib/api';
import { ProductGridCard } from '@/components/ProductGridCard';
import { brand, radius, shadow, space } from '@/lib/theme';

// Public seller storefront: the vendor header (name, badges, rating, member
// since, contact) plus a grid of their active listings (?vendor=slug). The
// header is built only from what the catalogue knows — no invented bio or banner.
export default function ShopScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1100 ? 5 : width >= 820 ? 4 : width >= 560 ? 3 : 2;

  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [items, setItems] = useState<ProductListItem[] | null>(null);

  const load = useCallback(() => {
    if (!slug) return;
    const s = String(slug);
    void getShop(s)
      .then(setShop)
      .catch(() => setShop(null));
    void listProducts({ vendor: s, limit: 100 })
      .then((r) => setItems(r.items ?? []))
      .catch(() => setItems([]));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (shop === undefined || items === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Loja' }} />
        <ActivityIndicator color={brand.green} />
      </View>
    );
  }

  const name = shop?.displayName ?? String(slug);
  const memberSince = shop
    ? new Date(shop.memberSince).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' })
    : null;
  const count = items.length;
  const countLabel = count === 1 ? '1 anúncio' : `${count} anúncios`;

  function contactWhatsApp() {
    if (!shop?.whatsapp) return;
    recordEvent(String(slug), 'contact');
    const msg = `Olá! Encontrei a sua loja «${name}» no Nhonga.`;
    void Linking.openURL(
      `https://wa.me/${shop.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`,
    );
  }
  function call() {
    if (!shop?.phone) return;
    recordEvent(String(slug), 'contact');
    void Linking.openURL(`tel:+${shop.phone.replace(/\D/g, '')}`);
  }

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.store}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            {shop?.isVerified ? (
              <Ionicons name="checkmark-circle" size={18} color={brand.green} />
            ) : null}
            {shop?.isPro ? (
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.statsRow}>
            {shop && shop.ratingAvg !== null ? (
              <View style={styles.rating}>
                <Ionicons name="star" size={13} color={brand.yellow} />
                <Text style={styles.ratingText}>
                  {shop.ratingAvg.toFixed(1)}
                  {shop.ratingCount > 0 ? ` (${shop.ratingCount})` : ''}
                </Text>
              </View>
            ) : null}
            <Text style={styles.count}>{countLabel}</Text>
          </View>
          {shop && (shop.location || memberSince) ? (
            <Text style={styles.sub}>
              {shop.location ? shop.location : ''}
              {shop.location && memberSince ? ' · ' : ''}
              {memberSince ? `Membro desde ${memberSince}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {shop && (shop.whatsapp || shop.phone) ? (
        <View style={styles.ctaRow}>
          {shop.whatsapp ? (
            <Pressable
              style={({ pressed }) => [styles.cta, styles.wa, pressed && styles.pressed]}
              onPress={contactWhatsApp}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={styles.ctaText}>WhatsApp</Text>
            </Pressable>
          ) : null}
          {shop.phone ? (
            <Pressable
              style={({ pressed }) => [styles.cta, styles.call, pressed && styles.pressed]}
              onPress={call}
            >
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={styles.ctaText}>Ligar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {shop ? (
        <View style={styles.statCards}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{shop.activeCount}</Text>
            <Text style={styles.statLabel}>Ativos</Text>
          </View>
          {shop.soldCount > 0 ? (
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{shop.soldCount}</Text>
              <Text style={styles.statLabel}>Vendidos</Text>
            </View>
          ) : null}
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {shop.ratingAvg !== null ? shop.ratingAvg.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>Avaliação</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{shop.ratingCount}</Text>
            <Text style={styles.statLabel}>Opiniões</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Anúncios</Text>
    </View>
  );

  return (
    <FlatList
      key={`cols-${numColumns}`}
      data={items}
      keyExtractor={(p) => p.id}
      numColumns={numColumns}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      ListHeaderComponent={
        <>
          <Stack.Screen options={{ title: name }} />
          {header}
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={36} color={brand.muted} />
          <Text style={styles.emptyText}>Esta loja ainda não tem anúncios ativos.</Text>
        </View>
      }
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.bg },
  list: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', backgroundColor: brand.bg },
  listContent: { padding: space.md },
  row: { gap: space.md },
  headerWrap: { gap: space.md, marginBottom: space.sm },
  store: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  meta: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 19, fontWeight: '800', color: brand.text, letterSpacing: -0.3 },
  proBadge: {
    backgroundColor: brand.yellow,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  proText: { fontSize: 10, fontWeight: '800', color: brand.ink },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 13, color: brand.text, fontWeight: '600' },
  count: { fontSize: 13, color: brand.muted },
  sub: { fontSize: 13, color: brand.muted },
  ctaRow: { flexDirection: 'row', gap: space.sm },
  cta: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  wa: { backgroundColor: '#25D366' },
  call: { backgroundColor: brand.green },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  statCards: { flexDirection: 'row', gap: space.sm },
  statCard: {
    flex: 1,
    backgroundColor: brand.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.border,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  statNum: { fontSize: 17, fontWeight: '800', color: brand.text },
  statLabel: { fontSize: 11, color: brand.muted, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: brand.text, marginTop: space.xs },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl },
  emptyText: { color: brand.muted, textAlign: 'center' },
});
