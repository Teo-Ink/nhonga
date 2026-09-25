import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { brand } from '@/lib/theme';

// Root navigator: the tab group plus a pushed product-detail screen.
export default function RootLayout() {
  return (
    <>
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
      </Stack>
    </>
  );
}
