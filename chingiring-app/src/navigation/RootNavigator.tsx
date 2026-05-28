import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store';
import AuthNavigator from './AuthNavigator';
import ResponsiveNavigator from './DrawerNavigator';
import AdminNavigator from './AdminNavigator';
import { linking, documentTitle } from './linking';

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  return (
    <NavigationContainer linking={linking} documentTitle={documentTitle}>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : user?.role === 'admin' ? (
        <AdminNavigator />
      ) : (
        <ResponsiveNavigator />
      )}
    </NavigationContainer>
  );
}
