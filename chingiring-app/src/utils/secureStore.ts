import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// NOTE: Under the Strict Zero-Trust Architecture, we no longer store ANY authentication tokens or PII in client vaults.
// Only safe UI state preferences are allowed.

export async function saveThemePreference(theme: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem('theme', theme);
    return;
  }
  await SecureStore.setItemAsync('theme', theme);
}

export async function getThemePreference() {
  if (Platform.OS === 'web') return localStorage.getItem('theme');
  return await SecureStore.getItemAsync('theme');
}

