import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FavoritesProvider } from '@/lib/favorites';
import { Platform } from 'react-native';
import { sendCrashReport } from '@/lib/api';
import { createCrashReporter, installCrashHandler } from '@/lib/crash-report';
import { brand } from '@/lib/theme';
import appConfig from '../../app.json';

// Unhandled JavaScript errors are reported to the Nhonga API (OPS-06).
// Installed once, when the app starts; skipped in development, where the red
// box already shows the error.
if (!__DEV__) {
  installCrashHandler(
    createCrashReporter(
      { platform: `${Platform.OS} ${Platform.Version}`, release: appConfig.expo.version },
      sendCrashReport,
    ),
  );
}

// Root navigator: the tab group plus a pushed product-detail screen.
export default function RootLayout() {
  return (
    <FavoritesProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: brand.green },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: brand.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="produto/[slug]" options={{ title: 'Produto' }} />
      </Stack>
    </FavoritesProvider>
  );
}
