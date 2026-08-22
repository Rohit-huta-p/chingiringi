/**
 * RoleSelectionScreen
 *
 * Shown to authenticated users who have no role yet (role === null/undefined).
 * Two cards: "I'm a Buyer" (blue) and "I'm a Seller" (orange).
 *
 * On tap:
 *  1. PATCH /api/profile/role  { role }
 *  2. setRole() in Zustand → triggers RootNavigator re-render
 *  3. Navigate (via role fork in RootNavigator):
 *     - buyer  → BuyerTabNavigator  (via BuyerOnboarding stub)
 *     - seller → SellerTabNavigator (via BusinessOnboarding stub)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingBag, Store } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import apiClient from '../../api/client';
import { navigationRef } from '../../lib/navigationRef';

type Role = 'buyer' | 'seller';

export default function RoleSelectionScreen() {
  const setRole = useAuthStore((s) => s.setRole);
  const [loading, setLoading] = useState<Role | null>(null);

  const handleSelect = async (role: Role) => {
    if (loading) return;
    setLoading(role);

    try {
      await apiClient.patch('/api/profile/role', { role });
      // Update Zustand — this causes RootNavigator to fork into the correct navigator
      setRole(role);
      // For new buyers: navigate to the onboarding flow once the BuyerTabNavigator
      // has mounted. A short delay lets the navigator tree settle before we push.
      if (role === 'buyer') {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('BuyerOnboarding' as never);
          }
        }, 200);
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Something went wrong. Please try again.';
      Alert.alert('Could not set role', message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.title}>How will you use Chingiringi?</Text>
        <Text style={styles.subtitle}>
          Choose your role — you can always change it later from Settings.
        </Text>

        {/* Cards row */}
        <View style={styles.cards}>
          {/* Buyer card */}
          <TouchableOpacity
            style={[styles.card, styles.cardBuyer]}
            activeOpacity={0.85}
            onPress={() => handleSelect('buyer')}
            disabled={loading !== null}
          >
            {loading === 'buyer' ? (
              <ActivityIndicator size="large" color={Colors.primary} />
            ) : (
              <>
                <View style={[styles.iconCircle, styles.iconCircleBuyer]}>
                  <ShoppingBag size={36} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={[styles.cardTitle, styles.cardTitleBuyer]}>I'm a Buyer</Text>
                <Text style={styles.cardDesc}>
                  Discover live deals, follow your favourite stores, and earn cashback.
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Seller card */}
          <TouchableOpacity
            style={[styles.card, styles.cardSeller]}
            activeOpacity={0.85}
            onPress={() => handleSelect('seller')}
            disabled={loading !== null}
          >
            {loading === 'seller' ? (
              <ActivityIndicator size="large" color={Colors.orange} />
            ) : (
              <>
                <View style={[styles.iconCircle, styles.iconCircleSeller]}>
                  <Store size={36} color={Colors.orange} strokeWidth={2} />
                </View>
                <Text style={[styles.cardTitle, styles.cardTitleSeller]}>I'm a Seller</Text>
                <Text style={styles.cardDesc}>
                  Go live, manage your store, and grow your customer base.
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  cards: {
    width: '100%',
    gap: 16,
  },
  card: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
    // Subtle shadow so the card lifts off the background
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  cardBuyer: {
    backgroundColor: Colors.primaryLight10,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  cardSeller: {
    backgroundColor: '#FFF7ED',       // orange-50
    borderWidth: 2,
    borderColor: '#FDBA74',           // orange-300
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircleBuyer: {
    backgroundColor: '#DBEAFE',       // blue-100
  },
  iconCircleSeller: {
    backgroundColor: '#FFEDD5',       // orange-100
  },
  cardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    marginBottom: 8,
  },
  cardTitleBuyer: {
    color: Colors.primary,
  },
  cardTitleSeller: {
    color: Colors.orange,
  },
  cardDesc: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
