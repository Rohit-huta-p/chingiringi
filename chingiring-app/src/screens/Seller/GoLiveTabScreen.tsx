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
import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ChevronRight, Radio, Play, Check, Package, BadgeCheck, Lock } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import apiClient from '../../api/client';
import { createStream, getMyStreams, formatStreamMeta, type StreamSummary } from '../../api/streams';
import { productsAPI, type Product } from '../../api/products';
import { type SellerStore } from '../../api/verification';
import { ImageUploader } from '../../components/ImageUploader';
import { CategorySelect } from '../../components/CategorySelect';
import { useMyStore } from '../../hooks/useMyStore';
import { cloudFolder } from '../../constants/cloudinaryFolders';

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
      const { streamId, rtmpUrl, streamKey, playbackId } = await createStream({
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
        rtmpUrl,     // Mux RTMP ingest — consumed by the native publisher in M3
        streamKey,
        playbackId,
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
              folder={cloudFolder.storeStreams(store?._id)}
              hint="Your stream's cover on the Live & Videos cards buyers browse. Recommended 1080 × 1440 px (3:4, portrait) — keep the subject centered."
            />

            {/* Category */}
            <View style={{ marginTop: 16 }}>
              <CategorySelect label="Category" value={category} onChange={setCategory} />
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

// ── Screen helpers ────────────────────────────────────────────────────────

// The seller tab bar (SellerTabNavigator) is position:absolute and overlays
// content — pad the scroll past it so the last card clears the bar.
const TAB_BAR_CLEARANCE = 90;

const inr = (n?: number) => (n ?? 0).toLocaleString('en-IN');

// Compact "1.2k" style for the per-stream stat strip.
const compact = (n?: number): string => {
  const v = n ?? 0;
  if (v >= 1000) {
    const k = v / 1000;
    return `${k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(v);
};

// "21 Aug · 18:42" (date + duration) — the subline for a stream that has real
// analytics, since the audience numbers move to the strip below it.
const whenLine = (s: StreamSummary): string => {
  const parts: string[] = [];
  const when = s.startedAt || s.createdAt;
  if (when) parts.push(new Date(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  if (s.startedAt && s.endedAt) {
    const secs = Math.max(0, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000));
    parts.push(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
  }
  return parts.join(' · ');
};

// Only ended streams recorded after the analytics landed carry real numbers;
// older rows read 0 across the board, so fall back to the legacy meta line and
// hide the strip rather than show a dead "0 · 0 · 0".
const hasAnalytics = (s: StreamSummary): boolean =>
  s.status === 'ended' &&
  ((s.avgViewers ?? 0) > 0 || (s.totalViews ?? 0) > 0 || (s.usersContacted ?? 0) > 0);

interface StoreStats { followerCount: number; totalProducts: number; }
async function fetchStoreStats(storeId: string): Promise<StoreStats> {
  try {
    const res = await apiClient.get(`/api/stores/${storeId}/stats`);
    const d = res.data?.data ?? res.data ?? {};
    return { followerCount: d.followerCount ?? 0, totalProducts: d.totalProducts ?? 0 };
  } catch {
    return { followerCount: 0, totalProducts: 0 };
  }
}

const lockTitle = (status?: SellerStore['verificationStatus']): string =>
  status === 'pending' ? 'Verification under review'
    : status === 'rejected' ? 'Verification needs attention'
      : 'Verify your store to go live';

const lockSub = (status: SellerStore['verificationStatus'] | undefined, reason?: string): string =>
  status === 'pending' ? "We're reviewing your documents — you can go live the moment they're approved."
    : status === 'rejected' ? (reason ? `Rejected: ${reason}` : 'Your submission needs changes — resubmit to continue.')
      : 'Going live unlocks as soon as your store is verified.';

// ── Pulsing "ping" ring behind the GO LIVE button ─────────────────────────
const PulseRing: React.FC = () => {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.3] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  return <Animated.View pointerEvents="none" style={[styles.pulseRing, { opacity, transform: [{ scale }] }]} />;
};

// ── Locked / no-store hero (verification gate) ────────────────────────────
const LockedHero: React.FC<{
  icon: React.ReactNode; title: string; sub: string; cta: string; onPress: () => void;
}> = ({ icon, title, sub, cta, onPress }) => (
  <View style={styles.lockedHero}>
    <View style={styles.lockedIcon}>{icon}</View>
    <Text style={styles.lockedTitle}>{title}</Text>
    <Text style={styles.lockedSub}>{sub}</Text>
    <Pressable style={styles.lockedBtn} onPress={onPress} accessibilityRole="button" accessibilityLabel={cta}>
      <Text style={styles.lockedBtnText}>{cta}</Text>
    </Pressable>
  </View>
);

// ── Per-stream stat strip (avg viewers · total views · contacted) ─────────
const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const StreamCard: React.FC<{ s: StreamSummary }> = ({ s }) => {
  const analytics = hasAnalytics(s);
  return (
    <View style={styles.streamCard}>
      <View style={styles.streamCardTop}>
        <View style={styles.streamThumb}>
          <Play size={14} color="#fff" fill="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.streamRowTitle} numberOfLines={1}>{s.title || 'Untitled stream'}</Text>
          <Text style={styles.streamRowMeta}>{analytics ? whenLine(s) : formatStreamMeta(s)}</Text>
        </View>
        <ChevronRight size={17} color="#cbd5e1" />
      </View>

      {analytics ? (
        <View style={styles.statStrip}>
          <Stat value={compact(s.avgViewers)} label="Avg viewers" />
          <View style={styles.statDivider} />
          <Stat value={compact(s.totalViews)} label="Total views" />
          <View style={styles.statDivider} />
          <Stat value={compact(s.usersContacted)} label="Contacted" />
        </View>
      ) : null}
    </View>
  );
};

// ── GoLiveTabScreen ───────────────────────────────────────────────────────

export const GoLiveTabScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: store, isLoading } = useMyStore();

  const { data: stats } = useQuery({
    queryKey: ['seller', 'stats', store?._id],
    queryFn: () => fetchStoreStats(store!._id),
    enabled: !!store?._id,
    staleTime: 60_000,
  });

  const { data: recentStreams = [] } = useQuery({
    queryKey: ['seller', 'streams', 'golive'],
    queryFn: () => getMyStreams(10),
    enabled: !!store,
    staleTime: 60_000,
  });

  const isVerified = store?.verificationStatus === 'verified';
  const followers = stats?.followerCount ?? 0;
  const productCount = stats?.totalProducts ?? 0;

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Go Live</Text>
        {isVerified ? (
          <View style={styles.verifiedPill}>
            <BadgeCheck size={13} color="#059669" strokeWidth={2.4} />
            <Text style={styles.verifiedPillText}>Verified</Text>
          </View>
        ) : null}
      </View>

      {/* ── Primary state: no-store / locked / the Big Button ── */}
      {!store ? (
        <LockedHero
          icon={<Package size={28} color={Colors.orange} strokeWidth={2} />}
          title="Set up your store to go live"
          sub="Create your store first, then you can start streaming to your buyers."
          cta="Set up my store"
          onPress={() => navigation.navigate('BusinessOnboarding')}
        />
      ) : !isVerified ? (
        <LockedHero
          icon={<Lock size={26} color={Colors.orange} strokeWidth={2} />}
          title={lockTitle(store.verificationStatus)}
          sub={lockSub(store.verificationStatus, store.verificationDoc?.rejectionReason)}
          cta={store.verificationStatus === 'pending' ? 'View status' : 'Verify my store'}
          onPress={() => navigation.navigate('StoreVerification', { store })}
        />
      ) : (
        <View style={styles.heroBlock}>
          {/* Big pulsing GO LIVE button → opens the setup sheet */}
          <View style={styles.bigWrap}>
            <Pressable
              style={styles.bigButtonHit}
              onPress={() => setModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Start a live stream"
            >
              <PulseRing />
              <View style={styles.ringStatic} pointerEvents="none" />
              <LinearGradient
                colors={['#ff9a52', '#F97316']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.bigButton}
              >
                <Video size={34} color="#fff" strokeWidth={2} />
                <Text style={styles.bigButtonText}>GO LIVE</Text>
              </LinearGradient>
            </Pressable>

            <Text style={styles.bigTitle}>Start a live stream</Text>
            <Text style={styles.bigSub}>
              {followers > 0 ? (
                <>Tap to set up, then go on air. <Text style={styles.bigSubStrong}>{inr(followers)} followers</Text> get notified.</>
              ) : (
                'Tap to set up, then go on air.'
              )}
            </Text>
          </View>

          {/* Readiness chips — real signals only */}
          <View style={styles.chipsRow}>
            <View style={styles.readyChip}>
              <Check size={13} color="#10b981" strokeWidth={2.6} />
              <Text style={styles.readyChipText}>Store verified</Text>
            </View>
            <Pressable style={styles.readyChip} onPress={() => navigation.navigate('MyStore')}>
              <Package size={13} color={productCount > 0 ? '#10b981' : Colors.textSecondary} strokeWidth={2.4} />
              <Text style={styles.readyChipText}>
                {productCount > 0 ? `${productCount} product${productCount === 1 ? '' : 's'}` : 'Add products'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Your last streams ── */}
      {store ? (
        <View>
          <Text style={styles.sectionLabel}>Your last streams</Text>
          {recentStreams.length > 0 ? (
            <View style={{ gap: 10 }}>
              {recentStreams.map((s) => <StreamCard key={s._id} s={s} />)}
            </View>
          ) : (
            <View style={styles.streamsEmpty}>
              <Radio size={26} color={Colors.border} />
              <Text style={styles.streamsEmptyText}>Streams you've gone live with will appear here.</Text>
            </View>
          )}
        </View>
      ) : null}

      <GoLiveModal visible={modalOpen} onClose={() => setModalOpen(false)} store={store ?? null} />
    </ScrollView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, gap: 18 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.navy },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.14)', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11,
  },
  verifiedPillText: { fontSize: 11.5, fontFamily: Fonts.bold, color: '#059669' },

  // Big Button hero
  heroBlock: { alignItems: 'center', gap: 18 },
  bigWrap: { alignItems: 'center' },
  bigButtonHit: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(249,115,22,0.18)',
  },
  ringStatic: {
    position: 'absolute', width: 158, height: 158, borderRadius: 79,
    backgroundColor: 'rgba(249,115,22,0.12)',
  },
  bigButton: {
    width: 136, height: 136, borderRadius: 68,
    alignItems: 'center', justifyContent: 'center', gap: 5,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 22, elevation: 10,
  },
  bigButtonText: { fontSize: 14, fontFamily: Fonts.extraBold, color: '#fff', letterSpacing: 1 },
  bigTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.navy, marginTop: 22 },
  bigSub: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary,
    marginTop: 5, textAlign: 'center', maxWidth: 260, lineHeight: 19,
  },
  bigSubStrong: { fontFamily: Fonts.bold, color: Colors.text },

  // Readiness chips
  chipsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  readyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  readyChipText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.text },

  // Section label
  sectionLabel: {
    fontSize: 11.5, fontFamily: Fonts.bold, letterSpacing: 0.5, textTransform: 'uppercase',
    color: Colors.textSecondary, marginBottom: 11,
  },

  // Past-stream cards
  streamCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  streamCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streamThumb: {
    width: 46, height: 46, borderRadius: 10,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  streamRowTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  streamRowMeta: { fontSize: 11.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  // Stat strip
  statStrip: {
    flexDirection: 'row', marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { fontSize: 14, fontFamily: Fonts.extraBold, color: Colors.navy },
  statLabel: { fontSize: 10, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 2 },

  streamsEmpty: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 20, alignItems: 'center', gap: 8,
  },
  streamsEmptyText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },

  // Locked / no-store hero
  lockedHero: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 28, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  lockedIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  lockedTitle: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.navy, textAlign: 'center' },
  lockedSub: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 19, marginBottom: 8,
  },
  lockedBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 26 },
  lockedBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
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
