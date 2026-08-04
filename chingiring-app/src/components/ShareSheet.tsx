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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MessageCircle, Send, MessageSquare, Mail, Share2, X,
} from 'lucide-react-native';
import { Colors, Fonts, Spacing } from '../constants/theme';

type ShareSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;   // item name, e.g. product/store name
  url: string;      // the tracked link, already built by the caller
  onShared: (channel: string) => void; // called AFTER a channel's link is opened
};

type ChannelDef = {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  link: string;
};

// lucide-react-native ships no brand icons (Twitter/Facebook were dropped
// upstream) — those two fall back to the generic Share2 glyph per spec.
function buildChannels(title: string, url: string): ChannelDef[] {
  const text = `${title}\n${url}`;
  return [
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, link: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { key: 'telegram', label: 'Telegram', icon: Send, link: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
    { key: 'sms', label: 'SMS', icon: MessageSquare, link: `sms:?body=${encodeURIComponent(text)}` },
    { key: 'x', label: 'X', icon: Share2, link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
    { key: 'facebook', label: 'Facebook', icon: Share2, link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { key: 'email', label: 'Email', icon: Mail, link: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}` },
  ];
}

// Bottom-sheet channel picker for share-to-earn. No "Copy" row on purpose —
// copying a link isn't a verifiable share, so it must never credit coins.
// Credit only fires (via onShared) once a channel's link actually opens.
export const ShareSheet: React.FC<ShareSheetProps> = ({
  visible, onClose, title, url, onShared,
}) => {
  const insets = useSafeAreaInsets();
  const channels = buildChannels(title, url);

  const handlePress = async (channel: ChannelDef) => {
    try {
      const supported = await Linking.canOpenURL(channel.link);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(channel.link);
      onShared(channel.key);
      onClose();
    } catch {
      Alert.alert(`Can’t open ${channel.label}`, 'Is the app installed?');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Share &amp; Earn 100 CR</Text>
              {title ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>{title}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={8}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {channels.map((channel) => (
            <TouchableOpacity
              key={channel.key}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => handlePress(channel)}
            >
              <View style={styles.iconWrap}>
                <channel.icon size={20} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.rowLabel}>{channel.label}</Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
});

export default ShareSheet;
