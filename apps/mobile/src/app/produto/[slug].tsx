import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLinking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  getProduct,
  listProducts,
  recordEvent,
  formatMZN,
  type ProductDetail,
  type ProductListItem,
} from '@/lib/api';
import { ImageGallery } from '@/components/ImageGallery';
import { Skeleton } from '@/components/Skeleton';
import { useFavorites } from '@/lib/favorites';
import { brand, radius, space, shadow } from '@/lib/theme';

// Shrinks a button slightly while pressed for tactile feedback.
const pressed = ({ pressed: p }: { pressed: boolean }) =>
  p ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : null;

// Favourite toggle for the green header bar (white heart, red when saved).
function HeaderHeart({ productId }: { productId: string }) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(productId);
  return (
    <Pressable
      onPress={() => toggle(productId)}
      hitSlop={10}
      accessibilityLabel={on ? 'Remover dos favoritos' : 'Guardar nos favoritos'}
      style={(s) => [{ paddingHorizontal: space.sm }, pressed(s)]}
    >
      <Ionicons name={on ? 'heart' : 'heart-outline'} size={24} color={on ? '#ff6b8a' : '#fff'} />
    </Pressable>
  );
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [similar, setSimilar] = useState<ProductListItem[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setProduct(null);
    setSimilar([]);
    getProduct(String(slug))
      .then(setProduct)
      .catch(() => setError(true));
  }, [slug]);

  // Once the product is known, pull other listings in the same category.
  const categorySlug = product?.category.slug;
  const currentId = product?.id;
  useEffect(() => {
    if (!categorySlug || !currentId) return;
    void listProducts({ category: categorySlug, limit: 12 })
      .then((r) => setSimilar((r.items ?? []).filter((p) => p.id !== currentId).slice(0, 10)))
      .catch(() => setSimilar([]));
  }, [categorySlug, currentId]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Anúncio não encontrado.</Text>
      </View>
    );
  }
  if (!product) {
    return (
      <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
        <Skeleton style={styles.skelGallery} />
        <Skeleton style={styles.skelTitle} />
        <Skeleton style={styles.skelPrice} />
        <Skeleton style={styles.skelSeller} />
        <Skeleton style={styles.skelBtn} />
        <Skeleton style={styles.skelBtn} />
      </ScrollView>
    );
  }

  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];
  const specs = Object.entries(product.attributes ?? {});
  const price = formatMZN(product.priceCents);
  const { whatsapp, phone } = product.vendor;

  function openWhatsApp() {
    if (!whatsapp || !product) return;
    recordEvent(product.slug, 'contact');
    const msg = `Olá! Tenho interesse no anúncio «${product.title}» (${price}) no Nhonga.`;
    void Linking.openURL(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`);
  }
  function call() {
    if (!phone || !product) return;
    recordEvent(product.slug, 'contact');
    void Linking.openURL(`tel:+${phone}`);
  }
  async function share() {
    if (!product) return;
    recordEvent(product.slug, 'share');
    // Deep link that reopens this exact listing (nhonga://produto/slug on a
    // device, the web URL on Expo web).
    const url = ExpoLinking.createURL(`/produto/${product.slug}`);
    try {
      await Share.share({
        message: `${product.title} — ${price} · Nhonga\n${url}`,
        url,
        title: product.title,
      });
    } catch {
      /* cancelled */
    }
  }

  const hasContact = Boolean(whatsapp || phone);

  return (
    <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: product.title,
          headerRight: () => <HeaderHeart productId={product.id} />,
        }}
      />
      <ImageGallery images={gallery} />

      <Text style={styles.title}>{product.title}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}</Text>
        {product.compareAtCents ? (
          <Text style={styles.was}>{formatMZN(product.compareAtCents)}</Text>
        ) : null}
      </View>
      <Pressable
        style={(s) => [styles.sellerRow, pressed(s)]}
        onPress={() =>
          router.push({ pathname: '/loja/[slug]', params: { slug: product.vendor.slug } })
        }
        accessibilityRole="link"
        accessibilityLabel={`Ver a loja de ${product.vendor.displayName}`}
      >
        <Ionicons name="storefront-outline" size={16} color={brand.green} />
        <Text style={styles.seller} numberOfLines={1}>
          {product.vendor.displayName}
          {product.location ? ` · ${product.location}` : ''}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={brand.muted} />
      </Pressable>

      {/* Contact block */}
      {whatsapp ? (
        <Pressable style={(s) => [styles.contactBtn, styles.wa, pressed(s)]} onPress={openWhatsApp}>
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.contactText}>Contactar pelo WhatsApp</Text>
        </Pressable>
      ) : null}
      {phone ? (
        <Pressable style={(s) => [styles.contactBtn, styles.call, pressed(s)]} onPress={call}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.contactText}>Ligar</Text>
        </Pressable>
      ) : null}
      <Pressable style={(s) => [styles.contactBtn, styles.shareBtn, pressed(s)]} onPress={share}>
        <Ionicons name="share-social-outline" size={18} color={brand.text} />
        <Text style={styles.shareText}>Partilhar</Text>
      </Pressable>
      {!hasContact ? <Text style={styles.muted}>Este vendedor não deixou contacto.</Text> : null}
      <View style={styles.safeBox}>
        <Ionicons name="shield-checkmark-outline" size={18} color={brand.green} />
        <Text style={styles.safe}>
          Dica: encontre-se num local público e verifique o produto antes de pagar. Nunca envie
          dinheiro adiantado nem partilhe códigos ou PIN.
        </Text>
      </View>

      {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}

      {specs.length > 0 ? (
        <View style={styles.specs}>
          <Text style={styles.specsTitle}>Especificações</Text>
          {specs.map(([k, v]) => (
            <View style={styles.specRow} key={k}>
              <Text style={styles.specKey}>{k}</Text>
              <Text style={styles.specVal}>{v}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {similar.length > 0 ? (
        <View style={styles.similar}>
          <View style={styles.similarHead}>
            <Text style={styles.similarTitle}>Anúncios semelhantes</Text>
            <Pressable
              style={(s) => [styles.seeAll, pressed(s)]}
              onPress={() =>
                router.navigate({ pathname: '/', params: { category: product.category.slug } })
              }
              accessibilityRole="link"
              accessibilityLabel={`Ver mais em ${product.category.name}`}
            >
              <Text style={styles.seeAllText}>Ver mais</Text>
              <Ionicons name="chevron-forward" size={14} color={brand.green} />
            </Pressable>
          </View>
          <FlatList
            data={similar}
            keyExtractor={(p) => p.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.similarRow}
            renderItem={({ item }) => (
              <SimilarCard
                item={item}
                onPress={() =>
                  router.push({ pathname: '/produto/[slug]', params: { slug: item.slug } })
                }
              />
            )}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

// A compact fixed-width card for the horizontal "similar listings" carousel.
function SimilarCard({ item, onPress }: { item: ProductListItem; onPress: () => void }) {
  return (
    <Pressable style={(s) => [styles.simCard, pressed(s)]} onPress={onPress}>
      <View style={styles.simMedia}>
        {item.image ? (
          <Image source={{ uri: item.image.url }} style={styles.simImage} resizeMode="cover" />
        ) : null}
      </View>
      <Text style={styles.simTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.simPrice}>{formatMZN(item.priceCents)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  muted: { color: brand.muted },
  skelGallery: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  skelTitle: { marginTop: space.md, height: 22, width: '80%', borderRadius: radius.sm },
  skelPrice: { marginTop: space.sm, height: 24, width: '40%', borderRadius: radius.sm },
  skelSeller: { marginTop: space.sm, height: 16, width: '55%', borderRadius: radius.sm },
  skelBtn: { marginTop: space.sm, height: 50, width: '100%', borderRadius: radius.pill },
  content: { padding: space.lg, gap: space.sm },
  title: {
    marginTop: space.md,
    fontSize: 20,
    fontWeight: '700',
    color: brand.text,
    letterSpacing: -0.3,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  price: { fontSize: 22, fontWeight: '800', color: brand.green, letterSpacing: -0.4 },
  was: { fontSize: 15, color: brand.muted, textDecorationLine: 'line-through' },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
  seller: { flex: 1, color: brand.text, fontWeight: '600' },
  contactBtn: {
    flexDirection: 'row',
    gap: space.sm,
    height: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  wa: { backgroundColor: '#25D366', ...shadow.sm },
  call: { backgroundColor: brand.green, ...shadow.sm },
  contactText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  shareBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: brand.border },
  shareText: { color: brand.text, fontWeight: '600', fontSize: 15 },
  safeBox: {
    marginTop: space.sm,
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
  },
  safe: { flex: 1, fontSize: 12, color: brand.muted, lineHeight: 18 },
  desc: { marginTop: space.md, fontSize: 15, lineHeight: 22, color: brand.text },
  specs: { marginTop: space.md, borderTopWidth: 1, borderTopColor: brand.border },
  specsTitle: { marginTop: space.md, marginBottom: space.sm, fontWeight: '700', color: brand.text },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  specKey: { color: brand.muted },
  specVal: { color: brand.text, fontWeight: '500' },
  similar: { marginTop: space.lg },
  similarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  similarTitle: { fontSize: 16, fontWeight: '700', color: brand.text },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: space.xs },
  seeAllText: { color: brand.green, fontWeight: '700', fontSize: 14 },
  similarRow: { gap: space.md, paddingRight: space.md },
  simCard: { width: 150 },
  simMedia: {
    width: 150,
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
    marginBottom: space.xs,
  },
  simImage: { width: '100%', height: '100%' },
  simTitle: { fontSize: 13, color: brand.text, lineHeight: 17 },
  simPrice: { fontSize: 14, fontWeight: '800', color: brand.green, marginTop: 2 },
});
