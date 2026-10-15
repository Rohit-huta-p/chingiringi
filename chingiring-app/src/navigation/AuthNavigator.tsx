import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '../screens/Auth/LoginScreen';
import { SignupScreen } from '../screens/Auth/SignupScreen';
import { PhoneAuthScreen } from '../screens/Auth/PhoneAuthScreen';
import { OTPVerificationScreen } from '../screens/Auth/OTPVerificationScreen';
import { ForgotPasswordScreen } from '../screens/Auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/Auth/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

// Logged-out stack. Each screen picks its own layout by width (AuthScaffold:
// hero band on phones — native and narrow web — split card on desktop web).
// No SafeAreaView here: the phone hero runs under the status bar and applies
// the insets itself.
export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PasswordLogin" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="PhoneLogin" component={PhoneAuthScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
