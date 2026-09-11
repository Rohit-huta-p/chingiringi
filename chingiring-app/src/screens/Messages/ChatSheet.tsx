import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import type { ChatOtherParty, ChatProduct } from '../../api/chat';
import { ChatScreen } from './ChatScreen';

/**
 * ChatSheet — the seller chat presented as a slide-up bottom sheet with a gap
 * above (the dimmed screen behind stays visible). Used by the live viewer so a
 * product chat opens as a sheet on web AND native: it's a React Native Modal,
 * so it behaves identically everywhere — unlike a native-stack `formSheet`,
 * which react-native-web can't render as a sheet.
 */
export const ChatSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  conversationId?: string;
  otherParty?: ChatOtherParty;
  title?: string;
  product?: ChatProduct | null;
  prefill?: string;
}> = ({ visible, onClose, conversationId, otherParty, title, product, prefill }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tap the gap above the sheet to dismiss. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { marginTop: insets.top + 44 }]}>
          <View style={styles.handle} />
          {visible ? (
            <ChatScreen
              key={conversationId}
              embedded
              onClose={onClose}
              conversationId={conversationId}
              otherParty={otherParty}
              title={title}
              product={product ?? null}
              prefill={prefill}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB', marginTop: 8,
  },
});
