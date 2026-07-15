import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, Modal, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Coins, Users as UsersIcon, ArrowDownToLine, Banknote,
  Sliders, Tag, ChevronRight, LogOut, CheckCircle2, AlertCircle, X, Wallet,
} from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import { useAuthStore } from '../../store';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';

// Web-safe alert (react-native-web's Alert is a no-op).
function notify(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function initialsOf(name?: string | null) {
  if (!name) return 'SA';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || 'SA';
}

export function AdminProfileScreen() {
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [showRazorpay, setShowRazorpay] = useState(false);

  const { data: dashRes } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboardStats(),
    staleTime: 60_000,
  });
  const { data: queueRes } = useQuery({
    queryKey: ['admin', 'queue'],
    queryFn: () => adminAPI.getQueueSummary(),
    staleTime: 30_000,
  });
  const { data: settingsRes } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminAPI.getSettings(),
  });

  const coinsIssued  = dashRes?.data?.coinsEconomy?.issued ?? 0;
  const activeUsers  = dashRes?.data?.stats?.activeUsers ?? 0;
  const pendingItems = queueRes?.data?.pendingWithdrawals?.items ?? [];
  const pendingCount = queueRes?.data?.pendingWithdrawals?.count ?? 0;
  const pendingTotal = pendingItems.reduce((sum: number, w: any) => sum + Math.abs(w.amount || 0), 0);

  const settings = settingsRes?.data?.settings;
  const razorpayConfigured = !!settings?.razorpayConfigured;
  const razorpayEnabled = !!settings?.razorpayEnabled;

  const Container: any = ScrollView;

  return (
    <View style={s.root}>
      {!isDesktop && <MobileAuthHeader title="Admin Profile" />}

      <Container
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
      >
        {/* ── Identity hero ─────────────────────────────────────────────── */}
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initialsOf(user?.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{user?.name || 'Super Admin'}</Text>
            <Text style={s.heroEmail}>{user?.email || 'admin@chingiringi.com'}</Text>
            <View style={s.rolePill}>
              <ShieldCheck size={12} color="#2563eb" strokeWidth={2.4} />
              <Text style={s.rolePillText}>{(user?.role || 'admin').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          <StatCard icon={ArrowDownToLine} tint="#d97706" bg="#fef3c7" label="Pending Payouts" value={String(pendingCount)} />
          <StatCard icon={Coins} tint="#7c3aed" bg="#ede9fe" label="Coins Issued" value={coinsIssued.toLocaleString('en-IN')} />
          <StatCard icon={UsersIcon} tint="#2563eb" bg="#dbeafe" label="Active Users" value={activeUsers.toLocaleString('en-IN')} />
        </View>

        {/* ── Payouts (Razorpay) hero card ──────────────────────────────── */}
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#1E3A5F']}
          locations={[0.0367, 0.5927, 0.9633]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={s.payoutCard}
        >
          <View style={s.payoutHeader}>
            <View style={s.payoutIconBox}>
              <Banknote size={16} color="#5eead4" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.payoutTitle}>Payouts · Razorpay</Text>
              <Text style={s.payoutSubtitle}>Disburse approved withdrawals</Text>
            </View>
            <View style={[s.statusPill, razorpayConfigured ? s.statusPillOn : s.statusPillOff]}>
              {razorpayConfigured
                ? <CheckCircle2 size={12} color="#22c55e" strokeWidth={2.4} />
                : <AlertCircle size={12} color="#f59e0b" strokeWidth={2.4} />}
              <Text style={[s.statusPillText, { color: razorpayConfigured ? '#22c55e' : '#f59e0b' }]}>
                {razorpayConfigured ? (razorpayEnabled ? 'Connected' : 'Configured') : 'Not connected'}
              </Text>
            </View>
          </View>

          <View style={s.payoutStatsRow}>
            <View style={s.payoutStatBox}>
              <Text style={s.payoutStatLabel}>Pending amount</Text>
              <Text style={s.payoutStatValue}>₹{pendingTotal.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[s.payoutStatBox, s.payoutStatBoxAlt]}>
              <Text style={s.payoutStatLabel}>Requests</Text>
              <Text style={s.payoutStatValue}>{pendingCount}</Text>
            </View>
          </View>

          <TouchableOpacity style={s.payoutBtn} onPress={() => setShowRazorpay(true)} activeOpacity={0.85}>
            <Sliders size={15} color="#0f172a" strokeWidth={2.4} />
            <Text style={s.payoutBtnText}>{razorpayConfigured ? 'Manage Razorpay' : 'Configure Razorpay'}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <Text style={s.sectionHeader}>QUICK ACTIONS</Text>

        <QuickAction
          icon={Wallet} iconColor="#7c3aed" iconBg="#ede9fe"
          title="Wallet Operations" subtitle="Credit coins, approve payouts"
          onPress={() => nav.navigate('AdminWalletOps')}
          rightSlot={pendingCount > 0 ? <Badge text={`${pendingCount} pending`} /> : undefined}
        />
        <QuickAction
          icon={Sliders} iconColor="#0d9488" iconBg="#ccfbf1"
          title="Coin Economy Settings" subtitle="Pass-through %, coin rate, lock period"
          onPress={() => nav.navigate('AdminWalletOps')}
        />
        <QuickAction
          icon={UsersIcon} iconColor="#2563eb" iconBg="#dbeafe"
          title="Manage Users" subtitle="Search, block, adjust wallets"
          onPress={() => nav.navigate('AdminUsers')}
        />
        <QuickAction
          icon={Tag} iconColor="#d97706" iconBg="#fef3c7"
          title="Manage Deals" subtitle="Affiliate deals, coins reward"
          onPress={() => nav.navigate('AdminDeals')}
        />

        {/* ── Logout ────────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <LogOut size={18} color={Colors.danger} strokeWidth={2.2} />
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </Container>

      <RazorpayModal
        visible={showRazorpay}
        onClose={() => setShowRazorpay(false)}
        settings={settings}
      />
    </View>
  );
}

// ─── Razorpay config modal ───────────────────────────────────────────────────
function RazorpayModal({ visible, onClose, settings }: {
  visible: boolean;
  onClose: () => void;
  settings: any;
}) {
  const qc = useQueryClient();
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [account, setAccount] = useState('');
  const [enabled, setEnabled] = useState(false);

  React.useEffect(() => {
    if (!settings) return;
    setKeyId(settings.razorpayKeyId ?? '');
    setAccount(settings.razorpayAccountNumber ?? '');
    setEnabled(!!settings.razorpayEnabled);
    setSecret(''); // never pre-filled — write-only
  }, [settings, visible]);

  const save = useMutation({
    mutationFn: () => adminAPI.updateSettings({
      razorpayKeyId: keyId.trim(),
      razorpayAccountNumber: account.trim(),
      razorpayEnabled: enabled,
      // Only send the secret when the admin typed a new one.
      ...(secret.trim() ? { razorpayKeySecret: secret.trim() } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      onClose();
      notify('Saved', 'Razorpay payout settings updated.');
    },
    onError: (e: any) => notify('Save failed', e?.response?.data?.message || e?.message || 'Try again'),
  });

  const maskedSecret = settings?.razorpayKeySecretMasked;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.card}>
          <View style={m.header}>
            <Text style={m.title}>Razorpay Payouts</Text>
            <TouchableOpacity style={m.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={16} color="#64748b" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <Text style={m.note}>
            RazorpayX credentials used to disburse approved withdrawals. The secret is stored
            securely and never shown again — leave it blank to keep the saved one.
          </Text>

          <Text style={m.label}>Key ID</Text>
          <TextInput
            style={m.input} value={keyId} onChangeText={setKeyId}
            placeholder="rzp_live_xxxxxxxx" placeholderTextColor="#94a3b8"
            autoCapitalize="none" autoCorrect={false}
          />

          <Text style={m.label}>Key Secret {maskedSecret ? `(saved: ${maskedSecret})` : ''}</Text>
          <TextInput
            style={m.input} value={secret} onChangeText={setSecret}
            placeholder={maskedSecret ? 'Leave blank to keep current' : 'Enter key secret'}
            placeholderTextColor="#94a3b8" autoCapitalize="none" autoCorrect={false} secureTextEntry
          />

          <Text style={m.label}>RazorpayX account number</Text>
          <TextInput
            style={m.input} value={account} onChangeText={setAccount}
            placeholder="2323230000000000" placeholderTextColor="#94a3b8"
            autoCapitalize="none" autoCorrect={false}
          />

          <TouchableOpacity style={m.toggleRow} onPress={() => setEnabled((v) => !v)} activeOpacity={0.8}>
            <View style={[m.toggle, enabled && m.toggleOn]}>
              <View style={[m.knob, enabled && m.knobOn]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.toggleTitle}>Enable auto-payouts</Text>
              <Text style={m.toggleSub}>When on, approving a withdrawal disburses via Razorpay</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[m.saveBtn, save.isPending && { opacity: 0.6 }]}
            onPress={() => save.mutate()}
            disabled={save.isPending}
            activeOpacity={0.85}
          >
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={m.saveBtnText}>Save settings</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, tint, bg, label, value }: {
  icon: React.ComponentType<any>; tint: string; bg: string; label: string; value: string;
}) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: bg }]}>
        <Icon size={18} color={tint} strokeWidth={2.2} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon: Icon, iconColor, iconBg, title, subtitle, onPress, rightSlot }: {
  icon: React.ComponentType<any>; iconColor: string; iconBg: string;
  title: string; subtitle: string; onPress: () => void; rightSlot?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={s.qaRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.qaIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.qaTitle}>{title}</Text>
        <Text style={s.qaSubtitle}>{subtitle}</Text>
      </View>
      {rightSlot}
      <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
    </TouchableOpacity>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },
  content: { padding: 16 },
  contentDesktop: { padding: 24, maxWidth: 760, alignSelf: 'center', width: '100%' },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 16,
  },
  avatar: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  heroName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, marginTop: 8,
  },
  rolePillText: { fontSize: 10, fontWeight: '800', color: '#2563eb', letterSpacing: 0.4 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, minWidth: 100, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e8ecf2',
  },
  statIcon: {
    width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '600' },

  payoutCard: { borderRadius: 18, padding: 18, marginBottom: 20 },
  payoutHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  payoutIconBox: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(94,234,212,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  payoutTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  payoutSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusPillOn: { backgroundColor: 'rgba(34,197,94,0.14)' },
  statusPillOff: { backgroundColor: 'rgba(245,158,11,0.14)' },
  statusPillText: { fontSize: 10, fontWeight: '800' },

  payoutStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  payoutStatBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 },
  payoutStatBoxAlt: { backgroundColor: 'rgba(255,255,255,0.06)' },
  payoutStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  payoutStatValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 3 },

  payoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, height: 44,
  },
  payoutBtnText: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  sectionHeader: { fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.6, marginBottom: 10 },

  qaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 10,
  },
  qaIcon: { width: 40, height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  qaTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  qaSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

  badge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#d97706' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, height: 50, marginTop: 8,
    borderWidth: 1, borderColor: '#fecaca',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.danger },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 16, padding: 20,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 20px 50px rgba(0,0,0,0.25)' } as any) : {
      shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 20 }, shadowRadius: 40, elevation: 12,
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 14 },

  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
  input: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14, fontSize: 14, color: '#0f172a', backgroundColor: '#F5F8FF',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#e2e8f0', padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#22c55e' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  toggleTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  toggleSub: { fontSize: 11, color: '#64748b', marginTop: 1 },

  saveBtn: {
    height: 48, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default AdminProfileScreen;
