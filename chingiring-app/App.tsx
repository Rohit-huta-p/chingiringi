import React, { useEffect, useState } from 'react';
// react-native-gesture-handler is imported in DrawerNavigator (desktop only)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store';
import { configureNotificationHandler, addNotificationResponseListener, registerForPush } from './src/lib/push';
import { View, Text, Linking } from 'react-native';
import { initReferralCapture } from './src/lib/referralCapture';
import { parseReferralCode } from './src/utils/referralLink';
import { useFonts } from 'expo-font';
import { SplashAnimation } from './src/components/SplashAnimation';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ── Global font: Outfit applied to every <Text> with zero per-file changes ──
// Screens that need bold/semibold should use fontFamily from src/constants/theme.ts
// e.g. { fontFamily: Fonts.bold } instead of { fontWeight: '700' }
// (React Native doesn't auto-select font weight variants from a family name)

export default function App() {
  const { hydrate, isAuthenticated, user } = useAuthStore();
  const [splashDone, setSplashDone] = useState(false);

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  useEffect(() => {
    hydrate();
  }, []);

  // Capture a referral code from the entry URL (web location / native deep link)
  // and from links opened while the app runs, so a guest keeps it until sign-in.
  useEffect(() => {
    initReferralCapture();
    const sub = Linking.addEventListener('url', ({ url }) => {
      const code = parseReferralCode(url);
      if (code) useAuthStore.getState().setPendingReferralCode(code);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    configureNotificationHandler();
    const sub = addNotificationResponseListener();
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.notificationPrefs?.push !== false) {
      registerForPush();
    }
  }, [isAuthenticated]);

  // Apply Outfit as the default font for every Text in the app.
  // Each screen uses Fonts.bold / Fonts.semiBold from theme.ts for heavier weights.
  if (fontsLoaded) {
    // @ts-ignore — RN supports Text.defaultProps as a global override
    Text.defaultProps = { ...(Text.defaultProps ?? {}), style: { fontFamily: 'Outfit_400Regular' } };
  }

  // Show the animated splash only for its own fixed timeline (+ fonts) —
  // auth hydration is intentionally NOT awaited here anymore. It used to
  // block here too, which meant a cold/slow backend response to /auth/me
  // froze the splash on its last frame for as long as that request took.
  // RootNavigator has its own `!isReady` loading state, and the Home
  // screen skeleton-loads its own data, so we hand off to those instead.
  if (!splashDone || !fontsLoaded) {
    return (
      <View style={{ flex: 1 }}>
        <SplashAnimation onComplete={() => setSplashDone(true)} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
