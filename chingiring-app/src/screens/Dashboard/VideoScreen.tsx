import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { VideoFeedItem } from '../../components/VideoFeedItem';
import { CommentsSheet } from '../../components/CommentsSheet';
import { VideoMoreSheet } from '../../components/VideoMoreSheet';
import { useVideoEngagement } from '../../hooks/useVideoFeed';
import { shareVideo } from '../../utils/shareVideo';
import { videosAPI, FeedVideo } from '../../api/videos';
import { Colors, Fonts } from '../../constants/theme';

/**
 * A single shareable clip — the landing page for /video/:videoId. Registered at
 * the top level of BOTH navigators (like ProductDetail), so a shared link resolves
 * on mobile and desktop web alike. Reuses <VideoFeedItem/> + <CommentsSheet/>.
 */
export const VideoScreen = () => {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;
  const videoId = route.params?.videoId as string | undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => videosAPI.getVideo(videoId!),
    enabled: !!videoId,
  });
  const video = data?.data?.video as FeedVideo | undefined;

  const { like, share } = useVideoEngagement();
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [likeToggle, setLikeToggle] = useState<boolean | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const goBack = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Home'));

  const onLike = useCallback(() => {
    if (!video) return;
    setLikeToggle((prev) => (prev == null ? !video.likedByMe : !prev));
    like.mutate(video._id);
  }, [video, like]);

  const onShare = useCallback(async () => {
    if (!video) return;
    const ok = await shareVideo(video);
    if (ok) share.mutate(video._id); // count only — no coins
  }, [video, share]);

  if (isLoading) return <View style={s.center}><ActivityIndicator color="#fff" size="large" /></View>;
  if (isError || !video) {
    return (
      <View style={s.center}>
        <Text style={s.errTitle}>Video unavailable</Text>
        <Text style={s.errSub}>This clip may have been removed.</Text>
        <Pressable style={s.cta} onPress={goBack}><Text style={s.ctaTxt}>Go to app</Text></Pressable>
      </View>
    );
  }

  const liked = likeToggle == null ? !!video.likedByMe : likeToggle;
  const likeCount = (video.stats?.likes || 0) + (liked ? 1 : 0) - (video.likedByMe ? 1 : 0);
  const frameH = Math.round(height * 0.92);
  const frameW = Math.round(frameH * 9 / 16);
  const bottomOffset = isDesktopWeb ? 58 : 88 + Math.max(insets.bottom, 8) + 14;

  const feedItem = (h: number) => (
    <VideoFeedItem
      video={video}
      isActive
      muted={muted}
      height={h}
      liked={liked}
      likeCount={likeCount}
      onToggleMute={() => setMuted((m) => !m)}
      onStorePress={() => {}}
      onLike={onLike}
      onShare={onShare}
      onComment={() => setShowComments(true)}
      onMore={() => setShowMore(true)}
      bottomOffset={bottomOffset}
      paused={paused}
      onTogglePause={() => setPaused((p) => !p)}
      muteRight={isDesktopWeb ? 14 : 60}
    />
  );

  return (
    <View style={[s.root, isDesktopWeb && s.rootWeb]}>
      {isDesktopWeb ? (
        <View style={[s.stage, { height }]}>
          <View style={[s.frame, { width: frameW, height: frameH }]}>
            {feedItem(frameH)}
            {showComments && <CommentsSheet inline visible video={video} onClose={() => setShowComments(false)} />}
          </View>
        </View>
      ) : (
        feedItem(height)
      )}

      <Pressable style={[s.backBtn, { top: insets.top + 10 }]} onPress={goBack} hitSlop={8}>
        <ChevronLeft size={26} color="#fff" />
      </Pressable>

      {!isDesktopWeb && <CommentsSheet visible={showComments} video={video} onClose={() => setShowComments(false)} />}

      {/* Report hides the clip for this user — leave the page after acting. */}
      <VideoMoreSheet visible={showMore} video={video} onClose={() => setShowMore(false)} onActioned={goBack} />
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  rootWeb: { backgroundColor: '#0b0d12' },
  stage: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0b0f16', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  errTitle: { color: '#fff', fontFamily: Fonts.extraBold, fontSize: 20 },
  errSub: { color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center' },
  cta: { marginTop: 14, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  ctaTxt: { color: '#fff', fontFamily: Fonts.bold, fontSize: 14 },
  backBtn: {
    position: 'absolute', left: 14, width: 40, height: 40, borderRadius: 20, zIndex: 30,
    backgroundColor: 'rgba(20,20,25,0.5)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
});

export default VideoScreen;
