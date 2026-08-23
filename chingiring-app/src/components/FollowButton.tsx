import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { UserPlus, UserCheck } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

/**
 * FollowButton — the one Follow/Following control used everywhere a store can
 * be followed (StoreDetailScreen's hero band, LiveDiscoveryScreen's stream
 * cards). Kept as a single component so the three states below never drift
 * apart between screens (see mockup "Follow States",
 * claude.ai/code/artifact/1c500789-0ef3-465e-92fb-cf93a18cc2a2):
 *
 *   - Follow    — outlined: white/transparent bg, primary border + text, "+".
 *   - Following — filled: primary bg, white text, "✓".
 *   - Loading   — spinner in place of icon+label, disabled.
 */
interface FollowButtonProps {
  following: boolean;
  loading?: boolean;
  onPress: () => void;
  /** 'default' = full-size (StoreDetailScreen hero band). 'compact' = fits inline on a card (LiveDiscoveryScreen). */
  size?: 'default' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  following, loading = false, onPress, size = 'default', style,
}) => {
  const compact = size === 'compact';
  const iconSize = compact ? 12 : 15;
  const spinnerColor = following ? '#fff' : Colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[
        styles.base,
        compact ? styles.compact : styles.default,
        following ? styles.following : styles.notFollowing,
        loading && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={following ? 'Unfollow store' : 'Follow store'}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : following ? (
        <>
          <UserCheck size={iconSize} color="#fff" />
          <Text style={[styles.text, compact && styles.textCompact, styles.textFollowing]}>Following</Text>
        </>
      ) : (
        <>
          <UserPlus size={iconSize} color={Colors.primary} />
          <Text style={[styles.text, compact && styles.textCompact, styles.textNotFollowing]}>Follow</Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5 },
  default: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18 },
  compact: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, gap: 4 },

  // Follow (not following yet) — outlined.
  notFollowing: { backgroundColor: '#fff', borderColor: Colors.primary },
  // Following — filled.
  following: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  disabled: { opacity: 0.55 },

  text: { fontSize: 13, fontFamily: Fonts.bold },
  textCompact: { fontSize: 11 },
  textNotFollowing: { color: Colors.primary },
  textFollowing: { color: '#fff' },
});

export default FollowButton;
