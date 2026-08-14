import { useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { useAuthStore } from '../store';
import AuthNavigator from './AuthNavigator';
import ResponsiveNavigator from './DrawerNavigator';
import AdminNavigator from './AdminNavigator';
import { linking, documentTitle } from './linking';
import { WelcomeModal } from '../components/WelcomeModal';

/** Module-level container ref so non-component code (push-tap handler) can navigate. */
export const navigationRef = createNavigationContainerRef<any>();

function trackScreen(name: string) {
  if (Platform.OS !== 'web') return;
  (window as any).gtag?.('event', 'page_view', { page_title: name, page_path: '/' + name });
}

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
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
        {!isAuthenticated ? (
          <AuthNavigator />
        ) : user?.role === 'admin' ? (
          <AdminNavigator />
        ) : (
          <ResponsiveNavigator />
        )}
      </NavigationContainer>
      {isAuthenticated && user?.role !== 'admin' ? <WelcomeModal /> : null}
    </>
  );
}
