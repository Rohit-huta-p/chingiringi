import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Ticket,
  Users as UsersIcon,
  IndianRupee,
  TrendingUp,
  BarChart3,
  Inbox,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { adminAPI } from '../../api/admin';

// ─── Types ──────────────────────────────────────────────────────────

interface UsageTotals {
  redemptions: number;
  uniqueUsers: number;
  discountGiven: number;
  revenueFromRedemptions: number;
  avgOrderValue: number;
}
interface TimelineEntry {
  date: string;
  count: number;
  discount: number;
}
interface TopUser {
  userId: string;
  name?: string;
  username?: string;
  count: number;
  totalDiscount: number;
}
interface UsageResponse {
  coupon: { _id: string; code: string; usageLimit: number; usedCount: number; perUserLimit: number };
  totals: UsageTotals;
  timeline: TimelineEntry[];
  topUsers: TopUser[];
}

const fmtINR = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtNum = (n: number) => (n || 0).toLocaleString('en-IN');
const fmtDay = (ymd: string) =>
  new Date(ymd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

// ─── Screen ─────────────────────────────────────────────────────────

export const MobileAdminCouponUsage = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { couponId, couponCode } = route.params ?? {};

  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['admin-coupon-usage', couponId],
    queryFn: () => adminAPI.getCouponUsage(couponId),
    enabled: !!couponId,
  });

  const payload: UsageResponse | null = res?.data ?? null;

  const maxTimelineCount = useMemo(() => {
    if (!payload?.timeline?.length) return 1;
    return Math.max(1, ...payload.timeline.map((t) => t.count));
  }, [payload]);

  // Timeline needs chronological order for display (api sends -_id sort)
  const sortedTimeline = useMemo(() => {
    if (!payload?.timeline) return [];
    return [...payload.timeline].sort((a, b) => a.date.localeCompare(b.date));
  }, [payload]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <View style={s.headerTextBlock}>
          <Text style={s.headerTitle}>Coupon Usage</Text>
          <View style={s.headerCodeRow}>
            <Ticket size={13} color="rgba(255,255,255,0.9)" strokeWidth={2} />
            <Text style={s.headerCode}>{couponCode || payload?.coupon?.code || '...'}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Inbox size={42} color="#cbd5e1" strokeWidth={1.5} />
          <Text style={s.errTitle}>Couldn't load usage</Text>
          <Text style={s.errSub}>{(error as any)?.message || 'Please try again.'}</Text>
        </View>
      ) : !payload ? (
        <View style={s.center}>
          <Inbox size={42} color="#cbd5e1" strokeWidth={1.5} />
          <Text style={s.errTitle}>No data</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={s.body}>

            {/* Overall progress */}
            <View style={s.progressCard}>
              <Text style={s.progressLabel}>Overall usage</Text>
              <Text style={s.progressCount}>
                {fmtNum(payload.coupon.usedCount)}
                {payload.coupon.usageLimit > 0 ? (
                  <Text style={s.progressTotal}> / {fmtNum(payload.coupon.usageLimit)}</Text>
                ) : (
                  <Text style={s.progressTotal}> used (unlimited)</Text>
                )}
              </Text>
              {payload.coupon.usageLimit > 0 && (
                <View style={s.progressTrack}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.round((payload.coupon.usedCount / payload.coupon.usageLimit) * 100),
                        )}%` as any,
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            {/* Stats grid */}
            <View style={s.statsGrid}>
              <StatCard
                icon={<BarChart3 size={18} color="#3b82f6" strokeWidth={2} />}
                label="Redemptions"
                value={fmtNum(payload.totals.redemptions)}
              />
              <StatCard
                icon={<UsersIcon size={18} color="#22c55e" strokeWidth={2} />}
                label="Unique users"
                value={fmtNum(payload.totals.uniqueUsers)}
              />
              <StatCard
                icon={<IndianRupee size={18} color="#ef4444" strokeWidth={2} />}
                label="Discount given"
                value={fmtINR(payload.totals.discountGiven)}
              />
              <StatCard
                icon={<TrendingUp size={18} color="#6366f1" strokeWidth={2} />}
                label="Order revenue"
                value={fmtINR(payload.totals.revenueFromRedemptions)}
              />
            </View>

            <View style={s.singleStatRow}>
              <Text style={s.singleStatLabel}>Avg. order value</Text>
              <Text style={s.singleStatVal}>
                {fmtINR(Math.round(payload.totals.avgOrderValue || 0))}
              </Text>
            </View>

            {/* Timeline */}
            <Text style={s.sectionTitle}>Last 30 days</Text>
            {sortedTimeline.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTxt}>No redemptions in the last 30 days</Text>
              </View>
            ) : (
              <View style={s.timelineCard}>
                {sortedTimeline.map((t) => {
                  const pct = Math.max(4, Math.round((t.count / maxTimelineCount) * 100));
                  return (
                    <View key={t.date} style={s.timelineRow}>
                      <Text style={s.timelineDate}>{fmtDay(t.date)}</Text>
                      <View style={s.timelineBarTrack}>
                        <View style={[s.timelineBarFill, { width: `${pct}%` as any }]} />
                      </View>
                      <Text style={s.timelineCount}>{t.count}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Top users */}
            <Text style={s.sectionTitle}>Top users</Text>
            {payload.topUsers.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTxt}>No redemptions yet</Text>
              </View>
            ) : (
              <View style={s.topUsersCard}>
                {payload.topUsers.map((u, idx) => (
                  <View key={u.userId} style={[s.topUserRow, idx === payload.topUsers.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={s.topUserLeft}>
                      <View style={s.topUserAvatar}>
                        <Text style={s.topUserAvatarTxt}>
                          {(u.name || u.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={s.topUserName}>{u.name || u.username || 'Unknown'}</Text>
                        <Text style={s.topUserMeta}>
                          {u.count} redemption{u.count === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.topUserDiscount}>{fmtINR(u.totalDiscount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── StatCard ───────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={s.statCard}>
      <View style={s.statIcon}>{icon}</View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statVal}>{value}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  headerTextBlock: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerCode: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600', letterSpacing: 0.6 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errTitle: { fontSize: 15, fontWeight: '700', color: '#64748b', marginTop: 12 },
  errSub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center', maxWidth: 260 },

  body: { padding: 16 },

  progressCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  progressLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  progressCount: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginTop: 4 },
  progressTotal: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  progressTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#22c55e' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  statCard: {
    width: '48%' as any, flexGrow: 1,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  statIcon: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  statVal: { fontSize: 18, fontWeight: '800', color: '#1e293b' },

  singleStatRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#eef2f7', marginBottom: 16,
  },
  singleStatLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  singleStatVal: { fontSize: 14, fontWeight: '800', color: '#1e293b' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 6, marginBottom: 10 },

  emptyBox: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#eef2f7', marginBottom: 14,
  },
  emptyTxt: { fontSize: 13, color: '#94a3b8' },

  timelineCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#eef2f7', marginBottom: 14,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  timelineDate: { width: 56, fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  timelineBarTrack: { flex: 1, height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
  timelineBarFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 5 },
  timelineCount: { width: 36, textAlign: 'right', fontSize: 12, fontWeight: '700', color: '#1e293b' },

  topUsersCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#eef2f7', marginBottom: 14, overflow: 'hidden',
  },
  topUserRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  topUserLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topUserAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#e0e7ff',
    justifyContent: 'center', alignItems: 'center',
  },
  topUserAvatarTxt: { fontSize: 13, fontWeight: '800', color: '#3730a3' },
  topUserName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  topUserMeta: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  topUserDiscount: { fontSize: 13, fontWeight: '800', color: '#ef4444' },
});
