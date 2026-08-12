import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle, Send, MessageSquare, Mail, ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { sharesAPI } from '../api/shares';
import { Colors, Fonts, Spacing } from '../constants/theme';

type ShareSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;   // item name
  url: string;      // the tracked link, built by the caller
  onShared: (channel: string) => void; // called AFTER a channel's link opens
  imageUrl?: string;   // preview thumbnail (product/store image)
  discount?: string;   // preview chip, e.g. "32% off"
  coins?: number;      // reward per share fallback — server value wins (defaults to 50)
};

type Channel = {
  key: string;
  label: string;
  color: string;
  link: string;
  Icon?: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  letter?: string;
};

// lucide-react-native ships no brand icons (Twitter/Facebook were dropped
// upstream) — X and Facebook render a bold letter glyph instead.
function buildChannels(title: string, url: string): Channel[] {
  const text = `${title}\n${url}`;
  return [
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', Icon: MessageCircle, link: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { key: 'telegram', label: 'Telegram', color: '#229ED9', Icon: Send, link: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
    { key: 'sms', label: 'Messages', color: '#14B8A6', Icon: MessageSquare, link: `sms:?body=${encodeURIComponent(text)}` },
    { key: 'x', label: 'X', color: '#14171A', letter: '\u{1D54F}', link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
    { key: 'facebook', label: 'Facebook', color: '#1877F2', letter: 'f', link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { key: 'email', label: 'Email', color: '#6B7280', Icon: Mail, link: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}` },
  ];
}

// Item-preview share menu — the item you're sending on top, then an explicit
// channel list. NO "Copy" row on purpose: copying a link isn't a verifiable
// share, so it must never credit coins. Credit fires (via onShared) only once
// a channel's link actually opens.
export const ShareSheet: React.FC<ShareSheetProps> = ({
  visible, onClose, title, url, onShared, imageUrl, discount, coins = 50,
}) => {
  const insets = useSafeAreaInsets();
  const channels = buildChannels(title, url);
  // Reward amount is server-configured (AdminSettings.coinsPerShare) — the
  // `coins` prop above is only a fallback for before this query resolves.
  const { data: quota } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota, staleTime: 60_000 });
  const coinAmount = quota?.data?.coinsPerShare ?? coins;

  const handlePress = async (channel: Channel) => {
    try {
      const supported = await Linking.canOpenURL(channel.link);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(channel.link);
      onShared(channel.key);
      onClose();
    } catch {
      Alert.alert(`Can't open ${channel.label}`, 'Is the app installed?');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}
          onPress={() => {}}
        >
          <View style={styles.handle} />

          <View style={styles.preview}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]} />
            )}
            <View style={styles.previewBody}>
              <Text style={styles.previewName} numberOfLines={1}>{title}</Text>
              <View style={styles.previewMeta}>
                {discount ? <Text style={styles.off}>{discount}</Text> : null}
                <Text style={styles.earn}>Earn {coinAmount} CR</Text>
              </View>
            </View>
          </View>

          <View style={styles.list}>
            {channels.map((channel, i) => {
              const Icon = channel.Icon;
              return (
                <TouchableOpacity
                  key={channel.key}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  activeOpacity={0.7}
                  onPress={() => handlePress(channel)}
                >
                  <View style={[styles.chip, { backgroundColor: channel.color }, channel.key === 'x' && styles.chipX]}>
                    {Icon ? (
                      <Icon size={19} color="#fff" strokeWidth={2} />
                    ) : (
                      <Text style={styles.chipLetter}>{channel.letter}</Text>
                    )}
                  </View>
                  <Text style={styles.rowLabel}>{channel.label}</Text>
                  <ChevronRight size={18} color={Colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 11,
    backgroundColor: Colors.border,
  },
  thumbPlaceholder: {
    backgroundColor: Colors.primaryLight10,
  },
  previewBody: {
    flex: 1,
  },
  previewName: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.text,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  off: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.success,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  earn: {
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    color: '#B26F0C',
  },
  list: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipX: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  chipLetter: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.extraBold,
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
});

export default ShareSheet;
