/**
 * GoLiveTabScreen — "Go Live" tab for sellers.
 *
 * Shows a "Start Streaming" hero card and a GoLiveModal.
 * GoLiveModal calls POST /api/streams (via createStream), then navigates
 * to BroadcasterScreen with { streamId, roomUrl, broadcasterToken, title }.
 *
 * Navigation params: none (standalone tab)
 * Stack screens reachable: BroadcasterScreen
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Radio, Video, X, ChevronRight, Zap } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { createStream } from '../../api/streams';
import apiClient from '../../api/client';

// ── Fetch seller's store ID (needed for createStream) ─────────────────────
async function fetchMyStoreId(): Promise<string | null> {
  try {
    const res = await apiClient.get('/api/stores/mine');
    const store = res.data?.store ?? res.data?.data;
    return store?._id ?? null;
  } catch {
    return null;
  }
}

// ── GoLiveModal ───────────────────────────────────────────────────────────

interface GoLiveModalProps {
  visible: boolean;
  onClose: () => void;
}

const GoLiveModal: React.FC<GoLiveModalProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Give your stream a title before going live.');
      return;
    }
    setLoading(true);
    try {
      // Fetch the seller's store ID first (needed by the backend to link stream→store)
      const storeId = await fetchMyStoreId();

      // POST /api/streams → { streamId, broadcasterToken, roomUrl }
      const { streamId, broadcasterToken, roomUrl } = await createStream({
        title: trimmed,
        ...(storeId ? { storeId } : {}),
      });

      onClose();
      setTitle('');

      // Navigate to BroadcasterScreen with all required params
      navigation.navigate('BroadcasterScreen', {
        streamId,
        broadcasterToken,
        roomUrl,
        title: trimmed,
      });
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to start stream. Try again.';
      Alert.alert('Could not go live', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setTitle('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={modal.root}>
          {/* Header */}
          <View style={modal.header}>
            <View style={modal.headerDot} />
            <Pressable onPress={handleClose} hitSlop={12} style={modal.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={modal.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Icon + title */}
            <View style={modal.iconCircle}>
              <Radio size={32} color={Colors.orange} />
            </View>
            <Text style={modal.title}>Go Live</Text>
            <Text style={modal.sub}>
              Give your stream a title so viewers know what you're selling.
            </Text>

            {/* Stream title input */}
            <Text style={modal.label}>Stream title</Text>
            <TextInput
              style={modal.input}
              placeholder="e.g. Summer sale — 50% off fashion!"
              placeholderTextColor={Colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="done"
              autoFocus
            />
            <Text style={modal.charCount}>{title.length}/80</Text>

            {/* Tips */}
            <View style={modal.tips}>
              {[
                'Keep title short and specific (under 50 chars)',
                'Mention the category or deal type',
                'Streams with titles get 3× more viewers',
              ].map((tip) => (
                <View key={tip} style={modal.tipRow}>
                  <Zap size={13} color={Colors.orange} />
                  <Text style={modal.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* CTA */}
          <View style={modal.footer}>
            <Pressable
              style={[modal.startBtn, (!title.trim() || loading) && modal.startBtnDisabled]}
              onPress={handleStart}
              disabled={!title.trim() || loading}
              accessibilityRole="button"
              accessibilityLabel="Start Streaming"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Radio size={18} color="#fff" />
                  <Text style={modal.startBtnText}>Start Streaming</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── GoLiveTabScreen ───────────────────────────────────────────────────────

export const GoLiveTabScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Video size={44} color={Colors.orange} />
          </View>
          <Text style={styles.heroTitle}>Start a Live Stream</Text>
          <Text style={styles.heroSub}>
            Connect with your customers in real-time. Show products, answer questions, and boost your sales.
          </Text>

          <Pressable
            style={styles.liveBtn}
            onPress={() => setModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Go Live"
          >
            <Radio size={20} color="#fff" />
            <Text style={styles.liveBtnText}>Go Live</Text>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Feature bullets */}
        <View style={styles.featureList}>
          {[
            { icon: '🎥', title: 'Camera preview', sub: 'See yourself before going live' },
            { icon: '💬', title: 'Live chat', sub: 'Answer buyer questions in real-time' },
            { icon: '❤️', title: 'Reactions', sub: 'Viewers send hearts to show love' },
            { icon: '📦', title: 'Product tags', sub: 'Tag products for instant checkout' },
          ].map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.icon}</Text>
              <View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <GoLiveModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 20 },

  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.text, textAlign: 'center' },
  heroSub: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 21,
  },
  liveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
    marginTop: 8,
  },
  liveBtnText: { flex: 1, fontSize: 16, fontFamily: Fonts.bold, color: '#fff', textAlign: 'center' },

  featureList: { gap: 12 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  featureEmoji: { fontSize: 24 },
  featureTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  featureSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
});

const modal = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerDot: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.backgroundGrey, alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 24, gap: 12 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 4,
  },
  title: { fontSize: 24, fontFamily: Fonts.extraBold, color: Colors.text, textAlign: 'center' },
  sub: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 21, marginBottom: 8,
  },
  label: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.textSecondary, letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, fontFamily: Fonts.regular, color: Colors.text,
    backgroundColor: Colors.surface,
  },
  charCount: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.border, textAlign: 'right', marginTop: -6 },
  tips: { gap: 8, marginTop: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18 },
  footer: { padding: 20, paddingTop: 12 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 28,
  },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
});
