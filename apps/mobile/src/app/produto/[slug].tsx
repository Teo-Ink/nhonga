import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getProduct, formatMZN, type ProductDetail, type ProductVariant } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { brand, radius, space } from '@/lib/theme';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const cart = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getProduct(String(slug))
      .then(setProduct)
      .catch(() => setError(true));
  }, [slug]);

  // Resolve the chosen variant: the only one, or the one matching all options.
  const variant: ProductVariant | null = useMemo(() => {
    if (!product) return null;
    if (product.variants.length === 1) return product.variants[0];
    const groups = product.options;
    if (groups.length === 0) return product.variants[0] ?? null;
    if (!groups.every((g) => selected[g.name])) return null;
    return (
      product.variants.find((v) => groups.every((g) => v.options[g.name] === selected[g.name])) ??
      null
    );
  }, [product, selected]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Produto não encontrado.</Text>
      </View>
    );
  }
  if (!product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} />
      </View>
    );
  }

  const hero = product.images?.[0] ?? product.image;
  const specs = Object.entries(product.attributes ?? {});
  const priceCents = variant?.priceCents ?? product.priceCents;
  const canBuy = !!variant && variant.inStock;

  function addToCart() {
    if (!variant || !product) return;
    const label = Object.values(variant.options).join(' · ');
    cart.add({
      variantId: variant.id,
      productSlug: product.slug,
      title: product.title,
      optionsLabel: label,
      unitPriceCents: variant.priceCents,
      imageUrl: hero?.url ?? null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: product.title }} />
      <View style={styles.media}>
        {hero ? <Image source={{ uri: hero.url }} style={styles.image} resizeMode="cover" /> : null}
      </View>

      <Text style={styles.title}>{product.title}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatMZN(priceCents)}</Text>
        {product.compareAtCents ? (
          <Text style={styles.was}>{formatMZN(product.compareAtCents)}</Text>
        ) : null}
      </View>
      <Text style={styles.seller}>Vendido por {product.vendor.displayName}</Text>

      {product.options.map((group) => (
        <View key={group.name} style={styles.optGroup}>
          <Text style={styles.optLabel}>{group.name}</Text>
          <View style={styles.optRow}>
            {group.values.map((val) => {
              const on = selected[group.name] === val.value;
              return (
                <Pressable
                  key={val.value}
                  disabled={!val.available}
                  onPress={() => setSelected((s) => ({ ...s, [group.name]: val.value }))}
                  style={[styles.chip, on && styles.chipOn, !val.available && styles.chipOff]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{val.value}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Pressable
        style={[styles.buy, !canBuy && styles.buyDisabled]}
        onPress={addToCart}
        disabled={!canBuy}>
        <Text style={styles.buyText}>
          {added
            ? '✓ Adicionado'
            : !variant
              ? 'Escolha as opções'
              : !variant.inStock
                ? 'Esgotado'
                : 'Adicionar ao carrinho'}
        </Text>
      </Pressable>
      {cart.count > 0 ? (
        <Pressable style={styles.viewCart} onPress={() => router.push('/carrinho')}>
          <Text style={styles.viewCartText}>Ver carrinho ({cart.count})</Text>
        </Pressable>
      ) : null}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  muted: { color: brand.muted },
  content: { padding: space.lg, gap: space.sm },
  media: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
  },
  image: { width: '100%', height: '100%' },
  title: { marginTop: space.md, fontSize: 20, fontWeight: '700', color: brand.text },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  price: { fontSize: 22, fontWeight: '800', color: brand.green },
  was: { fontSize: 15, color: brand.muted, textDecorationLine: 'line-through' },
  seller: { color: brand.muted },
  optGroup: { marginTop: space.md, gap: space.sm },
  optLabel: { fontWeight: '600', color: brand.text },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
  },
  chipOn: { borderColor: brand.green, backgroundColor: '#e6f2ee' },
  chipOff: { opacity: 0.4 },
  chipText: { color: brand.text },
  chipTextOn: { color: brand.green, fontWeight: '700' },
  buy: {
    marginTop: space.lg,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyDisabled: { backgroundColor: brand.muted },
  buyText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  viewCart: { marginTop: space.sm, alignItems: 'center', padding: space.sm },
  viewCartText: { color: brand.green, fontWeight: '600' },
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
});
