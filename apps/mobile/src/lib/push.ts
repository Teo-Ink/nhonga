import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerPushToken, unregisterPushToken } from './api';

// Show alerts while the app is foregrounded (SDK 57 behaviour shape).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

async function getToken(): Promise<string | null> {
  const projectId = easProjectId();
  try {
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return t.data;
  } catch {
    // No EAS projectId configured (needs `eas init`) or offline — the alert
    // still reaches the user by SMS, so this is a soft failure.
    return null;
  }
}

/**
 * Ask for permission (once) and register this device's Expo push token for the
 * signed-in user. Native devices only — Expo web and simulators can't receive
 * push. Returns the token, or null when unavailable. Best-effort throughout.
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Alertas Nhonga',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#007A5E',
    });
  }

  let granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;

  const token = await getToken();
  if (!token) return null;
  try {
    await registerPushToken(token, Platform.OS);
  } catch {
    /* API unreachable — the token registers on the next login */
  }
  return token;
}

/** Drop this device's token on sign-out so alerts stop. Best-effort. */
export async function unregisterForPush(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const token = await getToken();
  if (token) await unregisterPushToken(token);
}
