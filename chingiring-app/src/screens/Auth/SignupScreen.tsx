import { View, Text, StyleSheet } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { referralsAPI } from '../../api/referrals';
// Removed secureStore imports for HTTP only flow
import { useAuthStore } from '../../store';

export const SignupScreen = ({ navigation, route }: any) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(String(route?.params?.ref ?? ''));
  const [errorMsg, setErrorMsg] = useState('');

  const hydrate = useAuthStore((state) => state.hydrate);

  const signupMutation = useMutation({
    mutationFn: authAPI.signup,
    onSuccess: async () => {
      setErrorMsg('');
      // Capture the referral BEFORE hydrate — hydrate() triggers the native
      // claim(), which can only confirm a referral that's already pending.
      const code = referralCode.trim();
      if (code) { try { await referralsAPI.apply(code); } catch { /* bad code: ignore, signup still succeeds */ } }
      await hydrate();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Signup failed. Please try again.');
    }
  });

  const handleSignup = () => {
    setErrorMsg('');
    // Only send what's provided
    signupMutation.mutate({
      name,
      username,
      email: email || undefined,
      phone: phone || undefined,
      password,
    });
  };

  const Header = (
    <>
      <View style={styles.logoPlaceholder} />
      <Text style={styles.title}>Create Account</Text>
    </>
  );

  const Subtitle = (
    <Text style={styles.subtitle}>Join Chingiringi and start earning cashback</Text>
  );

  return (
    <AuthLayout title={Header} subtitle={Subtitle}>
      <Input label="Full Name" placeholder="Your name" value={name} onChangeText={setName} />
      <Input label="Username" placeholder="Your username" value={username} onChangeText={setUsername} />
      <Input label="Email" placeholder="your@email.com" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Input label="Phone Number" placeholder="10-digit mobile number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Input label="Password" placeholder="At least 6 characters" secureTextEntry value={password} onChangeText={setPassword} />
      <Input label="Referral code (optional)" placeholder="e.g. A1B2C3D4" autoCapitalize="characters" value={referralCode} onChangeText={setReferralCode} />

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <Button
        title="Create Account ->"
        onPress={handleSignup}
        style={styles.mainButton}
        loading={signupMutation.isPending}
        disabled={signupMutation.isPending}
      />

      <Text style={styles.termsText}>
        By signing up, you agree to our <Text style={styles.linkText}>Terms of Service</Text> and <Text style={styles.linkText}>Privacy Policy</Text>
      </Text>

      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Button title="Sign in" variant="text" onPress={() => navigation.navigate('Login')} textStyle={styles.loginText} />
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  mainButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  termsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  loginText: {
    fontWeight: '700',
  },
});
