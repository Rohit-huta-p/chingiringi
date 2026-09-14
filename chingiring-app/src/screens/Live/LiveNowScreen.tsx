/**
 * LiveNowScreen — the buyer "Live now · See all" page, pushed from the
 * Live-First feed's Live-now rail. A full grid of every active stream, with
 * the shared category tiles filtering it and a top-viewed sort.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Radio } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { fetchActiveStreams, type LiveStream } from '../Buyer/LiveDiscoveryScreen';
import { CategoryTiles, type CategorySelection } from '../../components/CategoryTiles';
import { LiveCard } from '../../components/LiveCard';

const GAP = 12;
const H_PAD = 16;

export const LiveNowScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [activeCategory, setActiveCategory] = useState<CategorySelection>('All');

  const { data: streams = [], isLoading } = useQuery<LiveStream[]>({
    queryKey: ['streams', 'active'],
    queryFn: fetchActiveStreams,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const cols = width < 768 ? 2 : width < 1200 ? 3 : 4;
  const cardW = Math.floor((width - H_PAD * 2 - GAP * (cols - 1)) / cols);

  const shown = useMemo(() => {
    const list =
      activeCategory === 'All'
        ? [...streams]
        : streams.filter((s) => s.category === activeCategory);
    // Top viewed first.
    return list.sort((a, b) => b.viewerCount - a.viewerCount);
  }, [streams, activeCategory]);

  return (
    <View style={styles.root}>
      {/* Back header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
        </Pressable>
        <View style={styles.titleWrap}>
          <View style={styles.pulse} />
          <Text style={styles.title}>Live now</Text>
        </View>
        <View style={{ flex: 1 }} />
        {streams.length > 0 && (
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>{streams.length} LIVE</Text>
          </View>
        )}
      </View>

      <FlatList
        key={cols}
        data={shown}
        keyExtractor={(s) => s._id}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? { gap: GAP } : undefined}
        contentContainerStyle={{
          paddingHorizontal: H_PAD,
          paddingBottom: insets.bottom + 24,
          gap: GAP,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHead}>
            <CategoryTiles active={activeCategory} onSelect={setActiveCategory} contentStyle={{ paddingHorizontal: 0 }} />
            <View style={styles.subRow}>
              <Text style={styles.subText}>
                {shown.length} {shown.length === 1 ? 'store' : 'stores'} streaming now
              </Text>
              <View style={styles.sortChip}>
                <Text style={styles.sortChipText}>Top viewed</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <LiveCard
            stream={item}
            width={cardW}
            onPress={() =>
              navigation.navigate('ViewerScreen', {
                streamId: item._id,
                storeId: item.storeId,
                storeName: item.storeName,
                storeLogoUrl: item.storeLogoUrl,
                streamTitle: item.title,
              })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {isLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Radio size={40} color={Colors.border} />
                <Text style={styles.emptyText}>
                  {activeCategory === 'All'
                    ? 'No one is live right now'
                    : `No ${activeCategory} stores are live right now`}
                </Text>
              </>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: H_PAD,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulse: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F2685E',
  },
  title: { fontSize: 19, fontFamily: Fonts.extraBold, color: Colors.text },
  livePill: {
    backgroundColor: 'rgba(242,104,94,0.12)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  livePillText: { fontSize: 11, fontFamily: Fonts.bold, color: '#F2685E', letterSpacing: 0.3 },
  listHead: { paddingTop: 6, paddingBottom: 12 },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  subText: { fontSize: 12.5, color: Colors.textSecondary },
  sortChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sortChipText: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.text },
  empty: { padding: 48, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
});

export default LiveNowScreen;
