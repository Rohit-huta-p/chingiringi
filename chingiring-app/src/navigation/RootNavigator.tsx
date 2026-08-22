import { useRef } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store';
import AuthNavigator from './AuthNavigator';
import AdminNavigator from './AdminNavigator';
import BuyerTabNavigator from './BuyerTabNavigator';
import SellerTabNavigator from './SellerTabNavigator';
import RoleSelectionScreen from '../screens/Auth/RoleSelectionScreen';
import { linking, documentTitle } from './linking';
import { WelcomeModal } from '../components/WelcomeModal';
import { navigationRef } from '../lib/navigationRef';
import { AuthGateProvider } from '../context/AuthGateContext';
import { ReferralModal } from '../components/ReferralModal';

// Legacy responsive navigator (web + existing buyer-style mobile flow).
// Still used by any path not yet forked (e.g. web clients).
import ResponsiveNavigator from './DrawerNavigator';

function trackScreen(name: string) {
  if (Platform.OS !== 'web') return;
  (window as any).gtag?.('event', 'page_view', { page_title: name, page_path: '/' + name });
}

export default function RootNavigator() {
  const user    = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);
  const routeNameRef = useRef<string | undefined>(undefined);

  // Resolve which top-level navigator to render.
  // Priority: loading → unauthed → admin → buyer → seller → role picker → legacy
  function resolveNavigator() {
    if (!isReady) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (!user) {
      return <AuthNavigator />;
    }

    if (user.role === 'admin') {
      return <AdminNavigator />;
    }

    if (user.role === 'buyer') {
      return (
        <AuthGateProvider>
          <BuyerTabNavigator />
          <ReferralModal />
        </AuthGateProvider>
      );
    }

    if (user.role === 'seller') {
      return (
        <AuthGateProvider>
          <SellerTabNavigator />
        </AuthGateProvider>
      );
    }

    // role === null, undefined, or legacy 'user' value → prompt for role selection
    // (new sign-ups land here after OTP/Google auth)
    if (user.role == null || user.role === ('user' as any)) {
      return <RoleSelectionScreen />;
    }

    // Fallback: existing desktop/web responsive navigator
    return (
      <AuthGateProvider>
        <ResponsiveNavigator />
        <ReferralModal />
      </AuthGateProvider>
    );
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        documentTitle={documentTitle}
        onReady={() => {
          routeNameRef.current = navigationRef.getCurrentRoute()?.name;
        }}
        onStateChange={() => {
          const current = navigationRef.getCurrentRoute()?.name;
          if (current !== routeNameRef.current) {
            trackScreen(current ?? '');
            routeNameRef.current = current;
          }
        }}
      >
        {resolveNavigator()}
      </NavigationContainer>
      {user && user?.role !== 'admin' ? <WelcomeModal /> : null}
    </>
  );
}
