import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { useAuthStore } from '../store';
import AuthNavigator from './AuthNavigator';
import ResponsiveNavigator from './DrawerNavigator';
import AdminNavigator from './AdminNavigator';
import { linking, documentTitle } from './linking';
import { WelcomeModal } from '../components/WelcomeModal';

/** Module-level container ref so non-component code (push-tap handler) can navigate. */
export const navigationRef = createNavigationContainerRef<any>();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  return (
    <>
      <NavigationContainer ref={navigationRef} linking={linking} documentTitle={documentTitle}>
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
