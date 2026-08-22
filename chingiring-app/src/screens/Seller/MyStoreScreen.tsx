/**
 * MyStoreScreen — "My Store" tab for sellers.
 *
 * Fetches the seller's store via GET /api/stores/mine and shows:
 *   - Store header (logo, name, category, verification badge)
 *   - Verification status banner → links to StoreVerificationScreen
 *   - Quick-edit info rows (address, phone, hours)
 *   - Products placeholder (products are admin-managed; placeholder until
 *     seller product management is built in a future sprint)
 *   - "Set up store" empty state if GET /stores/mine returns 404
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  Store,
  BadgeCheck,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Phone,
  MapPin,
  ChevronRight,
  Package,
  MessageCircle,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { verificationAPI, type SellerStore } from '../../api/verification';

// ── Verification status banner ─────────────────────────────────────────────

interface VerifBannerProps {
  store: SellerStore;
  onVerify: () => void;
}

const VerifBanner: React.FC<VerifBannerProps> = ({ store, onVerify }) => {
  const status = store.verificationStatus ?? 'unverified';

  if (status === 'verified') {
    return (
      <View style={[styles.banner, { backgroundColor: '#F0FDF4', borderColor: '#22C55E' }]}>
        <ShieldCheck size={16} color="#16A34A" />
        <Text style={[styles.bannerText, { color: '#15803D' }]}>
          Store verified — live streaming and verified badge unlocked.
        </Text>
      </View>
    );
  }

  const configs = {
    pending:    { bg: '#FFFBEB', border: '#F59E0B', color: '#92400E', text: 'Documents under review — 1–2 business days.', icon: <Clock size={16} color="#D97706" /> },
    rejected:   { bg: '#FEF2F2', border: '#EF4444', color: '#991B1B', text: store.verificationDoc?.rejectionReason ? `Rejected: ${store.verificationDoc.rejectionReason}` : 'Verification rejected. Tap to resubmit.', icon: <ShieldAlert size={16} color="#DC2626" /> },
    unverified: { bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF', text: 'Verify your store to enable live streaming.', icon: <ShieldAlert size={16} color="#2563EB" /> },
  };
  const cfg = configs[status as keyof typeof configs] ?? configs.unverified;

  return (
    <Pressable
      onPress={onVerify}
      style={[styles.banner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
    >
      {cfg.icon}
      <Text style={[styles.bannerText, { color: cfg.color }]}>{cfg.text}</Text>
      <ChevronRight size={14} color={cfg.border} />
    </Pressable>
  );
};

// ── Info row ──────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.infoRow, !onPress && { opacity: 0.7 }]}
    disabled={!onPress}
  >
    <View style={styles.infoIcon}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
    {onPress && <ChevronRight size={14} color={Colors.textSecondary} />}
  </Pressable>
);

// ── Main screen ───────────────────────────────────────────────────────────

export const MyStoreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const {
    data: store,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<SellerStore | null>({
    queryKey: ['seller', 'myStore'],
    queryFn: verificationAPI.getMyStore,
    staleTime: 60_000,
  });

  const handleCallStore = () => {
    if (store?.phone) Linking.openURL(`tel:${store.phone}`).catch(() => {});
  };

  const handleWhatsApp = () => {
    if (!store?.phone) return;
    const num = store.phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${num}`).catch(() => {});
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  // ── No store yet ──────────────────────────────────────────────────────

  if (!store) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Store size={52} color={Colors.border} />
        <Text style={styles.emptyTitle}>No store yet</Text>
        <Text style={styles.emptySub}>
          Complete your store setup to start selling and going live.
        </Text>
        <Pressable
          style={styles.setupBtn}
          onPress={() => navigation.navigate('BusinessOnboarding')}
        >
          <Text style={styles.setupBtnText}>Set up my store</Text>
        </Pressable>
      </View>
    );
  }

  // ── Store detail ─────────────────────────────────────────────────────

  const isVerified = store.verificationStatus === 'verified';

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          colors={[Colors.orange]}
          tintColor={Colors.orange}
        />
      }
    >
      {/* ── Store header ── */}
      <View style={styles.header}>
        {store.logoUrl ? (
          <Image source={{ uri: store.logoUrl }} style={styles.logo} resizeMode="cover" />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoInitial}>
              {(store.name ?? 'S')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
            {isVerified && <BadgeCheck size={18} color={Colors.primary} />}
          </View>
          <Text style={styles.storeCategory}>{store.category}</Text>
          <Text style={styles.followerCount}>
            {(store.followerCount ?? 0).toLocaleString('en-IN')} followers
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Verification banner ── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
        <VerifBanner
          store={store}
          onVerify={() => navigation.navigate('StoreVerification', { store })}
        />
      </View>

      {/* ── Info section ── */}
      <Text style={styles.sectionLabel}>STORE INFO</Text>
      <View style={styles.card}>
        <InfoRow
          icon={<MapPin size={16} color={Colors.orange} />}
          label="Address"
          value={[store.address, store.area, store.city].filter(Boolean).join(', ')}
        />
        <View style={styles.cardDivider} />
        <InfoRow
          icon={<Phone size={16} color={Colors.orange} />}
          label="Phone"
          value={store.phone || 'Not set'}
          onPress={store.phone ? handleCallStore : undefined}
        />
        <View style={styles.cardDivider} />
        <InfoRow
          icon={<MessageCircle size={16} color="#25D366" />}
          label="WhatsApp"
          value={store.phone || 'Not set'}
          onPress={store.phone ? handleWhatsApp : undefined}
        />
      </View>

      {/* ── Products placeholder ── */}
      <Text style={styles.sectionLabel}>PRODUCTS</Text>
      <View style={[styles.card, styles.productsPlaceholder]}>
        <Package size={36} color={Colors.border} />
        <Text style={styles.productsTitle}>Product management coming soon</Text>
        <Text style={styles.productsSub}>
          Products are currently managed by the platform team.
          Contact support to add or update your product listings.
        </Text>
      </View>

      {/* ── Edit store CTA ── */}
      <Pressable
        style={styles.editBtn}
        onPress={() => navigation.navigate('StoreVerification', { store })}
      >
        <Text style={styles.editBtnText}>Manage Verification</Text>
      </Pressable>
    </ScrollView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12, backgroundColor: Colors.background,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 20,
  },
  logo: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: Colors.backgroundGrey,
  },
  logoFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.orange,
  },
  logoInitial: { color: '#fff', fontSize: 26, fontFamily: Fonts.extraBold },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  storeName: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text, flexShrink: 1 },
  storeCategory: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginTop: 2 },
  followerCount: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: Fonts.semiBold, lineHeight: 18 },

  sectionLabel: {
    fontSize: 10, fontFamily: Fonts.extraBold, color: Colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginHorizontal: 16, marginTop: 20, marginBottom: 8,
  },

  card: {
    marginHorizontal: 16, backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  infoIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.backgroundGrey, alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: 1 },
  infoValue: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.text },

  productsPlaceholder: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 8,
  },
  productsTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  productsSub: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 18,
  },

  editBtn: {
    margin: 16, marginTop: 20,
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },

  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  emptySub: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 21,
  },
  setupBtn: {
    marginTop: 8, backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 32,
  },
  setupBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
