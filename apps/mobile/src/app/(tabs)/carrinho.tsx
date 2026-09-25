import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMZN } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { brand, radius, space } from '@/lib/theme';

export default function CartScreen() {
  const router = useRouter();
  const { lines, totalCents, setQty, remove } = useCart();

  if (lines.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>O teu carrinho está vazio</Text>
        <Text style={styles.muted}>Explora os produtos e adiciona ao carrinho.</Text>
        <Pressable style={styles.browse} onPress={() => router.push('/')}>
          <Text style={styles.browseText}>Ver produtos</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        {lines.map((l) => (
          <View key={l.variantId} style={styles.card}>
            <View style={styles.thumb}>
              {l.imageUrl ? (
                <Image source={{ uri: l.imageUrl }} style={styles.thumbImg} resizeMode="cover" />
              ) : null}
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {l.title}
              </Text>
              {l.optionsLabel ? <Text style={styles.opts}>{l.optionsLabel}</Text> : null}
              <Text style={styles.price}>{formatMZN(l.unitPriceCents * l.quantity)}</Text>
              <View style={styles.qtyRow}>
                <Pressable style={styles.step} onPress={() => setQty(l.variantId, l.quantity - 1)}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.qty}>{l.quantity}</Text>
                <Pressable style={styles.step} onPress={() => setQty(l.variantId, l.quantity + 1)}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
                <Pressable style={styles.remove} onPress={() => remove(l.variantId)}>
                  <Text style={styles.removeText}>Remover</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatMZN(totalCents)}</Text>
        </View>
        <Pressable style={styles.checkout} onPress={() => router.push('/checkout')}>
          <Text style={styles.checkoutText}>Finalizar compra</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xl,
    backgroundColor: brand.bg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: brand.text },
  muted: { color: brand.muted, textAlign: 'center' },
  browse: {
    marginTop: space.md,
    backgroundColor: brand.green,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  browseText: { color: '#fff', fontWeight: '600' },
  list: { padding: space.md, gap: space.md },
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.sm,
    backgroundColor: brand.surface,
    borderRadius: radius.md,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
  },
  thumbImg: { width: '100%', height: '100%' },
  info: { flex: 1 },
  title: { fontSize: 14, color: brand.text, fontWeight: '500' },
  opts: { fontSize: 12, color: brand.muted },
  price: { marginTop: 2, fontWeight: '700', color: brand.green },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  step: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 18, color: brand.text },
  qty: { minWidth: 24, textAlign: 'center', color: brand.text, fontWeight: '600' },
  remove: { marginLeft: 'auto' },
  removeText: { color: brand.danger, fontSize: 13 },
  footer: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: brand.border,
    backgroundColor: brand.white,
    gap: space.md,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, color: brand.text },
  total: { fontSize: 20, fontWeight: '800', color: brand.green },
  checkout: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
