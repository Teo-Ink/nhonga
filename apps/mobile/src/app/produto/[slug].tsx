import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getProduct, recordEvent, formatMZN, type ProductDetail } from '@/lib/api';
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
        <Text style={styles.muted}>Anúncio não encontrado.</Text>
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
    try {
      await Share.share({ message: `${product.title} — ${price} · Nhonga` });
    } catch {
      /* cancelled */
    }
  }

  const hasContact = Boolean(whatsapp || phone);

  return (
    <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: product.title }} />
      <View style={styles.media}>
        {hero ? <Image source={{ uri: hero.url }} style={styles.image} resizeMode="cover" /> : null}
      </View>

      <Text style={styles.title}>{product.title}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}</Text>
        {product.compareAtCents ? (
          <Text style={styles.was}>{formatMZN(product.compareAtCents)}</Text>
        ) : null}
      </View>
      <Text style={styles.seller}>
        {product.vendor.displayName}
        {product.location ? ` · ${product.location}` : ''}
      </Text>

      {/* Contact block */}
      {whatsapp ? (
        <Pressable style={[styles.contactBtn, styles.wa]} onPress={openWhatsApp}>
          <Text style={styles.contactText}>Contactar pelo WhatsApp</Text>
        </Pressable>
      ) : null}
      {phone ? (
        <Pressable style={[styles.contactBtn, styles.call]} onPress={call}>
          <Text style={styles.contactText}>Ligar</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.contactBtn, styles.shareBtn]} onPress={share}>
        <Text style={styles.shareText}>Partilhar</Text>
      </Pressable>
      {!hasContact ? (
        <Text style={styles.muted}>Este vendedor não deixou contacto.</Text>
      ) : null}
      <Text style={styles.safe}>
        Dica: encontre-se num local público e verifique o produto antes de pagar. Nunca envie
        dinheiro adiantado nem partilhe códigos ou PIN.
      </Text>

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
  seller: { color: brand.muted, marginBottom: space.sm },
  contactBtn: {
    height: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  wa: { backgroundColor: '#25D366' },
  call: { backgroundColor: brand.green },
  contactText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  shareBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: brand.border },
  shareText: { color: brand.text, fontWeight: '600', fontSize: 15 },
  safe: { marginTop: space.sm, fontSize: 12, color: brand.muted, lineHeight: 18 },
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
