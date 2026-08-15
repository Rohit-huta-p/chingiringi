import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Module-level navigation ref shared by RootNavigator (attached to the
 * NavigationContainer) and AuthGateContext (navigates to auth screens from
 * outside the component tree).
 */
export const navigationRef = createNavigationContainerRef<any>();
