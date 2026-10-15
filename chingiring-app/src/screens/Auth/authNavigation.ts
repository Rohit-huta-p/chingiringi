// Auth screens mount in two navigators: AuthNavigator (logged-out root, routes
// Login / Signup / …) and the guest stacks inside the buyer navigators, which
// register the same screens as AuthLogin / AuthSignup.
const GUEST_ALIASES: Record<string, string> = { Login: 'AuthLogin', Signup: 'AuthSignup' };

/**
 * Go to an auth screen, returning to it if it's already in the stack. In React
 * Navigation 7 `navigate` always pushes, so Sign in ⇄ Create account toggles
 * would otherwise pile up screens (and Android back would replay them).
 */
export function goToAuthScreen(navigation: any, target: string, params?: object) {
  const state = navigation.getState?.();
  const names: string[] = state?.routeNames ?? [];
  const name = names.includes(target) ? target : (GUEST_ALIASES[target] ?? target);
  const inStack = (state?.routes ?? []).some((r: any) => r.name === name);
  if (inStack) navigation.popTo(name, params);
  else navigation.navigate(name, params);
}

/**
 * Back from a sub-step. A screen opened straight from a URL on web has no
 * history, so replace it with `fallback` instead of doing nothing.
 */
export function authBack(navigation: any, fallback = 'Login') {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.replace(fallback);
}
