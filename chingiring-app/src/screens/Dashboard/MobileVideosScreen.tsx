import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable,
  useWindowDimensions, Share, ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PlaySquare } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useVideoFeed, useVideoEngagement } from '../../hooks/useVideoFeed';
import { VideoFeedItem, SAMPLE_VIDEOS } from '../../components/VideoFeedItem';
import { FeedVideo, TaggedProduct, VideoStore } from '../../api/videos';

export const MobileVideosScreen = () => {
  const { height } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { videos, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useVideoFeed();
  const { like, share, view } = useVideoEngagement();

  // Dev fallback so the feed renders before the backend/Cloudflare are live.
  const data: FeedVideo[] = videos.length ? videos : (__DEV__ ? SAMPLE_VIDEOS : []);

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Refs so the stable viewability callback reads fresh values (avoids stale closures).
  const dataRef = useRef(data); dataRef.current = data;
  const watchRef = useRef<{ index: number; start: number }>({ index: 0, start: Date.now() });
  const viewMutateRef = useRef(view.mutate); viewMutateRef.current = view.mutate;

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index == null) return;
    // Flush watch-time for the item leaving focus.
    const prev = watchRef.current;
    if (prev.index !== first.index) {
      const secs = Math.round((Date.now() - prev.start) / 1000);
      const prevVideo = dataRef.current[prev.index];
      if (prevVideo && secs > 0) viewMutateRef.current({ id: prevVideo._id, watchSec: secs });
      watchRef.current = { index: first.index, start: Date.now() };
      setActiveIndex(first.index);
    }
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 80 });

  const onProductPress = useCallback((p: TaggedProduct) => {
    navigation.navigate('ProductDetail', { productId: p._id, product: p });
  }, [navigation]);

  const onStorePress = useCallback((_store: VideoStore) => {
    navigation.navigate('Stores');
  }, [navigation]);

  const onLike = useCallback((v: FeedVideo) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.has(v._id) ? next.delete(v._id) : next.add(v._id);
      return next;
    });
    like.mutate(v._id);
  }, [like]);

  const onShare = useCallback(async (v: FeedVideo) => {
    try {
      await Share.share({ message: `Check out ${v.store?.name || 'this'} on Chingiring 🎬` });
      share.mutate(v._id);
    } catch { /* user dismissed */ }
  }, [share]);

  const renderItem = useCallback(({ item, index }: { item: FeedVideo; index: number }) => (
    <VideoFeedItem
      video={item}
      isActive={index === activeIndex}
      muted={muted}
      height={height}
      liked={likedIds.has(item._id)}
      likeCount={(item.stats?.likes || 0) + (likedIds.has(item._id) ? 1 : 0)}
      onToggleMute={() => setMuted((m) => !m)}
      onProductPress={onProductPress}
      onStorePress={onStorePress}
      onLike={() => onLike(item)}
      onShare={() => onShare(item)}
    />
  ), [activeIndex, muted, height, likedIds, onProductPress, onStorePress, onLike, onShare]);

  if (isLoading && !data.length) {
    return <View style={s.center}><ActivityIndicator color="#fff" /></View>;
  }
  if (isError && !data.length) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Couldn’t load videos</Text>
        <Pressable style={s.retry} onPress={() => refetch()}><Text style={s.retryTxt}>Retry</Text></Pressable>
      </View>
    );
  }
  if (!data.length) {
    return (
      <View style={s.center}>
        <View style={s.iconBox}><PlaySquare size={44} color={Colors.primary} strokeWidth={1.6} /></View>
        <Text style={s.emptyTitle}>No videos yet</Text>
        <Text style={s.emptySub}>Shoppable clips from stores will show up here.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <FlatList
        data={data}
        keyExtractor={(v) => v._id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        removeClippedSubviews
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
      />
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0b0f16', alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconBox: {
    width: 82, height: 82, borderRadius: 24, backgroundColor: 'rgba(71,132,226,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { color: '#fff', fontFamily: Fonts.extraBold, fontSize: 20, marginBottom: 6 },
  emptySub: { color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', maxWidth: 280 },
  retry: { marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryTxt: { color: '#fff', fontFamily: Fonts.bold, fontSize: 14 },
});

export default MobileVideosScreen;
