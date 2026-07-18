import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { notificationsAPI } from '../api/notifications';

const PUSH_TOKEN_KEY = 'expoPushToken';

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId
  );
}

/** Foreground behavior: show alerts while the app is open. Call once at startup. */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Tap-response listener. Returns a subscription; caller removes it on unmount.
 *  v1: NO navigation ref exists in this app, so we do NOT deep-link in-app — the OS
 *  already foregrounds the app on tap. Leave the TODO; do not build navigation-ref infra here. */
export function addNotificationResponseListener() {
  if (Platform.OS === 'web') return undefined;
  return Notifications.addNotificationResponseReceivedListener(() => {
    // const data = response.notification.request.content.data; // { type, withdrawalId, orderId, ... }
    // TODO(v1): deep-link via a navigation ref once one is added to RootNavigator.
  });
}

/** Register this device's Expo push token with the backend. Native + real device only. Best-effort. */
export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = getProjectId();
    const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResp.data;
    if (!token) return;

    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    await notificationsAPI.registerPushToken(token, Platform.OS);
  } catch (e) {
    console.warn('registerForPush failed:', (e as any)?.message);
  }
}

/** Unregister this device's token. Call on logout BEFORE clearing auth tokens. Best-effort. */
export async function unregisterForPush(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (token) {
      await notificationsAPI.unregisterPushToken(token);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    }
  } catch (e) {
    console.warn('unregisterForPush failed:', (e as any)?.message);
  }
}
