import React, { useEffect } from 'react';
// react-native-gesture-handler is imported in DrawerNavigator (desktop only)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store';
import { View, ActivityIndicator, Text } from 'react-native';
import { useFonts } from 'expo-font';
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
  const { isReady, hydrate } = useAuthStore();

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

  // Apply Outfit as the default font for every Text in the app.
  // Each screen uses Fonts.bold / Fonts.semiBold from theme.ts for heavier weights.
  if (fontsLoaded) {
    // @ts-ignore — RN supports Text.defaultProps as a global override
    Text.defaultProps = { ...(Text.defaultProps ?? {}), style: { fontFamily: 'Outfit_400Regular' } };
  }

  if (!isReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6093f4" />
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
