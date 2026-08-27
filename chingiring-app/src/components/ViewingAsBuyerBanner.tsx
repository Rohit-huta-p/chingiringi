import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Store } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

/**
 * Persistent banner shown when a seller is browsing the app "as a buyer"
 * (useAuthStore.viewAsBuyer — see RootNavigator). It owns the top safe-area
 * inset (the buyer subtree below it is rendered with top inset = 0), and keeps
 * the seller from getting stranded in the buyer navigator: one tap switches back.
 */
export function ViewingAsBuyerBanner({ onSwitchBack }: { onSwitchBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.iconWrap}>
        <Store size={16} color={Colors.orange} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>You're shopping as a buyer</Text>
        <Text style={styles.sub}>Your seller account stays active</Text>
      </View>
      <TouchableOpacity
        style={styles.btn}
        onPress={onSwitchBack}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Switch back to selling"
      >
        <Text style={styles.btnText}>Switch back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 11,
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FADFC7',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: 'rgba(249,115,22,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.navy, lineHeight: 15 },
  sub: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 14, marginTop: 1 },
  btn: {
    marginLeft: 10,
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnText: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.textWhite },
});
