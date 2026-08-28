/**
 * GoLiveTabScreen — "Go Live" tab for sellers.
 *
 * Unverified stores see a banner linking to StoreVerificationScreen instead
 * of the hero — going live is gated on verification.
 *
 * GoLiveModal calls POST /api/streams (via createStream), then navigates
 * to BroadcasterScreen with { streamId, roomUrl, broadcasterToken, title }.
 * Category + featured products are collected in the sheet and sent as
 * best-effort extra fields on the payload — the backend doesn't persist them
 * yet (createStream only reads title/storeId today), so they're forward
 * compatible rather than functional until that lands.
 *
 * Navigation params: none (standalone tab)
 * Stack screens reachable: BroadcasterScreen, StoreVerification
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Camera, ChevronRight, Radio, Play } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { createStream, getMyStreams, formatStreamMeta } from '../../api/streams';
import { productsAPI, type Product } from '../../api/products';
import { type SellerStore } from '../../api/verification';
import { ImageUploader } from '../../components/ImageUploader';
import { useMyStore } from '../../hooks/useMyStore';

// ── Categories — must match backend STORE_CATEGORIES enum (storeModel.js) ─
const CATEGORIES = ['Fashion', 'Electronics', 'Grocery', 'Food & Cafe', 'Health', 'Jewellery', 'Sports', 'Beauty'];

// ── GoLiveModal (bottom sheet) ──────────────────────────────────────────────

interface GoLiveModalProps {
  visible: boolean;
  onClose: () => void;
  store: SellerStore | null;
}

const GoLiveModal: React.FC<GoLiveModalProps> = ({ visible, onClose, store }) => {
  const navigation = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [category, setCategory] = useState<string>(store?.category ?? '');
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: productsData } = useQuery({
    queryKey: ['seller', 'storeProducts', store?._id],
    queryFn: () => productsAPI.getProducts({ storeId: store!._id, limit: 30 }),
    enabled: visible && !!store?._id,
    staleTime: 60_000,
  });
  const products: Product[] = productsData?.data?.products ?? productsData?.products ?? [];

  const toggleFeatured = (id: string) =>
    setFeaturedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleStart = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Give your stream a title before going live.');
      return;
    }
    setLoading(true);
    try {
      const { streamId, broadcasterToken, roomUrl } = await createStream({
        title: trimmed,
        ...(store?._id ? { storeId: store._id } : {}),
        ...(category ? { category } : {}),
        ...(thumbnail ? { thumbnail } : {}),
        ...(featuredIds.length ? { productIds: featuredIds } : {}),
      } as any);

      onClose();
      setTitle('');
      setThumbnail('');
      setFeaturedIds([]);

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
    setThumbnail('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={modal.root}>
          <View style={modal.handleWrap}>
            <View style={modal.handle} />
          </View>
          <Text style={modal.title}>Start a Live Stream</Text>

          <ScrollView
            contentContainerStyle={modal.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Stream title */}
            <Text style={modal.label}>Stream Title</Text>
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

            {/* Thumbnail */}
            <Text style={[modal.label, { marginTop: 16 }]}>Thumbnail</Text>
            <ImageUploader
              value={thumbnail}
              onChange={setThumbnail}
              folder="stream-thumbnails"
              hint="Your stream's cover on the Live & Videos cards buyers browse. Recommended 1080 × 1440 px (3:4, portrait) — keep the subject centered."
            />

            {/* Category pills */}
            <Text style={[modal.label, { marginTop: 16 }]}>Category</Text>
            <View style={modal.pillRow}>
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[modal.pill, active && modal.pillActive]}
                  >
                    <Text style={[modal.pillText, active && modal.pillTextActive]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Feature products */}
            {products.length > 0 && (
              <>
                <Text style={[modal.label, { marginTop: 16 }]}>Feature Products</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={modal.chipRow}>
                  {products.map((p) => {
                    const active = featuredIds.includes(p._id);
                    return (
                      <Pressable
                        key={p._id}
                        onPress={() => toggleFeatured(p._id)}
                        style={[modal.productChip, active && modal.productChipActive]}
                      >
                        {p.imageUrl ? (
                          <Image source={{ uri: p.imageUrl }} style={modal.productChipImg} />
                        ) : (
                          <View style={[modal.productChipImg, modal.productChipImgFallback]} />
                        )}
                        <Text style={modal.productChipText} numberOfLines={1}>{p.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </ScrollView>

          <View style={modal.footer}>
            <Pressable
              style={[modal.goLiveBtn, (!title.trim() || loading) && modal.goLiveBtnDisabled]}
              onPress={handleStart}
              disabled={!title.trim() || loading}
              accessibilityRole="button"
              accessibilityLabel="Go Live Now"
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={modal.goLiveBtnText}>▶ Go Live Now</Text>}
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
  const navigation = useNavigation<any>();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: store, isLoading } = useMyStore();

  const { data: recentStreams = [] } = useQuery({
    queryKey: ['seller', 'streams', 'golive'],
    queryFn: () => getMyStreams(10),
    staleTime: 60_000,
  });

  const isVerified = store?.verificationStatus === 'verified';

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {!isVerified ? (
          /* ── State A: unverified ── */
          <Pressable
            style={styles.verifyBanner}
            onPress={() => navigation.navigate('StoreVerification', { store })}
          >
            <Text style={styles.verifyBannerText}>⚠️ Verify your store to unlock live streaming</Text>
            <Text style={styles.verifyBannerLink}>Submit your documents →</Text>
          </Pressable>
        ) : (
          /* ── State B: verified — hero ── */
          <View style={styles.hero}>
            <View style={styles.heroIconWrap}>
              <Camera size={48} color={Colors.orange} />
            </View>
            <Text style={styles.heroTitle}>You're ready to go live!</Text>
            <Text style={styles.heroSub}>Connect with your buyers in real time</Text>

            <Pressable
              style={styles.liveBtn}
              onPress={() => setModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Start Live Stream"
            >
              <Text style={styles.liveBtnText}>▶ Start Live Stream</Text>
            </Pressable>
          </View>
        )}

        {/* ── Tips ── */}
        <Text style={styles.sectionTitle}>Tips for a great stream</Text>
        <View style={styles.tips}>
          {[
            { icon: '💡', text: 'Good lighting makes a big difference' },
            { icon: '📦', text: 'Feature your bestsellers first' },
            { icon: '💬', text: 'Engage with comments regularly' },
          ].map((tip) => (
            <View key={tip.text} style={styles.tipCard}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Previous streams ── */}
        <Text style={styles.sectionTitle}>Previous Streams</Text>
        {recentStreams.length > 0 ? (
          <View style={styles.streamList}>
            {recentStreams.map((s) => (
              <View key={s._id} style={styles.streamRow}>
                <View style={styles.streamThumb}>
                  <Play size={16} color="#fff" fill="#fff" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.streamRowTitle} numberOfLines={1}>{s.title || 'Untitled stream'}</Text>
                  <Text style={styles.streamRowMeta}>{formatStreamMeta(s)}</Text>
                </View>
                <ChevronRight size={18} color="#cbd5e1" />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.streamsEmpty}>
            <Radio size={26} color={Colors.border} />
            <Text style={styles.streamsEmptyText}>Streams you've gone live with will appear here.</Text>
          </View>
        )}
      </ScrollView>

      <GoLiveModal visible={modalOpen} onClose={() => setModalOpen(false)} store={store ?? null} />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 8 },
  streamList: { gap: 10 },
  streamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  streamThumb: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  streamRowTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  streamRowMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  verifyBanner: {
    backgroundColor: '#FEF9C3', borderRadius: 10, padding: 16, gap: 8,
  },
  verifyBannerText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  verifyBannerLink: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.orange },

  hero: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 32, alignItems: 'center', gap: 8,
  },
  heroIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.navy, textAlign: 'center' },
  heroSub: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 24,
  },
  liveBtn: {
    width: '100%', height: 52, borderRadius: 12,
    backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
  },
  liveBtnText: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#fff' },

  sectionTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text, marginTop: 16, marginBottom: 4 },

  tips: { gap: 8 },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10, padding: 14,
  },
  tipIcon: { fontSize: 20 },
  tipText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.text },

  streamsEmpty: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: 20, alignItems: 'center', gap: 8,
  },
  streamsEmptyText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },
});

const modal = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  handleWrap: { alignItems: 'center', paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
  title: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.navy, padding: 20, paddingBottom: 8 },

  body: { paddingHorizontal: 20, paddingBottom: 12 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text, marginBottom: 8 },
  input: {
    backgroundColor: Colors.backgroundGrey, borderRadius: 10, height: 48,
    paddingHorizontal: 14, fontSize: 15, fontFamily: Fonts.regular, color: Colors.text,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: Colors.backgroundGrey,
  },
  pillActive: { backgroundColor: Colors.orange },
  pillText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.text },
  pillTextActive: { color: '#fff', fontFamily: Fonts.semiBold },

  chipRow: { gap: 10, paddingRight: 8 },
  productChip: {
    width: 84, alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', padding: 6,
  },
  productChipActive: { borderColor: Colors.orange, backgroundColor: 'rgba(249,115,22,0.1)' },
  productChipImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.backgroundGrey },
  productChipImgFallback: {},
  productChipText: { fontSize: 11, fontFamily: Fonts.medium, color: Colors.text, textAlign: 'center' },

  footer: { padding: 20, paddingTop: 12 },
  goLiveBtn: {
    height: 56, borderRadius: 14, backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  goLiveBtnDisabled: { opacity: 0.45 },
  goLiveBtnText: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#fff' },
});
