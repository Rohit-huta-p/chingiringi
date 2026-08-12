import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm. react-native-web's `Alert.alert` is a NO-OP (its
 * onPress buttons never fire), so any confirm-then-act flow silently dies on
 * web. Web falls back to the browser's window.confirm; native uses a two-button
 * Alert. Returns a promise that resolves true when confirmed.
 */
export function confirmAsync(
  title: string,
  message: string,
  opts: { confirmLabel?: string; destructive?: boolean } = {},
): Promise<boolean> {
  const { confirmLabel = 'OK', destructive = false } = opts;
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

/** Cross-platform notice — Alert.alert is a no-op on web, so use window.alert there. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert([title, message].filter(Boolean).join('\n\n'));
  } else {
    Alert.alert(title, message);
  }
}
