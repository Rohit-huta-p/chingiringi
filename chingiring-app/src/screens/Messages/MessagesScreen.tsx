import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';

/**
 * MessagesScreen — inbox placeholder (Phase 0 scaffolding).
 *
 * Registered in both the buyer and seller stacks and reached from the header
 * messages icon. The real per-seller inbox (list → thread → composer) lands in
 * Phase 4; this stub just makes the route and its entry points live.
 */
export function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={24} color={Colors.navy} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MessageCircle size={40} color={Colors.primary} strokeWidth={1.8} />
        </View>
        <Text style={styles.emptyTitle}>Messaging is coming soon</Text>
        <Text style={styles.emptySub}>
          You'll be able to chat with sellers about their products and live streams right here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.navy },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.navy },
  emptySub: {
    fontSize: 13.5,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 280,
  },
});
