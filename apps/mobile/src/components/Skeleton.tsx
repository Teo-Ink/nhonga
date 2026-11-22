import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { brand, radius, space } from '@/lib/theme';

// A single pulsing placeholder block. Loops a gentle opacity fade so loading
// states feel alive without a spinner. Opacity animates on the native driver
// (also fine on RN Web).
export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.block, style, { opacity: pulse }]} />;
}

// A card-shaped skeleton matching ProductGridCard (image + two text lines).
export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton style={styles.media} />
      <Skeleton style={styles.line} />
      <Skeleton style={styles.lineShort} />
    </View>
  );
}

// A full loading grid: `count` card skeletons wrapped into `numColumns` columns.
export function ProductGridSkeleton({
  numColumns = 2,
  count = 8,
}: {
  numColumns?: number;
  count?: number;
}) {
  return (
    <View style={styles.grid} accessibilityLabel="A carregar anúncios">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.cell, { width: `${100 / numColumns}%` }]}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: brand.surfaceSunken, borderRadius: radius.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: space.md },
  cell: { paddingRight: space.md, marginBottom: space.md },
  card: {},
  media: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  line: { marginTop: space.sm, height: 13, width: '85%', borderRadius: radius.sm },
  lineShort: { marginTop: 6, height: 15, width: '55%', borderRadius: radius.sm },
});
