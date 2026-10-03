import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '@/lib/favorites';
import { shadow } from '@/lib/theme';

// Heart toggle that floats over a listing's image, matching the web favourite
// button. Tapping it never triggers the card's own press (it stops there).
export function FavoriteButton({ productId, size = 34 }: { productId: string; size?: number }) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(productId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? 'Remover dos favoritos' : 'Guardar nos favoritos'}
      hitSlop={8}
      onPress={() => toggle(productId)}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { transform: [{ scale: 0.88 }] },
      ]}>
      <Ionicons
        name={on ? 'heart' : 'heart-outline'}
        size={Math.round(size * 0.55)}
        color={on ? '#e0245e' : '#3a352c'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    ...shadow.sm,
  },
});
