import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, useWindowDimensions, Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Inbox, FileSpreadsheet, UserSearch, CheckCircle, Clock, AlertCircle,
  Search, Upload, ChevronRight, IndianRupee, Coins, MousePointerClick,
  ArrowDownToLine, RefreshCw, Trash2, Plus, Minus, Ban, ShieldCheck,
  CalendarDays, FileText, Sliders, Save,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import { MobileAdminNav } from '../../components/MobileAdminNav';

const isNative = Platform.OS !== 'web';
// Mobile *layout* — true on native OR a narrow web viewport. Gating layout on
// `isNative` alone forced the desktop header, long tab labels, and desktop
// tables onto phone-width web (the "broken" Wallet Ops screen). Use this for
// those decisions; keep `isNative` only for genuinely native-only concerns.
const computeIsMobile = (width: number) => Platform.OS !== 'web' || width < 768;

// ─── Types ─────────────────────────────────────────────────────────────────

type Tab = 'queue' | 'reports' | 'user' | 'settings';

interface TimelineUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  isBlocked?: boolean;
  avatarUrl?: string;
  createdAt: string;
}

interface TimelineWallet {
  pendingCashback: number;
  confirmedCashback: number;
  coins: number;
  lifetimeEarned: number;
}

interface TimelineEvent {
  kind: 'transaction' | 'click';
  timestamp: string;
  data: any;
}

interface QueueSummary {
  pendingWithdrawals: { count: number; items: any[] };
  readyToConfirm:     { count: number; items: any[] };
  recentImports:      any[];
}

interface ParsedRow {
  orderId: string;
  subid: string;
  amount: number;
  commission: number;
  status: string;
  rawIndex: number;
}

// ─── Native prompt modal (window.prompt doesn't exist on iOS/Android) ─────

function useNativePrompt() {
  const [state, setState] = useState<{
    visible: boolean;
    title: string;
    placeholder: string;
    value: string;
    onSubmit: (val: string) => void;
  }>({ visible: false, title: '', placeholder: '', value: '', onSubmit: () => {} });

  const prompt = useCallback((title: string, placeholder?: string): Promise<string | null> => {
    if (!isNative) {
      const val = window.prompt(title);
      return Promise.resolve(val);
    }
    return new Promise((resolve) => {
      setState({
        visible: true,
        title,
        placeholder: placeholder || '',
        value: '',
        onSubmit: (v) => {
          setState((p) => ({ ...p, visible: false }));
          resolve(v || null);
        },
      });
    });
  }, []);

  const dismiss = useCallback(() => {
    state.onSubmit('');
    setState((p) => ({ ...p, visible: false }));
  }, [state.onSubmit]);

  const modal = state.visible ? (
    <Modal transparent animationType="fade" visible>
      <KeyboardAvoidingView
        style={s.promptOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.promptCard}>
          <Text style={s.promptTitle}>{state.title}</Text>
          <TextInput
            style={s.promptInput}
            value={state.value}
            onChangeText={(v) => setState((p) => ({ ...p, value: v }))}
            placeholder={state.placeholder}
            placeholderTextColor="#94a3b8"
            keyboardType="default"
            autoFocus
          />
          <View style={s.promptBtns}>
            <TouchableOpacity style={s.promptCancelBtn} onPress={dismiss}>
              <Text style={s.promptCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.promptSubmitBtn}
              onPress={() => state.onSubmit(state.value)}
            >
              <Text style={s.promptSubmitTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  ) : null;

  return { prompt, modal };
}

// ─── Main screen ───────────────────────────────────────────────────────────

export function WalletOperationsScreen() {
  const [tab, setTab] = useState<Tab>('queue');
  const { width } = useWindowDimensions();
  const isMobile = computeIsMobile(width);

  const TABS: { key: Tab; icon: React.ComponentType<any>; label: string; shortLabel: string }[] = [
    { key: 'queue',    icon: Inbox,          label: 'Pending Queue', shortLabel: 'Queue' },
    { key: 'reports',  icon: FileSpreadsheet, label: 'Reports Inbox', shortLabel: 'Reports' },
    { key: 'user',     icon: UserSearch,     label: 'User Wallet',   shortLabel: 'Users' },
    { key: 'settings', icon: Sliders,        label: 'Settings',      shortLabel: 'Settings' },
  ];

  const Root: any = isNative ? SafeAreaView : View;
  const rootProps = isNative ? { edges: ['top'] as const } : {};

  return (
    <Root style={s.root} {...rootProps}>
      {isMobile ? (
        /* Same blue admin header + section nav as every other admin screen,
           so Wallet Ops stops being the odd screen with no nav bar. Shown on
           native AND narrow web so phone-width web matches the native screen. */
        <MobileAdminNav active="AdminWalletOps" />
      ) : (
        <View style={s.header}>
          <Text style={s.title}>Wallet Operations</Text>
          <Text style={s.subtitle}>
            One workspace for crediting cashback from merchant reports, approving payouts,
            and drilling into any user's wallet history.
          </Text>
        </View>
      )}

      {/* Sub-tab bar — plain flex row (a horizontal ScrollView would expand
          vertically and clip labels / center in empty space). */}
      <View style={[s.tabBar, isMobile && { gap: 0, paddingHorizontal: 0, backgroundColor: '#fff' }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              s.tabBtn,
              tab === t.key && s.tabBtnActive,
              // Native tab metrics on narrow web: equal-width, compact padding so
              // 4 tabs fit a phone instead of overflowing with desktop padding.
              isMobile && { flex: 1, gap: 5, paddingVertical: 13, paddingHorizontal: 4 },
            ]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <t.icon size={isMobile ? 17 : 15} color={tab === t.key ? Colors.primary : '#64748b'} strokeWidth={2.2} />
            <Text
              style={[s.tabBtnTxt, tab === t.key && s.tabBtnTxtActive, isMobile && { fontSize: 12.5 }]}
              numberOfLines={1}
            >
              {isMobile ? t.shortLabel : t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'queue'    && <PendingQueueTab onJumpToUser={(id) => setTab('user')} />}
      {tab === 'reports'  && <ReportsInboxTab />}
      {tab === 'user'     && <UserWalletTab />}
      {tab === 'settings' && <SettingsTab />}
    </Root>
  );
}

// ─── TAB 1: Pending Queue ──────────────────────────────────────────────────

function PendingQueueTab({ onJumpToUser }: { onJumpToUser: (userId: string) => void }) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'queue'],
    queryFn: () => adminAPI.getQueueSummary(),
  });

  const summary: QueueSummary | undefined = data?.data;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg }}>
      <View style={s.queueHeader}>
        <Text style={s.sectionTitle}>What needs your action</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} color="#64748b" strokeWidth={2} />
          <Text style={s.refreshTxt}>{isFetching ? 'Refreshing…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Counters */}
          <View style={s.queueCountsRow}>
            <CountCard
              label="Withdrawals waiting"
              count={summary?.pendingWithdrawals.count ?? 0}
              icon={ArrowDownToLine}
              tint="#d97706" bg="#fef3c7"
            />
            <CountCard
              label="Ready to confirm"
              count={summary?.readyToConfirm.count ?? 0}
              icon={CheckCircle}
              tint="#16a34a" bg="#dcfce7"
              hint="Lock period has expired"
            />
            <CountCard
              label="Recent imports"
              count={summary?.recentImports?.length ?? 0}
              icon={FileSpreadsheet}
              tint="#2563eb" bg="#dbeafe"
              hint="Last 5 ingestions"
            />
          </View>

          {/* Pending withdrawals list */}
          <Text style={s.subsectionTitle}>Pending withdrawals</Text>
          {(summary?.pendingWithdrawals.items ?? []).length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTxt}>No pending withdrawals 🎉</Text>
            </View>
          ) : (
            <View style={s.listCard}>
              {(summary?.pendingWithdrawals.items ?? []).map((w, idx, arr) => (
                <View key={w._id} style={[s.listRow, idx === arr.length - 1 && s.listRowLast]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listPrimary}>{w.userId?.name || 'Unknown user'}</Text>
                    <Text style={s.listMeta}>
                      ₹{Math.abs(w.amount).toLocaleString('en-IN')}
                      {w.metadata?.coinsRedeemed
                        ? ` · ${w.metadata.coinsRedeemed.toLocaleString('en-IN')} coins`
                        : ''}
                      {' · '}
                      {w.metadata?.method || 'UPI'} · {w.metadata?.paymentDetails || '—'}
                    </Text>
                  </View>
                  <Text style={s.listDate}>{relativeTime(w.createdAt)}</Text>
                  <TouchableOpacity
                    style={s.jumpBtn}
                    onPress={() => onJumpToUser(w.userId?._id || w.userId)}
                  >
                    <Text style={s.jumpBtnTxt}>Open</Text>
                    <ChevronRight size={14} color={Colors.primary} strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Recent imports */}
          <Text style={s.subsectionTitle}>Recent report imports</Text>
          {(summary?.recentImports ?? []).length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTxt}>No reports imported yet — go to Reports Inbox to add one.</Text>
            </View>
          ) : (
            <View style={s.listCard}>
              {(summary?.recentImports ?? []).map((r, idx, arr) => (
                <View key={r._id} style={[s.listRow, idx === arr.length - 1 && s.listRowLast]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listPrimary}>{r.merchant.toUpperCase()}</Text>
                    <Text style={s.listMeta}>
                      {r.matchedRows} matched · {r.unmatchedRows} unmatched · ₹{r.totalCommissionCredited.toLocaleString('en-IN')} credited
                    </Text>
                  </View>
                  <Text style={s.listDate}>{relativeTime(r.importedAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function CountCard({
  label, count, icon: Icon, tint, bg, hint,
}: {
  label: string;
  count: number;
  icon: React.ComponentType<any>;
  tint: string;
  bg: string;
  hint?: string;
}) {
  return (
    <View style={s.countCard}>
      <View style={[s.countIconWrap, { backgroundColor: bg }]}>
        <Icon size={20} color={tint} strokeWidth={2.2} />
      </View>
      <Text style={s.countNumber}>{count}</Text>
      <Text style={s.countLabel}>{label}</Text>
      {hint ? <Text style={s.countHint}>{hint}</Text> : null}
    </View>
  );
}

// ─── TAB 2: Reports Inbox ──────────────────────────────────────────────────

const MERCHANT_OPTIONS = [
  { value: 'amazon',   label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'myntra',   label: 'Myntra' },
  { value: 'meesho',   label: 'Meesho' },
  { value: 'ajio',     label: 'Ajio / Reliance' },
  { value: 'nykaa',    label: 'Nykaa' },
  { value: 'cuelinks', label: 'Cuelinks (aggregator)' },
  { value: 'admitad',  label: 'Admitad (aggregator)' },
];

// Common column name variants per field. Lowercase + trimmed during match.
// Enriched with the exact headers Cuelinks and Amazon Associates use in their
// dashboards + CSV exports, so a paste from either flows through auto-mapped.
const COLUMN_ALIASES: Record<string, string[]> = {
  orderId: [
    // Generic
    'order_id', 'orderid', 'order id', 'purchase_id', 'transaction_id', 'order',
    // Cuelinks
    'transaction id', 'clickref',
    // Amazon Associates
    'orderid', 'items shipped', 'items ordered',
  ],
  subid: [
    // Generic
    'subid', 'subid1', 'sub_id', 'aff_sub', 'sub',
    // Amazon Associates uses either name
    'ascsubtag', 'sub tag', 'tracking id',
    // Cuelinks
    'aff_sub_id', 'subid1',
  ],
  amount: [
    'amount', 'sale_amount', 'order_amount', 'gmv', 'sale',
    // Amazon Associates
    'price', 'revenue', 'earnings for period',
    // Cuelinks
    'sale amount', 'transaction amount',
  ],
  commission: [
    'commission', 'cashback', 'payout', 'publisher_commission', 'earning',
    // Amazon Associates
    'earnings', 'ad earnings', 'commission earned',
    // Cuelinks
    'publisher earning', 'cashback amount', 'payout amount',
  ],
  status: [
    'status', 'order_status', 'transaction_status',
    // Cuelinks
    'transaction status', 'order state',
  ],
};

function detectColumns(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normalised = header.map((h) => h.trim().toLowerCase());
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalised.findIndex((n) => aliases.includes(n));
    if (idx >= 0) map[field] = idx;
  }
  return map;
}

function parseCsv(text: string): { rows: ParsedRow[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'Need a header row + at least one data row.' };

  // Detect delimiter: tab > comma.
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const split = (s: string) => s.split(delim).map((c) => c.replace(/^["']|["']$/g, '').trim());

  const header = split(lines[0]);
  const cols = detectColumns(header);
  if (cols.orderId == null || cols.commission == null) {
    return { rows: [], error: 'Could not find order_id and commission columns in the header.' };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const orderId   = cells[cols.orderId] || '';
    const subid     = cols.subid != null      ? (cells[cols.subid]      || '') : '';
    const amount    = cols.amount != null     ? Number(cells[cols.amount])     || 0 : 0;
    const commission = Number(cells[cols.commission]) || 0;
    const status    = cols.status != null     ? (cells[cols.status] || 'confirmed').toLowerCase() : 'confirmed';
    if (!orderId) continue;
    rows.push({ orderId, subid, amount, commission, status, rawIndex: i });
  }
  return { rows };
}

function ReportsInboxTab() {
  const qc = useQueryClient();
  const [merchant, setMerchant] = useState('amazon');
  const [csvText, setCsvText] = useState('');
  const [parseError, setParseError] = useState<string | undefined>();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const { width } = useWindowDimensions();
  const isMobile = computeIsMobile(width);

  // Fetch current coin-economy settings so the preview estimate matches
  // exactly what the server will credit (instead of the old hard-coded 10x).
  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminAPI.getSettings(),
  });
  const passThroughPercent = settingsQuery.data?.data?.settings?.passThroughPercent ?? 0.25;
  const coinsPerRupee      = settingsQuery.data?.data?.settings?.coinsPerRupee ?? 1000;

  const importMutation = useMutation({
    mutationFn: async () => {
      return adminAPI.importReport({
        merchant,
        rows: parsedRows.map((r) => ({
          orderId: r.orderId,
          subid: r.subid,
          amount: r.amount,
          commission: r.commission,
          status: r.status,
        })),
      });
    },
    onSuccess: (res) => {
      setImportResult(res?.data);
      setCsvText('');
      setParsedRows([]);
      qc.invalidateQueries({ queryKey: ['admin', 'queue'] });
      qc.invalidateQueries({ queryKey: ['admin', 'reports', 'imports'] });
    },
    onError: (err: any) => {
      Alert.alert('Import failed', err?.response?.data?.message || err?.message || 'Try again');
    },
  });

  const handleParse = () => {
    const { rows, error } = parseCsv(csvText);
    setParseError(error);
    setParsedRows(rows);
    setImportResult(null);
  };

  const summary = useMemo(() => {
    if (!parsedRows.length) return null;
    const matched = parsedRows.filter((r) => r.subid?.startsWith('cr_') && !r.subid.includes('anon_')).length;
    const totalCommission = parsedRows.reduce((sum, r) => sum + (r.commission || 0), 0);
    // Preview estimate uses the LIVE settings so admin sees the actual
    // credit amount, not a hardcoded ballpark. Deal-configured promo
    // overrides are still applied server-side per row — this is a floor.
    const estimatedCoins = Math.round(totalCommission * passThroughPercent * coinsPerRupee);
    return {
      total: parsedRows.length,
      matched,
      unmatched: parsedRows.length - matched,
      totalCommission,
      estimatedCoins,
    };
  }, [parsedRows, passThroughPercent, coinsPerRupee]);

  const historyQuery = useQuery({
    queryKey: ['admin', 'reports', 'imports'],
    queryFn: () => adminAPI.listReportImports({ limit: 20 }),
  });
  const history = historyQuery.data?.data?.imports ?? [];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={s.sectionTitle}>Import a merchant report</Text>
      <Text style={s.sectionSub}>
        Paste the CSV (or tab-separated rows) from your merchant's affiliate dashboard.
        Columns auto-detect; each row matches to a user via the
        <Text style={{ fontWeight: '700' }}> cr_&lt;userId&gt; </Text>
        subid pattern. Matched users get <Text style={{ fontWeight: '700' }}>coins</Text> credited
        per the deal's <Text style={{ fontWeight: '700' }}>coinsReward</Text>; if no deal match,
        the system falls back to commission × 10 coins.
      </Text>

      <View style={s.formCard}>
        {/* Merchant */}
        <Text style={s.label}>Merchant</Text>
        <View style={s.merchantRow}>
          {MERCHANT_OPTIONS.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[s.merchantChip, merchant === m.value && s.merchantChipActive]}
              onPress={() => setMerchant(m.value)}
            >
              <Text style={[s.merchantChipTxt, merchant === m.value && s.merchantChipTxtActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CSV textarea */}
        <Text style={[s.label, { marginTop: 16 }]}>
          Report data (paste CSV / TSV)
        </Text>
        <Text style={s.labelHelp}>
          Headers we recognise: order_id, subid (or ascsubtag), amount, commission, status
        </Text>
        <TextInput
          style={s.csvInput}
          value={csvText}
          onChangeText={setCsvText}
          placeholder={
            'order_id,subid,amount,commission,status\n' +
            'AMZ-123,cr_64f8a2b9c1d2e3f4a5b6c7d8,1500,75,confirmed\n' +
            'AMZ-124,cr_64f9c3e0a1b2c3d4e5f6a7b8,2800,140,confirmed'
          }
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
        />

        <View style={s.formActions}>
          <TouchableOpacity
            style={[s.parseBtn, !csvText.trim() && { opacity: 0.5 }]}
            disabled={!csvText.trim()}
            onPress={handleParse}
          >
            <FileText size={14} color="#fff" strokeWidth={2.2} />
            <Text style={s.parseBtnTxt}>Parse Report</Text>
          </TouchableOpacity>
          {parsedRows.length > 0 && (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => { setParsedRows([]); setCsvText(''); setParseError(undefined); setImportResult(null); }}
            >
              <Trash2 size={14} color="#dc2626" strokeWidth={2.2} />
              <Text style={s.clearBtnTxt}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {parseError ? (
          <View style={s.errorBox}>
            <AlertCircle size={14} color="#dc2626" strokeWidth={2.2} />
            <Text style={s.errorTxt}>{parseError}</Text>
          </View>
        ) : null}
      </View>

      {/* Preview */}
      {summary && (
        <>
          <Text style={s.subsectionTitle}>Preview</Text>
          <View style={s.summaryGrid}>
            <SummaryStat label="Total rows"    value={String(summary.total)}                  tint="#0f172a" />
            <SummaryStat label="Will match"    value={String(summary.matched)}                tint="#16a34a" />
            <SummaryStat label="Unmatched"     value={String(summary.unmatched)}              tint="#d97706" />
            <SummaryStat
              label="~ Coins to credit"
              value={`${summary.estimatedCoins.toLocaleString('en-IN')}`}
              tint="#7c3aed"
            />
          </View>

          {isMobile ? (
            /* Mobile: card layout per row (native + narrow web) */
            <View style={{ gap: 10 }}>
              {parsedRows.slice(0, 20).map((r) => {
                const willMatch = r.subid?.startsWith('cr_') && !r.subid.includes('anon_');
                return (
                  <View key={r.rawIndex} style={s.mobilePreviewCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }} numberOfLines={1}>{r.orderId}</Text>
                      {willMatch ? (
                        <View style={[s.matchPill, { backgroundColor: '#dcfce7' }]}>
                          <Text style={[s.matchPillTxt, { color: '#16a34a' }]}>subid ✓</Text>
                        </View>
                      ) : (
                        <View style={[s.matchPill, { backgroundColor: '#fef3c7' }]}>
                          <Text style={[s.matchPillTxt, { color: '#d97706' }]}>unmatched</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                      <View>
                        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600' }}>AMOUNT</Text>
                        <Text style={{ fontSize: 13, color: Colors.text, marginTop: 2 }}>₹{r.amount.toLocaleString('en-IN')}</Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600' }}>COMM</Text>
                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>₹{r.commission.toLocaleString('en-IN')}</Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600' }}>≈ COINS</Text>
                        <Text style={{ fontSize: 13, color: '#7c3aed', fontWeight: '700', marginTop: 2 }}>
                          {Math.round(r.commission * passThroughPercent * coinsPerRupee).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              {parsedRows.length > 20 ? (
                <Text style={s.previewMore}>… and {parsedRows.length - 20} more rows.</Text>
              ) : null}
            </View>
          ) : (
            /* Desktop: table layout */
            <View style={s.tableCard}>
              <View style={s.previewHeader}>
                <Text style={[s.previewCell, { flex: 1.4 }]}>Order ID</Text>
                <Text style={[s.previewCell, { flex: 2.2 }]}>Subid</Text>
                <Text style={[s.previewCell, { flex: 1 }]}>Amount</Text>
                <Text style={[s.previewCell, { flex: 1 }]}>Comm ₹</Text>
                <Text style={[s.previewCell, { flex: 1 }]}>≈ Coins</Text>
                <Text style={[s.previewCell, { flex: 1 }]}>Status</Text>
                <Text style={[s.previewCell, { flex: 0.8 }]}>Match</Text>
              </View>
              {parsedRows.slice(0, 20).map((r) => {
                const willMatch = r.subid?.startsWith('cr_') && !r.subid.includes('anon_');
                return (
                  <View key={r.rawIndex} style={s.previewRow}>
                    <Text style={[s.previewCellTxt, { flex: 1.4 }]} numberOfLines={1}>{r.orderId}</Text>
                    <Text style={[s.previewCellTxt, { flex: 2.2, color: willMatch ? '#0f172a' : '#94a3b8' }]} numberOfLines={1}>
                      {r.subid || '—'}
                    </Text>
                    <Text style={[s.previewCellTxt, { flex: 1 }]}>₹{r.amount.toLocaleString('en-IN')}</Text>
                    <Text style={[s.previewCellTxt, { flex: 1, color: '#64748b' }]}>
                      ₹{r.commission.toLocaleString('en-IN')}
                    </Text>
                    <Text style={[s.previewCellTxt, { flex: 1, color: '#7c3aed', fontWeight: '700' }]}>
                      {Math.round(r.commission * passThroughPercent * coinsPerRupee).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[s.previewCellTxt, { flex: 1 }]}>{r.status}</Text>
                    <View style={{ flex: 0.8 }}>
                      {willMatch ? (
                        <View style={[s.matchPill, { backgroundColor: '#dcfce7' }]}>
                          <Text style={[s.matchPillTxt, { color: '#16a34a' }]}>subid</Text>
                        </View>
                      ) : (
                        <View style={[s.matchPill, { backgroundColor: '#fef3c7' }]}>
                          <Text style={[s.matchPillTxt, { color: '#d97706' }]}>unmatched</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              {parsedRows.length > 20 ? (
                <Text style={s.previewMore}>… and {parsedRows.length - 20} more rows.</Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={[s.importBtn, importMutation.isPending && { opacity: 0.6 }]}
            disabled={importMutation.isPending}
            onPress={() => importMutation.mutate()}
          >
            {importMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Upload size={15} color="#fff" strokeWidth={2.4} />
                  <Text style={s.importBtnTxt}>Import {summary.total} rows</Text>
                </>
              )}
          </TouchableOpacity>
        </>
      )}

      {/* Import result */}
      {importResult && (
        <View style={s.resultCard}>
          <View style={s.resultHeader}>
            <CheckCircle size={18} color="#16a34a" strokeWidth={2.4} />
            <Text style={s.resultTitle}>Import complete</Text>
          </View>
          <Text style={s.resultLine}>
            {importResult.summary.matched} of {importResult.summary.total} rows credited —
            <Text style={{ fontWeight: '700' }}> {importResult.summary.totalCommissionCredited.toLocaleString('en-IN')} coins</Text> pending lock.
          </Text>
          {importResult.summary.unmatched > 0 ? (
            <Text style={s.resultLine}>
              {importResult.summary.unmatched} unmatched — Phase 3 click-log fallback will catch these.
            </Text>
          ) : null}
          {importResult.summary.failed > 0 ? (
            <Text style={[s.resultLine, { color: '#dc2626' }]}>
              {importResult.summary.failed} rows failed (duplicates, missing orderId, zero commission).
            </Text>
          ) : null}
        </View>
      )}

      {/* History */}
      <Text style={s.subsectionTitle}>Past imports</Text>
      {historyQuery.isLoading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : history.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>No imports yet.</Text>
        </View>
      ) : (
        <View style={s.listCard}>
          {history.map((h: any, idx: number) => (
            <View key={h._id} style={[s.listRow, idx === history.length - 1 && s.listRowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={s.listPrimary}>{h.merchant.toUpperCase()}</Text>
                <Text style={s.listMeta}>
                  {h.matchedRows} matched · {h.unmatchedRows} unmatched · {h.failedRows} failed
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.listPrimary}>{(h.totalCommissionCredited || 0).toLocaleString('en-IN')} coins</Text>
                <Text style={s.listDate}>{relativeTime(h.importedAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SummaryStat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={s.summaryStat}>
      <Text style={s.summaryStatLabel}>{label}</Text>
      <Text style={[s.summaryStatValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

// ─── TAB 3: User Wallet ────────────────────────────────────────────────────

function UserWalletTab() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isNarrow = width < 700;

  const searchQuery = useQuery({
    queryKey: ['admin', 'users', 'search', search],
    queryFn: () => adminAPI.getUsers({ search, limit: 10 }),
    enabled: search.length >= 2,
  });
  const searchResults: TimelineUser[] = searchQuery.data?.data?.users ?? [];

  if (isNarrow && selectedId) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, backgroundColor: '#f1f5f9' }}
          onPress={() => setSelectedId(null)}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>← Back to search</Text>
        </TouchableOpacity>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
          <UserTimelineDetail userId={selectedId} />
        </ScrollView>
      </View>
    );
  }

  if (isNarrow) {
    return (
      <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
        <View style={[s.searchRow, { marginBottom: 12 }]}>
          <Search size={16} color="#94a3b8" strokeWidth={2} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Name, phone, email…"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {search.length < 2 ? (
          <View style={s.emptyHint}>
            <Text style={s.emptyTxt}>Type 2+ characters to search.</Text>
          </View>
        ) : searchQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : searchResults.length === 0 ? (
          <View style={s.emptyHint}>
            <Text style={s.emptyTxt}>No users match "{search}".</Text>
          </View>
        ) : (
          searchResults.map((u) => (
            <TouchableOpacity
              key={u._id}
              style={[s.searchResult, selectedId === u._id && s.searchResultActive]}
              onPress={() => setSelectedId(u._id)}
            >
              <Text style={s.searchResultName} numberOfLines={1}>{u.name}</Text>
              <Text style={s.searchResultMeta} numberOfLines={1}>
                {u.phone || u.email || '—'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Left: search + results */}
      <View style={s.userSearchPane}>
        <View style={s.searchRow}>
          <Search size={16} color="#94a3b8" strokeWidth={2} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Name, phone, email…"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {search.length < 2 ? (
          <View style={s.emptyHint}>
            <Text style={s.emptyTxt}>Type 2+ characters to search.</Text>
          </View>
        ) : searchQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : searchResults.length === 0 ? (
          <View style={s.emptyHint}>
            <Text style={s.emptyTxt}>No users match "{search}".</Text>
          </View>
        ) : (
          <ScrollView>
            {searchResults.map((u) => (
              <TouchableOpacity
                key={u._id}
                style={[s.searchResult, selectedId === u._id && s.searchResultActive]}
                onPress={() => setSelectedId(u._id)}
              >
                <Text style={s.searchResultName} numberOfLines={1}>{u.name}</Text>
                <Text style={s.searchResultMeta} numberOfLines={1}>
                  {u.phone || u.email || '—'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Right: timeline + actions */}
      <View style={{ flex: 1, padding: Spacing.lg }}>
        {selectedId ? (
          <UserTimelineDetail userId={selectedId} />
        ) : (
          <View style={s.emptyDetail}>
            <UserSearch size={40} color="#cbd5e1" strokeWidth={1.5} />
            <Text style={[s.emptyTxt, { fontSize: 14, marginTop: 12 }]}>
              Select a user on the left to see their wallet timeline.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function UserTimelineDetail({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const nativePrompt = useNativePrompt();
  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminAPI.getSettings(),
  });
  const razorpayEnabled = !!settingsQuery.data?.data?.settings?.razorpayEnabled;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'user-timeline', userId],
    queryFn: () => adminAPI.getUserTimeline(userId, { limit: 60 }),
  });

  const user: TimelineUser | undefined = data?.data?.user;
  const wallet: TimelineWallet | null = data?.data?.wallet || null;
  const events: TimelineEvent[] = data?.data?.events || [];

  const pendingWithdrawal = events.find(
    (e) => e.kind === 'transaction' && e.data.type === 'withdrawal' && e.data.status === 'pending',
  );

  const adjustMutation = useMutation({
    mutationFn: (p: { type: 'credit' | 'debit'; amount: number; currency: 'cashback' | 'coins'; note?: string }) =>
      adminAPI.adjustUserWallet(userId, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-timeline', userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'queue'] });
    },
    onError: (e: any) => Alert.alert('Adjust failed', e?.response?.data?.message || e?.message),
  });

  const withdrawalActionMutation = useMutation({
    mutationFn: (p: { id: string; action: 'process' | 'complete' | 'reject'; txnId?: string }) =>
      adminAPI.updateWithdrawal(p.id, { action: p.action, txnId: p.txnId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-timeline', userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'queue'] });
    },
    onError: (e: any) => Alert.alert('Payout failed', e?.response?.data?.message || e?.message),
  });

  const promptAdjust = async (
    type: 'credit' | 'debit',
    currency: 'cashback' | 'coins',
  ) => {
    const noun = currency === 'coins' ? 'coins' : '₹';
    const amountStr = await nativePrompt.prompt(
      `${type === 'credit' ? 'Credit' : 'Debit'} how many ${noun}?`,
      'Enter amount',
    );
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid', 'Enter a positive number.');
      return;
    }
    const note = await nativePrompt.prompt('Reason (optional)');
    adjustMutation.mutate({ type, amount, currency, note: note || undefined });
  };

  const handleCreditCoins  = () => promptAdjust('credit', 'coins');
  const handleDebitCoins   = () => promptAdjust('debit', 'coins');
  const handleQuickCredit  = () => promptAdjust('credit', 'cashback');
  const handleQuickDebit   = () => promptAdjust('debit', 'cashback');

  if (isLoading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />;
  if (!user)    return <Text>User not found</Text>;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header card: identity + wallet stats */}
      <View style={s.userCard}>
        <View style={s.userCardTop}>
          <View>
            <Text style={s.userCardName}>{user.name}</Text>
            <Text style={s.userCardMeta}>
              {user.phone ?? '—'}{user.email ? ` · ${user.email}` : ''} · joined {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={s.userCardActions}>
            <TouchableOpacity style={s.smallActBtn} onPress={() => refetch()}>
              <RefreshCw size={13} color="#64748b" strokeWidth={2.2} />
              <Text style={s.smallActBtnTxt}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.walletStats}>
          <WalletStat label="Confirmed" value={`₹${(wallet?.confirmedCashback ?? 0).toLocaleString('en-IN')}`} tint="#16a34a" />
          <WalletStat label="Pending"   value={`₹${(wallet?.pendingCashback ?? 0).toLocaleString('en-IN')}`}   tint="#d97706" />
          <WalletStat label="Coins"     value={(wallet?.coins ?? 0).toLocaleString('en-IN')}                   tint="#7c3aed" />
          <WalletStat label="Lifetime"  value={`₹${(wallet?.lifetimeEarned ?? 0).toLocaleString('en-IN')}`}    tint="#0f172a" />
        </View>

        <View style={s.userCardBtnRow}>
          {/* Coins — primary currency in this economy */}
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#ede9fe' }]} onPress={handleCreditCoins}>
            <Plus size={14} color="#7c3aed" strokeWidth={2.4} />
            <Text style={[s.actBtnTxt, { color: '#7c3aed' }]}>Credit Coins</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#fef3c7' }]} onPress={handleDebitCoins}>
            <Minus size={14} color="#a16207" strokeWidth={2.4} />
            <Text style={[s.actBtnTxt, { color: '#a16207' }]}>Debit Coins</Text>
          </TouchableOpacity>

          {/* Cashback — kept for goodwill credits / support refunds. */}
          <View style={{ width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 4 }} />
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#dcfce7' }]} onPress={handleQuickCredit}>
            <Plus size={14} color="#16a34a" strokeWidth={2.4} />
            <Text style={[s.actBtnTxt, { color: '#16a34a' }]}>Credit ₹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#fee2e2' }]} onPress={handleQuickDebit}>
            <Minus size={14} color="#dc2626" strokeWidth={2.4} />
            <Text style={[s.actBtnTxt, { color: '#dc2626' }]}>Debit ₹</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending withdrawal — surfaced at the top */}
      {pendingWithdrawal && (
        <View style={s.pendingWithdrawalCard}>
          <View style={s.pendingWdLeft}>
            <View style={s.pendingWdIcon}>
              <ArrowDownToLine size={18} color="#d97706" strokeWidth={2.4} />
            </View>
            <View>
              <Text style={s.pendingWdTitle}>
                Pending withdrawal — ₹{Math.abs(pendingWithdrawal.data.amount).toLocaleString('en-IN')}
                {pendingWithdrawal.data.metadata?.coinsRedeemed
                  ? ` (${pendingWithdrawal.data.metadata.coinsRedeemed.toLocaleString('en-IN')} coins)`
                  : ''}
              </Text>
              <Text style={s.pendingWdMeta}>
                {pendingWithdrawal.data.metadata?.method || 'UPI'} · {pendingWithdrawal.data.metadata?.paymentDetails || '—'} · requested {relativeTime(pendingWithdrawal.timestamp)}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={[s.actBtn, { backgroundColor: '#dcfce7' }]}
              disabled={withdrawalActionMutation.isPending}
              onPress={async () => {
                if (razorpayEnabled) {
                  // RazorpayX auto-payout — server pays the user's UPI/bank; no manual TXN id.
                  withdrawalActionMutation.mutate({ id: pendingWithdrawal.data._id, action: 'complete' });
                } else {
                  const txnId = await nativePrompt.prompt('Paste UPI/bank TXN id (optional)');
                  withdrawalActionMutation.mutate({ id: pendingWithdrawal.data._id, action: 'complete', txnId: txnId || undefined });
                }
              }}
            >
              <Text style={[s.actBtnTxt, { color: '#16a34a' }]}>
                {razorpayEnabled ? 'Pay via Razorpay' : 'Approve & Pay'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actBtn, { backgroundColor: '#fee2e2' }]}
              onPress={() => withdrawalActionMutation.mutate({ id: pendingWithdrawal.data._id, action: 'reject' })}
            >
              <Text style={[s.actBtnTxt, { color: '#dc2626' }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Timeline */}
      <Text style={s.subsectionTitle}>Wallet timeline</Text>
      <View style={s.timelineCard}>
        {events.length === 0 ? (
          <Text style={s.emptyTxt}>No events yet.</Text>
        ) : (
          events.map((ev, idx) => (
            <TimelineRow key={`${ev.kind}-${ev.data._id || idx}`} event={ev} isLast={idx === events.length - 1} />
          ))
        )}
      </View>
      {nativePrompt.modal}
    </ScrollView>
  );
}

function WalletStat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={s.walletStatBox}>
      <Text style={s.walletStatLabel}>{label}</Text>
      <Text style={[s.walletStatValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

function TimelineRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  if (event.kind === 'click') {
    const c = event.data;
    return (
      <View style={[s.timelineRow, !isLast && s.timelineRowBorder]}>
        <View style={[s.timelineIcon, { backgroundColor: '#f1f5f9' }]}>
          <MousePointerClick size={14} color="#64748b" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.timelinePrimary}>Click · {c.merchant || 'unknown'}</Text>
          <Text style={s.timelineMeta} numberOfLines={1}>
            {c.dealId?.title || c.dealId?.brand || c.originalUrl}
          </Text>
        </View>
        <Text style={s.timelineDate}>{relativeTime(c.createdAt)}</Text>
      </View>
    );
  }

  // Transaction event — colour + icon depend on type / status / sign
  const t = event.data;
  const isWithdrawal = t.type === 'withdrawal';
  const isCoin = t.type === 'coin_credit' || t.type === 'coin_debit';
  const positive = t.amount >= 0;
  const statusColors: Record<string, { tint: string; bg: string }> = {
    confirmed:  { tint: '#16a34a', bg: '#dcfce7' },
    pending:    { tint: '#d97706', bg: '#fef3c7' },
    processing: { tint: '#2563eb', bg: '#dbeafe' },
    completed:  { tint: '#16a34a', bg: '#dcfce7' },
    rejected:   { tint: '#dc2626', bg: '#fee2e2' },
  };
  const sc = statusColors[t.status] || { tint: '#64748b', bg: '#f1f5f9' };
  const Icon = isWithdrawal ? ArrowDownToLine : isCoin ? Coins : IndianRupee;

  return (
    <View style={[s.timelineRow, !isLast && s.timelineRowBorder]}>
      <View style={[s.timelineIcon, { backgroundColor: sc.bg }]}>
        <Icon size={14} color={sc.tint} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.timelinePrimary}>
          {t.description}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <View style={[s.statusChip, { backgroundColor: sc.bg }]}>
            <Text style={[s.statusChipTxt, { color: sc.tint }]}>{t.status}</Text>
          </View>
          {t.metadata?.orderId ? (
            <Text style={s.timelineMeta}>order {t.metadata.orderId}</Text>
          ) : null}
        </View>
      </View>
      <Text style={[s.timelineAmount, { color: positive ? '#16a34a' : '#dc2626' }]}>
        {positive ? '+' : ''}{isCoin ? t.amount : `₹${Math.abs(t.amount).toLocaleString('en-IN')}`}
      </Text>
      <Text style={s.timelineDate}>{relativeTime(t.createdAt)}</Text>
    </View>
  );
}

// ─── TAB 4: Settings ───────────────────────────────────────────────────────

function SettingsTab() {
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const isMobile = computeIsMobile(width);
  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminAPI.getSettings(),
  });

  const [pt, setPt]                     = useState('');
  const [rate, setRate]                 = useState('');
  const [lockDays, setLockDays]         = useState('');
  const [cuelinksId, setCuelinksId]     = useState('');
  const [amazonTag, setAmazonTag]       = useState('');

  const server = settingsQuery.data?.data?.settings;

  React.useEffect(() => {
    if (!server) return;
    setPt(String(Math.round(server.passThroughPercent * 100)));
    setRate(String(server.coinsPerRupee));
    setLockDays(String(server.defaultLockDays));
    setCuelinksId(server.cuelinksPublisherId ?? '');
    setAmazonTag(server.amazonAssociateTag ?? '');
  }, [server]);

  const save = useMutation({
    mutationFn: () => adminAPI.updateSettings({
      passThroughPercent: Number(pt) / 100,
      coinsPerRupee:      Number(rate),
      defaultLockDays:    Number(lockDays),
      cuelinksPublisherId: cuelinksId.trim(),
      amazonAssociateTag:  amazonTag.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      Alert.alert('Saved', 'Coin economy settings updated.');
    },
    onError: (e: any) => Alert.alert('Save failed', e?.response?.data?.message || e?.message),
  });

  // Live example preview based on the CURRENT inputs (before save).
  const previewCoins = useMemo(() => {
    const p = Number(pt) / 100;
    const r = Number(rate);
    if (!Number.isFinite(p) || !Number.isFinite(r) || p < 0 || r < 1) return null;
    // Sample: ₹1000 order, 5% commission = ₹50.
    return {
      commission: 50,
      coins: Math.round(50 * p * r),
      userRupees: Math.round(50 * p * 100) / 100,
      houseKeep: Math.round(50 * (1 - p) * 100) / 100,
    };
  }, [pt, rate]);

  if (settingsQuery.isLoading) {
    return <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={s.sectionTitle}>Coin economy</Text>
      <Text style={s.sectionSub}>
        The three numbers below define how much every user earns from every
        purchase and how coins convert to ₹ at withdrawal time. Changes affect
        NEW credits and NEW withdrawals only — historical records lock their
        rates in.
      </Text>

      <View style={s.formCard}>
        <View style={[s.settingsRow, isMobile && { flexDirection: 'column' }]}>
          <View style={s.settingsField}>
            <Text style={s.label}>Pass-through %</Text>
            <Text style={s.labelHelp}>
              Slice of every ₹ of commission we give to the user as coins. 25 = 25%.
            </Text>
            <TextInput
              style={s.settingsInput}
              value={pt}
              onChangeText={(v) => setPt(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="25"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={s.settingsField}>
            <Text style={s.label}>Coins per ₹1</Text>
            <Text style={s.labelHelp}>
              Conversion rate. 10 = 10 coins equal ₹1. Used at both credit AND redemption.
            </Text>
            <TextInput
              style={s.settingsInput}
              value={rate}
              onChangeText={(v) => setRate(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={s.settingsField}>
            <Text style={s.label}>Lock period (days)</Text>
            <Text style={s.labelHelp}>
              How long pending coins wait before confirming. Match your typical merchant return window.
            </Text>
            <TextInput
              style={s.settingsInput}
              value={lockDays}
              onChangeText={(v) => setLockDays(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {previewCoins ? (
          <View style={s.livePreview}>
            <Text style={s.livePreviewLabel}>Live example — ₹1,000 order at 5% commission:</Text>
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 6, flexWrap: 'wrap' }}>
              <Text style={s.livePreviewLine}>Commission: <Text style={{ fontWeight: '700' }}>₹{previewCoins.commission}</Text></Text>
              <Text style={s.livePreviewLine}>User gets: <Text style={{ fontWeight: '700', color: '#7c3aed' }}>{previewCoins.coins} coins</Text> (≈ ₹{previewCoins.userRupees})</Text>
              <Text style={s.livePreviewLine}>We keep: <Text style={{ fontWeight: '700', color: '#16a34a' }}>₹{previewCoins.houseKeep}</Text></Text>
            </View>
          </View>
        ) : null}
      </View>

      <Text style={[s.sectionTitle, { marginTop: 28 }]}>Merchant credentials</Text>
      <Text style={s.sectionSub}>
        These IDs get stamped into every affiliate URL as the user clicks. Set once
        after you sign up with the network — you can leave them blank until then.
      </Text>

      <View style={s.formCard}>
        <View style={[s.settingsRow, isMobile && { flexDirection: 'column' }]}>
          <View style={[s.settingsField, { flex: 1 }]}>
            <Text style={s.label}>Cuelinks publisher ID</Text>
            <Text style={s.labelHelp}>Used in linksredirect.com URLs for non-Amazon merchants.</Text>
            <TextInput
              style={s.settingsInput}
              value={cuelinksId}
              onChangeText={setCuelinksId}
              placeholder="cuelinks-xxxxx"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={[s.settingsField, { flex: 1 }]}>
            <Text style={s.label}>Amazon associate tag</Text>
            <Text style={s.labelHelp}>Appended as ?tag=&lt;yourtag&gt; on every Amazon URL.</Text>
            <TextInput
              style={s.settingsInput}
              value={amazonTag}
              onChangeText={setAmazonTag}
              placeholder="chingiringi-21"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[s.importBtn, save.isPending && { opacity: 0.6 }]}
        onPress={() => save.mutate()}
        disabled={save.isPending}
      >
        {save.isPending
          ? <ActivityIndicator color="#fff" />
          : (
            <>
              <Save size={15} color="#fff" strokeWidth={2.4} />
              <Text style={s.importBtnTxt}>Save settings</Text>
            </>
          )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title:    { fontSize: 24, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, maxWidth: 700 },

  tabBar: {
    flexDirection: 'row',
    gap: isNative ? 0 : 8,
    paddingHorizontal: isNative ? 0 : Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: isNative ? '#fff' : 'transparent',
  },
  tabBtn: {
    flex: isNative ? 1 : undefined,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isNative ? 5 : 8,
    paddingVertical: isNative ? 13 : 12,
    paddingHorizontal: isNative ? 4 : 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabBtnTxt: { fontSize: isNative ? 12.5 : 14, fontWeight: '600', color: '#64748b' },
  tabBtnTxtActive: { color: Colors.primary },

  // Common
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: Colors.textSecondary, marginBottom: 18, maxWidth: 760 },
  subsectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 24, marginBottom: 8 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#fff', borderRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  refreshTxt: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#e8ecf2',
  },
  emptyTxt: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#e8ecf2',
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  listRowLast: { borderBottomWidth: 0 },
  listPrimary: { fontSize: 14, fontWeight: '700', color: Colors.text },
  listMeta:    { fontSize: 12, color: '#64748b', marginTop: 2 },
  listDate:    { fontSize: 11, color: '#94a3b8' },

  jumpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#eff6ff', borderRadius: 8,
  },
  jumpBtnTxt: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // ── Queue tab
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  queueCountsRow: { flexDirection: 'row', gap: 14, marginTop: 12, marginBottom: 8, flexWrap: 'wrap' },
  countCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1, borderColor: '#e8ecf2',
  },
  countIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  countNumber: { fontSize: 32, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  countLabel:  { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 2 },
  countHint:   { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  // ── Reports Inbox tab
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1, borderColor: '#e8ecf2',
  },
  label:     { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 0.4, textTransform: 'uppercase' },
  labelHelp: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  merchantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  merchantChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#f1f5f9', borderRadius: 16,
  },
  merchantChipActive: { backgroundColor: Colors.primary },
  merchantChipTxt: { fontSize: 12, fontWeight: '600', color: '#475569' },
  merchantChipTxtActive: { color: '#fff' },

  csvInput: {
    marginTop: 8,
    minHeight: 160,
    borderWidth: 1, borderColor: '#e2e8f0',
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', fontFamily: 'monospace' } as any) : {}),
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  parseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.primary, borderRadius: 8,
  },
  parseBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fee2e2', borderRadius: 8,
  },
  clearBtnTxt: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', padding: 10, borderRadius: 8,
    marginTop: 10,
  },
  errorTxt: { fontSize: 12, color: '#dc2626', flex: 1 },

  summaryGrid: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 14, flexWrap: 'wrap' },
  summaryStat: {
    flex: 1,
    minWidth: isNative ? '45%' as any : 100,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1, borderColor: '#e8ecf2',
  },
  summaryStatLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  summaryStatValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },

  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#e8ecf2',
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e8ecf2',
  },
  previewCell:    { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  previewRow: {
    flexDirection: 'row',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  previewCellTxt: { fontSize: 12, color: Colors.text },
  previewMore:    { padding: 12, fontSize: 12, color: '#64748b', textAlign: 'center' },

  matchPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  matchPillTxt: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: isNative ? 'stretch' : 'flex-start',
    marginTop: 12,
  },
  importBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  resultCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  resultTitle: { fontSize: 14, fontWeight: '700', color: '#16a34a' },
  resultLine:  { fontSize: 13, color: '#0f172a', marginTop: 2 },

  // ── User Wallet tab
  userSearchPane: {
    width: 280,
    backgroundColor: '#fff',
    borderRightWidth: 1, borderRightColor: '#e2e8f0',
    padding: 14,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1, borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  emptyHint: { padding: 24, alignItems: 'center' },
  searchResult: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, marginBottom: 4,
  },
  searchResultActive: { backgroundColor: '#eff6ff' },
  searchResultName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  searchResultMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },

  emptyDetail: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  userCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1, borderColor: '#e8ecf2',
    marginBottom: 14,
  },
  userCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userCardName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  userCardMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  userCardActions: { flexDirection: 'row', gap: 8 },
  smallActBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#f1f5f9', borderRadius: 8,
  },
  smallActBtnTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  walletStats: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  walletStatBox: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    padding: 12,
  },
  walletStatLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  walletStatValue: { fontSize: isNative ? 16 : 20, fontWeight: '800', marginTop: 4 },

  userCardBtnRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  actBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8,
  },
  actBtnTxt: { fontSize: 13, fontWeight: '700' },

  pendingWithdrawalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1, borderColor: '#fde68a',
    marginBottom: 14,
  },
  pendingWdLeft: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  pendingWdIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fef9c3',
    justifyContent: 'center', alignItems: 'center',
  },
  pendingWdTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  pendingWdMeta:  { fontSize: 12, color: '#a16207', marginTop: 2 },

  timelineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#e8ecf2',
    paddingHorizontal: 4,
  },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  timelineRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  timelineIcon: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  timelinePrimary: { fontSize: 13, fontWeight: '600', color: Colors.text },
  timelineMeta:    { fontSize: 11, color: '#64748b' },
  timelineAmount:  { fontSize: 14, fontWeight: '700' },
  timelineDate:    { fontSize: 11, color: '#94a3b8', minWidth: 60, textAlign: 'right' },

  statusChip: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  statusChipTxt: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // Settings tab
  settingsRow: { flexDirection: isNative ? 'column' : 'row', gap: 14, flexWrap: 'wrap' } as any,
  settingsField: { flex: isNative ? undefined : 1, minWidth: isNative ? undefined : 200 },
  settingsInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 44,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  livePreview: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  livePreviewLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
  livePreviewLine:  { fontSize: 13, color: '#0f172a' },

  // Mobile preview card (Reports Inbox)
  mobilePreviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },

  // Native prompt modal
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promptCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },
  promptInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    minHeight: 46,
  },
  promptBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  promptCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  promptCancelTxt: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  promptSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  promptSubmitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default WalletOperationsScreen;
