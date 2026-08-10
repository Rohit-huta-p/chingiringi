import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable,
  useWindowDimensions, Share, Platform, ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaySquare, ChevronUp, ChevronDown } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useVideoFeed, useVideoEngagement } from '../../hooks/useVideoFeed';
import { VideoFeedItem, SAMPLE_VIDEOS } from '../../components/VideoFeedItem';
import { FeedVideo, VideoStore } from '../../api/videos';

export const MobileVideosScreen = () => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { videos, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useVideoFeed();
  const { like, share, view } = useVideoEngagement();

  // Dev fallback so the feed renders before the backend/Cloudflare are live.
  const data: FeedVideo[] = videos.length ? videos : (__DEV__ ? SAMPLE_VIDEOS : []);

  // Desktop web = centered 9:16 stage; native + narrow web = full-screen swipe.
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  // Optimistic like overrides keyed by video id. When a clip has no override we fall back to
  // the server's `likedByMe` (from the optional-auth feed), so a refresh keeps the heart red
  // for likes you already made.
  const [likeOverrides, setLikeOverrides] = useState<Map<string, boolean>>(new Map());
  // Height of the list's OWN viewport, measured in onLayout. Pages are sized to THIS, not the
  // window height — the window is slightly taller than the scroll area (status bar / layout),
  // so window-sized pages overflow and let you drag a bit before snapping. Fallback to the
  // window height until the first layout pass.
  const [listH, setListH] = useState(0);
  const itemH = listH || height;

  const frameH = Math.round(itemH * 0.92);
  const frameW = Math.round(frameH * 9 / 16);
  // MobileTabBar height = paddingTop 8 + barInner 64 + paddingBottom max(insets.bottom, 8),
  // and its centre Home circle pokes ~16px higher (marginTop -28). Clear all of that plus a
  // gap so the caption/product block sits above the bar on mobile. Desktop (drawer, no bottom
  // bar) keeps the original aesthetic gap.
  const bottomOffset = isDesktopWeb ? 58 : 88 + Math.max(insets.bottom, 8) + 14;

  const listRef = useRef<FlatList>(null);
  // Refs so the stable viewability + keyboard callbacks read fresh values.
  const dataRef = useRef(data); dataRef.current = data;
  const activeRef = useRef(0); activeRef.current = activeIndex;
  const watchRef = useRef<{ index: number; start: number }>({ index: 0, start: Date.now() });
  const viewMutateRef = useRef(view.mutate); viewMutateRef.current = view.mutate;

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index == null) return;
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

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, dataRef.current.length - 1));
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
  }, []);

  // A newly-active clip always starts playing — clear any tap-pause from the previous one.
  useEffect(() => { setPaused(false); }, [activeIndex]);

  // Keyboard navigation on desktop web (↑/↓).
  useEffect(() => {
    if (!isDesktopWeb || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); goTo(activeRef.current + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(activeRef.current - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDesktopWeb, goTo]);

  const onStorePress = useCallback((_store: VideoStore) => {
    navigation.navigate('Stores');
  }, [navigation]);

  const onLike = useCallback((v: FeedVideo) => {
    const current = likeOverrides.has(v._id) ? !!likeOverrides.get(v._id) : !!v.likedByMe;
    setLikeOverrides((prev) => new Map(prev).set(v._id, !current));
    like.mutate(v._id);
  }, [likeOverrides, like]);

  const onShare = useCallback(async (v: FeedVideo) => {
    try {
      await Share.share({ message: `Check out ${v.store?.name || 'this'} on Chingiring 🎬` });
      share.mutate(v._id);
    } catch { /* user dismissed */ }
  }, [share]);

  const renderItem = useCallback(({ item, index }: { item: FeedVideo; index: number }) => {
    // Override wins if the user tapped this session; otherwise trust the server flag. The
    // server count already includes the user's own like, so only adjust when display ≠ server.
    const liked = likeOverrides.has(item._id) ? !!likeOverrides.get(item._id) : !!item.likedByMe;
    const likeCount = (item.stats?.likes || 0) + (liked ? 1 : 0) - (item.likedByMe ? 1 : 0);
    const feedItem = (h: number) => (
      <VideoFeedItem
        video={item}
        isActive={index === activeIndex}
        muted={muted}
        height={h}
        liked={liked}
        likeCount={likeCount}
        onToggleMute={() => setMuted((m) => !m)}
        onStorePress={onStorePress}
        onLike={() => onLike(item)}
        onShare={() => onShare(item)}
        bottomOffset={bottomOffset}
        paused={paused && index === activeIndex}
        onTogglePause={() => setPaused((p) => !p)}
      />
    );
    if (isDesktopWeb) {
      return (
        <View style={[s.stage, { height: itemH }]}>
          <View style={[s.frame, { width: frameW, height: frameH }]}>{feedItem(frameH)}</View>
        </View>
      );
    }
    return feedItem(itemH);
  }, [activeIndex, muted, paused, itemH, frameH, frameW, isDesktopWeb, bottomOffset, likeOverrides, onStorePress, onLike, onShare]);

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
    <View style={[s.root, isDesktopWeb && s.rootWeb]}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(v) => v._id}
        renderItem={renderItem}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (h > 0 && h !== listH) setListH(h);
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemH}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({ length: itemH, offset: itemH * index, index })}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        removeClippedSubviews
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
      />
      {isDesktopWeb && (
        <View style={s.navCol} pointerEvents="box-none">
          <Pressable style={s.navBtn} onPress={() => goTo(activeIndex - 1)} disabled={activeIndex === 0}>
            <ChevronUp size={22} color="#fff" />
          </Pressable>
          <Pressable style={s.navBtn} onPress={() => goTo(activeIndex + 1)} disabled={activeIndex >= data.length - 1}>
            <ChevronDown size={22} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  rootWeb: { backgroundColor: '#0b0d12' },
  stage: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0d12' },
  frame: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' },
  navCol: { position: 'absolute', right: 28, top: 0, bottom: 0, justifyContent: 'center', gap: 14 },
  navBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
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
