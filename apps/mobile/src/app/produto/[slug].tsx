import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getProduct, formatMZN, type ProductDetail } from '@/lib/api';
import { brand, radius, space } from '@/lib/theme';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getProduct(String(slug))
      .then(setProduct)
      .catch(() => setError(true));
  }, [slug]);

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

  return (
    <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: product.title }} />
      <View style={styles.media}>
        {hero ? <Image source={{ uri: hero.url }} style={styles.image} resizeMode="cover" /> : null}
      </View>

      <Text style={styles.title}>{product.title}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatMZN(product.priceCents)}</Text>
        {product.compareAtCents ? (
          <Text style={styles.was}>{formatMZN(product.compareAtCents)}</Text>
        ) : null}
      </View>

      <Text style={styles.seller}>Vendido por {product.vendor.displayName}</Text>

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

      <Text style={styles.notice}>
        Demonstração — o checkout móvel ainda não está ligado nesta versão.
      </Text>
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
  desc: { marginTop: space.sm, fontSize: 15, lineHeight: 22, color: brand.text },
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
  notice: {
    marginTop: space.lg,
    fontSize: 12,
    color: brand.muted,
    fontStyle: 'italic',
  },
});
