/**
 * SellerProfileTabScreen — the seller's Profile TAB (account hub).  (Redesign: "A · Stage")
 *
 * NOTE: distinct from SellerProfileScreen.tsx, which is the PUBLIC seller store
 * view buyers open from LiveDiscovery / a followed-stores list. This is the
 * seller's own account tab (4th tab of SellerTabNavigator), previously served by
 * the shared buyer MobileProfileScreen (which the buyer drawer still uses).
 *
 * Per the redesign:
 *   - Compact navy header: avatar (edit badge → EditProfile) + name + "Seller"
 *     pill + contact line, settings gear → Settings
 *   - Verification card up top (status + Store-document / Identity breakdown →
 *     StoreVerification), the seller's most important account state
 *   - Selling (Edit store details · Shop as a buyer)
 *   - My content (My Videos · Blocked accounts)
 *   - Refer & earn — demoted to a single compact row (was a big gradient card)
 *   - Legal & support, then Log out
 *
 * Deliberately NO Coins / Pending-coins (a buyer-wallet concept). Buyer-only
 * money lives on MobileProfileScreen.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Share,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Settings,
  Pencil,
  ChevronRight,
  BadgeCheck,
  Clock,
  AlertCircle,
  ShieldAlert,
  Check,
  Minus,
  Store,
  ShoppingBag,
  PlaySquare,
  UserX,
  Gift,
  Share2,
  MailCheck,
  Info,
  HelpCircle,
  Shield,
  FileText,
  MessageCircle,
  LogOut,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { useMyStore } from '../../hooks/useMyStore';
import { type VerificationStatus } from '../../api/verification';
import { LegalModal, LegalType } from '../../components/LegalModal';
import { EmailVerifyModal } from '../../components/EmailVerifyModal';

// The seller tab bar (SellerTabNavigator) is position:absolute and overlays
// content — pad the scroll past it so the last row clears the bar.
const TAB_BAR_CLEARANCE = 90;

const SUPPORT_EMAIL = 'support@chingiringi.com';

// ── Account action row ──────────────────────────────────────────────────────

const Row: React.FC<{
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
}> = ({ icon: Icon, iconColor, iconBg, title, subtitle, rightSlot, onPress }) => (
  <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
    <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
      <Icon size={18} color={iconColor} strokeWidth={2} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
    {rightSlot ?? <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />}
  </Pressable>
);

// ── Verification card ───────────────────────────────────────────────────────

const V: Record<VerificationStatus, { color: string; bg: string; Icon: React.ComponentType<any>; title: string; sub: string }> = {
  verified:   { color: '#059669',      bg: 'rgba(16,185,129,0.12)', Icon: BadgeCheck,   title: 'Store verified',            sub: "You're all set to sell live." },
  pending:    { color: '#d97706',      bg: 'rgba(245,158,11,0.14)', Icon: Clock,        title: 'Verification under review', sub: "We're checking your documents." },
  rejected:   { color: '#dc2626',      bg: 'rgba(239,68,68,0.10)',  Icon: AlertCircle,  title: 'Action needed',             sub: 'Some documents need resubmitting.' },
  unverified: { color: Colors.orange,  bg: 'rgba(249,115,22,0.10)', Icon: ShieldAlert,  title: 'Verify your store',         sub: 'Verify to unlock live selling.' },
};

const BreakdownChip: React.FC<{ label: string; state: 'ok' | 'submitted' | 'missing' }> = ({ label, state }) => {
  const Icon = state === 'ok' ? Check : state === 'submitted' ? Clock : Minus;
  const color = state === 'ok' ? '#059669' : state === 'submitted' ? '#d97706' : '#94a3b8';
  return (
    <View style={styles.breakChip}>
      <Icon size={13} color={color} strokeWidth={2.4} />
      <Text style={styles.breakChipText}>{label}</Text>
    </View>
  );
};

const VerificationCard: React.FC<{
  status: VerificationStatus;
  storeDocSubmitted: boolean;
  identitySubmitted: boolean;
  rejectionReason?: string;
  onPress: () => void;
}> = ({ status, storeDocSubmitted, identitySubmitted, rejectionReason, onPress }) => {
  const cfg = V[status];
  const sub = status === 'rejected' && rejectionReason ? rejectionReason : cfg.sub;
  const itemState = (submitted: boolean): 'ok' | 'submitted' | 'missing' =>
    status === 'verified' ? 'ok' : submitted ? 'submitted' : 'missing';

  return (
    <Pressable style={[styles.verifCard, { borderColor: cfg.bg }]} onPress={onPress} accessibilityRole="button" accessibilityLabel="Store verification">
      <View style={styles.verifTop}>
        <View style={[styles.verifIcon, { backgroundColor: cfg.bg }]}>
          <cfg.Icon size={20} color={cfg.color} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.verifTitle}>{cfg.title}</Text>
          <Text style={styles.verifSub} numberOfLines={2}>{sub}</Text>
        </View>
        <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
      </View>
      <View style={styles.breakRow}>
        <BreakdownChip label="Store document" state={itemState(storeDocSubmitted)} />
        <BreakdownChip label="Identity" state={itemState(identitySubmitted)} />
      </View>
    </Pressable>
  );
};

// ── Main screen ─────────────────────────────────────────────────────────────

export const SellerProfileTabScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const user = useAuthStore((st) => st.user);
  const setViewAsBuyer = useAuthStore((st) => st.setViewAsBuyer);
  const logout = useAuthStore((st) => st.logout);
  const hydrate = useAuthStore((st) => st.hydrate);

  const [legal, setLegal] = useState<LegalType | null>(null);
  const [emailVerifyOpen, setEmailVerifyOpen] = useState(false);

  const { data: store, refetch, isRefetching } = useMyStore();

  const vStatus: VerificationStatus = store?.verificationStatus ?? 'unverified';
  const storeDocSubmitted = !!(store?.verificationDoc?.type || store?.verificationDoc?.publicId || store?.verificationDoc?.url);
  const identitySubmitted = !!(
    store?.identityDoc?.type ||
    store?.identityDoc?.docPublicId ||
    store?.identityDoc?.docUrl ||
    store?.identityDoc?.selfiePublicId ||
    store?.identityDoc?.selfieUrl
  );

  const referralCode = user?.referralCode || '';
  const handleShareCode = async () => {
    if (!referralCode) {
      Alert.alert('Referral code unavailable', 'Your referral code isn’t ready yet — check back shortly.');
      return;
    }
    try {
      const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com';
      await Share.share({
        message: `Join Chingiringi with my code ${referralCode} — get ₹5 to start! ${base}/r/${referralCode}`,
      });
    } catch {
      /* user cancelled — ignore */
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { logout(); } },
    ]);
  };

  const initial = (user?.name ?? 'S').trim()[0]?.toUpperCase() ?? 'S';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.orange]} tintColor={Colors.orange} />
      }
    >
      {/* ── Compact navy header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable style={styles.avatarWrap} onPress={() => nav.navigate('EditProfile')} accessibilityRole="button" accessibilityLabel="Edit profile">
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Pencil size={11} color="#fff" strokeWidth={2.4} />
          </View>
        </Pressable>

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Your profile'}</Text>
            <View style={styles.sellerPill}><Text style={styles.sellerPillText}>Seller</Text></View>
          </View>
          {user?.email || user?.phone ? (
            <Text style={styles.headerSub} numberOfLines={1}>{user?.email || user?.phone}</Text>
          ) : null}
        </View>

        <Pressable style={styles.gear} onPress={() => nav.navigate('Settings')} accessibilityRole="button" accessibilityLabel="Settings">
          <Settings size={18} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {/* ── Verification (or store setup) ── */}
        {store ? (
          <VerificationCard
            status={vStatus}
            storeDocSubmitted={storeDocSubmitted}
            identitySubmitted={identitySubmitted}
            rejectionReason={store.verificationDoc?.rejectionReason}
            onPress={() => nav.navigate('StoreVerification', { store })}
          />
        ) : (
          <Pressable style={[styles.verifCard, { borderColor: 'rgba(249,115,22,0.10)' }]} onPress={() => nav.navigate('BusinessOnboarding')}>
            <View style={styles.verifTop}>
              <View style={[styles.verifIcon, { backgroundColor: 'rgba(249,115,22,0.10)' }]}>
                <Store size={20} color={Colors.orange} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.verifTitle}>Set up your store</Text>
                <Text style={styles.verifSub}>Create your store to start selling on Chingiringi.</Text>
              </View>
              <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
            </View>
          </Pressable>
        )}

        {/* ── Account: verify email (only when unverified) ── */}
        {user?.email && !user?.isEmailVerified ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account</Text>
            <Row
              icon={MailCheck}
              iconColor="#d97706"
              iconBg="#fffbeb"
              title="Verify your email"
              subtitle={user.email}
              rightSlot={<Text style={styles.verifyLink}>Verify ›</Text>}
              onPress={() => setEmailVerifyOpen(true)}
            />
          </View>
        ) : null}

        {/* ── Selling ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Selling</Text>
          {store ? (
            <Row
              icon={Store}
              iconColor={Colors.orange}
              iconBg="rgba(249,115,22,0.12)"
              title="Edit store details"
              subtitle="Name, photos, category, website & more"
              onPress={() => nav.navigate('EditStoreDetails')}
            />
          ) : null}
          <Row
            icon={ShoppingBag}
            iconColor={Colors.primary}
            iconBg={Colors.primaryLight10}
            title="Shop as a buyer"
            subtitle="Browse & buy on Chingiringi — your store stays live"
            onPress={() => setViewAsBuyer(true)}
          />
        </View>

        {/* ── My content ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>My content</Text>
          <Row
            icon={PlaySquare}
            iconColor="#7c3aed"
            iconBg="#f5f3ff"
            title="My Videos"
            subtitle="Post clips & manage your videos"
            onPress={() => nav.navigate('MyVideos')}
          />
          <Row
            icon={UserX}
            iconColor="#dc2626"
            iconBg="#fef2f2"
            title="Blocked accounts"
            subtitle="Creators hidden from your video feed"
            onPress={() => nav.navigate('BlockedAccounts')}
          />
        </View>

        {/* ── Refer & earn (demoted to one row) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Grow</Text>
          <Row
            icon={Gift}
            iconColor="#a78bfa"
            iconBg="#f5f3ff"
            title="Refer & earn"
            subtitle="Invite friends — you get ₹25, they get ₹5"
            rightSlot={
              <View style={styles.shareBtn}>
                <Share2 size={15} color={Colors.orange} strokeWidth={2.2} />
              </View>
            }
            onPress={handleShareCode}
          />
        </View>

        {/* ── Legal & support ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal & support</Text>
          <Row icon={Info} iconColor="#3b82f6" iconBg="#eff6ff" title="About" subtitle="Our story, mission & values" onPress={() => setLegal('about')} />
          <Row
            icon={HelpCircle}
            iconColor="#a78bfa"
            iconBg="#f5f3ff"
            title="Help & support"
            subtitle="FAQs, raise a ticket & more"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
          />
          <Row
            icon={MessageCircle}
            iconColor="#16a34a"
            iconBg="#dcfce7"
            title="Contact us"
            subtitle="Get in touch with our team"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
          />
          <Row icon={Shield} iconColor="#ef4444" iconBg="#fee2e2" title="Privacy policy" subtitle="How we handle your data" onPress={() => setLegal('privacy')} />
          <Row icon={FileText} iconColor="#f59e0b" iconBg="#fef3c7" title="Terms & conditions" subtitle="Rules, policies & agreements" onPress={() => setLegal('terms')} />
        </View>

        {/* ── Log out ── */}
        <Pressable style={styles.logoutRow} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Log out">
          <LogOut size={18} color="#dc2626" strokeWidth={2} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <LegalModal type={legal} onClose={() => setLegal(null)} />
      <EmailVerifyModal
        visible={emailVerifyOpen}
        email={user?.email}
        onClose={() => setEmailVerifyOpen(false)}
        onVerified={() => hydrate()}
      />
    </ScrollView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatarWrap: { width: 56, height: 56 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 22, fontFamily: Fonts.extraBold, color: '#fff' },
  editBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.navy,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontFamily: Fonts.extraBold, color: '#fff', flexShrink: 1 },
  sellerPill: {
    backgroundColor: 'rgba(249,115,22,0.9)', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9,
  },
  sellerPillText: { fontSize: 10.5, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.3 },
  headerSub: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  gear: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },

  body: { padding: 16, gap: 18 },

  // Verification card
  verifCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  verifTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  verifIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verifTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.text },
  verifSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  breakRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  breakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.background, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 10,
  },
  breakChipText: { fontSize: 11.5, fontFamily: Fonts.semiBold, color: Colors.text },

  // Sections
  section: {},
  sectionLabel: {
    fontSize: 11.5, fontFamily: Fonts.bold, letterSpacing: 0.5, textTransform: 'uppercase',
    color: Colors.textSecondary, marginBottom: 10,
  },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  rowSub: { fontSize: 11.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },
  verifyLink: { color: '#d97706', fontFamily: Fonts.semiBold, fontSize: 12 },
  shareBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Log out
  logoutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#fee2e2', marginTop: 2,
  },
  logoutText: { fontSize: 14, fontFamily: Fonts.bold, color: '#dc2626' },
});

export default SellerProfileTabScreen;
