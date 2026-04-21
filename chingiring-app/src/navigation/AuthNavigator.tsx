import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

import { LoginScreen } from '../screens/Auth/LoginScreen';
import { MobileLoginScreen } from '../screens/Auth/MobileLoginScreen';
import { SignupScreen } from '../screens/Auth/SignupScreen';
import { OTPVerificationScreen } from '../screens/Auth/OTPVerificationScreen';
import { MobileOTPScreen } from '../screens/Auth/MobileOTPScreen';
import { ForgotPasswordScreen } from '../screens/Auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/Auth/ResetPasswordScreen';

const Stack = createNativeStackNavigator();
const isMobile = Platform.OS !== 'web';

export default function AuthNavigator() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isMobile ? '#f0f4fa' : Colors.background }} edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: isMobile ? '#f0f4fa' : Colors.background } }}>
        <Stack.Screen name="Login" component={isMobile ? MobileLoginScreen : LoginScreen} />
        <Stack.Screen name="PasswordLogin" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="OTPVerification" component={isMobile ? MobileOTPScreen : OTPVerificationScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
}
