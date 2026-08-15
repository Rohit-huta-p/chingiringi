import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { adminAPI } from '../../api/admin';
import { Colors, Fonts } from '../../constants/theme';

// Format a date as "Aug 15" or "Aug 15, 2025" if not current year
function fmtDate(d: string | Date): string {
  const date = new Date(d);
  const now  = new Date();
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-IN', opts);
}

export function MobileAdminSearchQueries() {
  const [missesOnly, setMissesOnly] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'search-queries', missesOnly],
    queryFn: () => adminAPI.getSearchQueries({ limit: 100, missesOnly }),
    staleTime: 60_000,
  });

  const items: any[] = data?.data?.items ?? [];
  const total: number = data?.data?.total ?? 0;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <MobileAdminNav active="AdminSearchQueries" />

      <View style={st.toolbar}>
        <Text style={st.toolbarLabel}>Misses only (0 results)</Text>
        <Switch
          value={missesOnly}
          onValueChange={setMissesOnly}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.surface}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={st.centre} size="large" color={Colors.primary} />
      ) : isError ? (
        <View style={st.centre}>
          <Text style={st.errorText}>Couldn't load. Tap to retry.</Text>
          <TouchableOpacity onPress={() => refetch()} style={st.retryBtn} activeOpacity={0.7}>
            <Text style={st.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.q}
          contentContainerStyle={st.list}
          ListHeaderComponent={
            <Text style={st.count}>
              {total} {total === 1 ? 'query' : 'queries'}
              {missesOnly ? ' with 0 results' : ''}
            </Text>
          }
          ListEmptyComponent={
            <Text style={st.empty}>No search queries logged yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={st.row}>
              <View style={st.rowMain}>
                <Text style={st.query} numberOfLines={1}>{item.q}</Text>
                <View style={st.meta}>
                  <Text style={st.metaTxt}>
                    {item.lastResultCount === 0
                      ? '❌ 0 results'
                      : `✓ ${item.lastResultCount} result${item.lastResultCount === 1 ? '' : 's'}`}
                  </Text>
                  <Text style={st.metaSep}>·</Text>
                  <Text style={st.metaTxt}>last {fmtDate(item.lastSeenAt)}</Text>
                </View>
              </View>
              <View style={[st.badge, item.lastResultCount === 0 && st.badgeMiss]}>
                <Text style={[st.badgeTxt, item.lastResultCount === 0 && st.badgeMissTxt]}>
                  {item.count}×
                </Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={st.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  toolbarLabel: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },

  list:  { paddingBottom: 24 },
  count: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textSecondary, padding: 16, paddingBottom: 8 },
  empty: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', paddingTop: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  rowMain: { flex: 1, marginRight: 12 },
  query:   { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaTxt: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },
  metaSep: { fontSize: 12, color: Colors.border },

  badge: {
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeMiss: { backgroundColor: '#fee2e2' },
  badgeTxt:  { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textSecondary },
  badgeMissTxt: { color: Colors.danger },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 16 },

  errorText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  retryBtn:  { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:  { fontSize: 14, fontFamily: Fonts.semiBold, color: '#fff' },
});
