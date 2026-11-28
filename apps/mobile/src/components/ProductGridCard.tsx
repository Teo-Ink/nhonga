import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMZN, type ProductListItem } from '@/lib/api';
import { FavoriteButton } from './FavoriteButton';
import { brand, radius, space, shadow } from '@/lib/theme';

// A single listing card for the grids (home + favourites). Keeps `flex: 1` so it
// fills its column, with a max width so a lone card on a wide screen stays tidy.
export function ProductGridCard({ item, onPress }: { item: ProductListItem; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
      ]}
      onPress={onPress}
    >
      <View style={styles.media}>
        {item.image ? (
          <Image source={{ uri: item.image.url }} style={styles.image} resizeMode="cover" />
        ) : null}
        {item.featured ? (
          <View style={styles.featured}>
            <Ionicons name="star" size={10} color="#fff" />
            <Text style={styles.featuredText}>Destaque</Text>
          </View>
        ) : null}
        {item.discountPercent ? (
          <View style={[styles.badge, item.featured && styles.badgeBelow]}>
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
  );
}

const styles = StyleSheet.create({
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
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
    ...shadow.sm,
  },
  badgeText: { color: brand.ink, fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },
  badgeBelow: { top: 34 },
  featured: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: brand.green,
    borderRadius: radius.md,
    paddingHorizontal: 7,
    paddingVertical: 2,
    ...shadow.sm,
  },
  featuredText: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 0.2 },
  title: { marginTop: space.sm, fontSize: 13, lineHeight: 17, color: brand.text },
  price: { marginTop: 2, fontSize: 15, fontWeight: '800', color: brand.green, letterSpacing: -0.2 },
  locationRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 2 },
  location: { fontSize: 11, color: brand.muted, flexShrink: 1 },
});
