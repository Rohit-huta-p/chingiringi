import { useRef } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store';
import ResponsiveNavigator from './DrawerNavigator';
import AdminNavigator from './AdminNavigator';
import { linking, documentTitle } from './linking';
import { WelcomeModal } from '../components/WelcomeModal';
import { navigationRef } from '../lib/navigationRef';
import { AuthGateProvider } from '../context/AuthGateContext';

function trackScreen(name: string) {
  if (Platform.OS !== 'web') return;
  (window as any).gtag?.('event', 'page_view', { page_title: name, page_path: '/' + name });
}

export default function RootNavigator() {
  const user = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);
  const routeNameRef = useRef<string | undefined>();

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        documentTitle={documentTitle}
        onReady={() => { routeNameRef.current = navigationRef.getCurrentRoute()?.name; }}
        onStateChange={() => {
          const current = navigationRef.getCurrentRoute()?.name;
          if (current !== routeNameRef.current) {
            trackScreen(current ?? '');
            routeNameRef.current = current;
          }
        }}
      >
        {!isReady ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        ) : user?.role === 'admin' ? (
          <AdminNavigator />
        ) : (
          <AuthGateProvider>
            <ResponsiveNavigator />
          </AuthGateProvider>
        )}
      </NavigationContainer>
      {user && user?.role !== 'admin' ? <WelcomeModal /> : null}
    </>
  );
}
