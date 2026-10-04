import { useRef, useState } from 'react';
import {
  Image,
  Pressable,
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

// A swipeable product image gallery: full-width paging with a counter and a
// tappable thumbnail strip (tap a thumb to jump to that image). Falls back to a
// single image (no controls) when there's only one.
export function ImageGallery({ images }: { images: GalleryImage[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goTo = (i: number) => {
    setIndex(i);
    if (width > 0) scrollRef.current?.scrollTo({ x: i * width, animated: true });
  };

  const many = images.length > 1;

  return (
    <View onLayout={onLayout}>
      <View style={styles.box}>
        {width > 0 ? (
          <ScrollView
            ref={scrollRef}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbs}
        >
          {images.map((img, i) => (
            <Pressable
              key={i}
              onPress={() => goTo(i)}
              style={[styles.thumb, i === index && styles.thumbOn]}
              accessibilityRole="button"
              accessibilityLabel={`Ver imagem ${i + 1}`}
            >
              <Image source={{ uri: img.url }} style={styles.thumbImg} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
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
  thumbs: { gap: space.sm, paddingVertical: space.sm, paddingRight: space.sm },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbOn: { borderColor: brand.green },
  thumbImg: { width: '100%', height: '100%' },
});
