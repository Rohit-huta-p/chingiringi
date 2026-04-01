import React, { useEffect } from 'react';
import 'react-native-gesture-handler'; // Required for react-navigation Drawer
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store';
import { View, ActivityIndicator } from 'react-native';

const queryClient = new QueryClient();

export default function App() {
  const { isReady, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  if (!isReady) {
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
