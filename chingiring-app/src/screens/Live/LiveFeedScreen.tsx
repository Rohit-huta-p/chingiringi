/**
 * LiveFeedScreen — Reels-style vertical pager over the active live streams.
 *
 * Opened from the buyer Live tab (OfflineStoresScreen) with the already-shuffled
 * list and the tapped index, so the swipe order matches the grid:
 *   navigation.navigate('LiveFeed', { streams, startIndex })
 *
 * A full-screen vertical paging FlatList renders one <LiveViewerPage> per
 * stream. Only the on-screen page is `isActive` (plays video + joins the
 * socket); its immediate neighbour is `isAdjacent` (pre-warms the player,
 * paused). Paging can't scroll past the first/last page, so the ends "resist"
 * (rubber-band + snap back) with no extra code.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, type ViewToken } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LiveViewerPage } from '../../components/LiveViewerPage';
import type { LiveStream } from '../Buyer/LiveDiscoveryScreen';
import { Colors, Fonts } from '../../constants/theme';

interface RouteParams {
  streams: LiveStream[];
  startIndex?: number;
}

export const LiveFeedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { streams = [], startIndex = 0 }: RouteParams = route.params ?? {};

  // Measure the pane so each page is exactly one screen tall and paging snaps.
  const [pageH, setPageH] = useState(0);
  const [activeIndex, setActiveIndex] = useState(startIndex);

  const exit = useCallback(() => navigation.goBack(), [navigation]);

  // Stable refs — RN forbids changing these between renders.
  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first && typeof first.index === 'number') setActiveIndex(first.index);
  });
  const viewCfgRef = useRef({ itemVisiblePercentThreshold: 80 });

  if (!streams.length) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.empty}>No live streams right now.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={(e) => setPageH(e.nativeEvent.layout.height)}>
      {pageH > 0 && (
        <FlatList
          data={streams}
          extraData={activeIndex}
          keyExtractor={(s) => s._id}
          renderItem={({ item, index }) => (
            <View style={{ height: pageH }}>
              <LiveViewerPage
                stream={item}
                isActive={index === activeIndex}
                isAdjacent={Math.abs(index - activeIndex) === 1}
                onExit={exit}
              />
            </View>
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={pageH}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({ length: pageH, offset: pageH * index, index })}
          initialScrollIndex={startIndex}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewCfgRef.current}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: { color: Colors.textSecondary, fontSize: 14, fontFamily: Fonts.regular },
});

export default LiveFeedScreen;
