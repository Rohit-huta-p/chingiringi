import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store';
import AuthNavigator from './AuthNavigator';
import ResponsiveNavigator from './DrawerNavigator';

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <NavigationContainer>
      {isAuthenticated ? <ResponsiveNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
