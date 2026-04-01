import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store';
import AuthNavigator from './AuthNavigator';
import DrawerNavigator from './DrawerNavigator';

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <NavigationContainer>
      {isAuthenticated ? <DrawerNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
