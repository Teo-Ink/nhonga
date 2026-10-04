import { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { brand, radius, shadow, space } from '@/lib/theme';

export interface GalleryImage {
  url: string;
  alt?: string | null;
}

// A swipeable product image gallery: full-width paging with a counter and dots.
// Falls back to a single image (no controls) when there's only one.
export function ImageGallery({ images }: { images: GalleryImage[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const many = images.length > 1;

  return (
    <View onLayout={onLayout}>
      <View style={styles.box}>
        {width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={styles.scroll}
          >
            {images.map((img, i) => (
              <Image
                key={i}
                source={{ uri: img.url }}
                style={{ width, height: '100%' }}
                resizeMode="cover"
                accessibilityLabel={img.alt ?? undefined}
              />
            ))}
          </ScrollView>
        ) : null}
        {many ? (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {index + 1}/{images.length}
            </Text>
          </View>
        ) : null}
      </View>
      {many ? (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
    ...shadow.md,
  },
  scroll: { flex: 1 },
  counter: {
    position: 'absolute',
    bottom: space.sm,
    right: space.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: brand.border },
  dotOn: { backgroundColor: brand.green, width: 18 },
});
