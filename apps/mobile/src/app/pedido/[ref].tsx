import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { getOrder, formatMZN, type OrderView } from '@/lib/api';
import { brand, radius, space } from '@/lib/theme';

const PENDING = ['pending', 'processing', 'awaiting_user', 'unknown'];

const STATUS_LABEL: Record<string, string> = {
  paid: 'Pago',
  pending: 'A aguardar pagamento',
  processing: 'A processar',
  awaiting_user: 'Confirma no teu telemóvel',
  failed: 'Pagamento falhou',
  cancelled: 'Cancelado',
  unknown: 'A verificar…',
};

export default function OrderScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const o = await getOrder(String(ref));
        if (cancelled) return;
        setOrder(o);
        attempts += 1;
        if (PENDING.includes(o.paymentStatus) && attempts < 12) {
          timer.current = setTimeout(poll, 2500);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    poll();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ref]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Não foi possível carregar a encomenda.</Text>
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} />
      </View>
    );
  }

  const settled = order.paymentStatus === 'paid';
  const pending = PENDING.includes(order.paymentStatus);

  return (
    <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
      <View style={[styles.hero, settled ? styles.heroOk : styles.heroPending]}>
        <Text style={styles.heroIcon}>{settled ? '✓' : '⏳'}</Text>
        <Text style={styles.heroTitle}>
          {settled ? 'Encomenda confirmada!' : 'Encomenda recebida'}
        </Text>
        <Text style={styles.heroRef}>Ref. {order.orderNumber}</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Estado do pagamento</Text>
        <View style={styles.statusPill}>
          {pending ? <ActivityIndicator size="small" color={brand.green} /> : null}
          <Text style={styles.statusValue}>
            {STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
          </Text>
        </View>
      </View>

      {order.items.map((it, i) => (
        <View key={i} style={styles.item}>
          <View style={styles.thumb}>
            {it.imageUrl ? (
              <Image source={{ uri: it.imageUrl }} style={styles.thumbImg} resizeMode="cover" />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {it.title}
            </Text>
            {it.optionsLabel ? <Text style={styles.opts}>{it.optionsLabel}</Text> : null}
            <Text style={styles.qty}>Qtd. {it.quantity}</Text>
          </View>
          <Text style={styles.itemPrice}>{formatMZN(it.lineTotalCents)}</Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatMZN(order.grandTotalCents)}</Text>
      </View>

      <Link href="/" style={styles.home}>
        <Text style={styles.homeText}>Voltar à loja</Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  muted: { color: brand.muted },
  content: { padding: space.lg, gap: space.md },
  hero: { alignItems: 'center', padding: space.xl, borderRadius: radius.lg, gap: space.xs },
  heroOk: { backgroundColor: '#e6f2ee' },
  heroPending: { backgroundColor: brand.surfaceSunken },
  heroIcon: { fontSize: 40 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: brand.text },
  heroRef: { color: brand.muted },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { color: brand.text, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusValue: { color: brand.green, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: brand.border,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
  },
  thumbImg: { width: '100%', height: '100%' },
  itemTitle: { color: brand.text, fontWeight: '500' },
  opts: { color: brand.muted, fontSize: 12 },
  qty: { color: brand.muted, fontSize: 12 },
  itemPrice: { color: brand.text, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: brand.border,
    paddingTop: space.md,
  },
  totalLabel: { fontSize: 16, color: brand.text },
  total: { fontSize: 20, fontWeight: '800', color: brand.green },
  home: { marginTop: space.lg, alignSelf: 'center' },
  homeText: { color: brand.green, fontWeight: '700' },
});
