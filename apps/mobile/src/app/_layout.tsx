import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CartProvider } from '@/lib/cart';
import { brand } from '@/lib/theme';

// Root navigator: the tab group plus pushed product / checkout / order screens.
export default function RootLayout() {
  return (
    <CartProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: brand.green },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: brand.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="produto/[slug]" options={{ title: 'Produto' }} />
        <Stack.Screen name="checkout" options={{ title: 'Finalizar compra' }} />
        <Stack.Screen name="pedido/[ref]" options={{ title: 'Encomenda' }} />
      </Stack>
    </CartProvider>
  );
}
