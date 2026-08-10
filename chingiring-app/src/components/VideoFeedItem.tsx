import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import VideoLayer from './VideoLayer';
import { Heart, Share2, Volume2, VolumeX, ExternalLink } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { FeedVideo, TaggedProduct, VideoStore } from '../api/videos';

interface Props {
  video: FeedVideo;
  isActive: boolean;
  muted: boolean;
  height: number;
  liked: boolean;
  likeCount: number;
  onToggleMute: () => void;
  onStorePress: (store: VideoStore) => void;
  onLike: () => void;
  onShare: () => void;
  /** Distance (px) to lift the caption+product block off the screen bottom so it
   *  clears the mobile tab bar. Desktop passes the plain aesthetic gap. */
  bottomOffset?: number;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const VideoFeedItem: React.FC<Props> = ({
  video, isActive, muted, height, liked, likeCount,
  onToggleMute, onStorePress, onLike, onShare, bottomOffset = 58,
}) => {
  const products = video.taggedProducts ?? [];
  const primary = products[0];
  const store = video.store;
  const initial = (store?.name || '?').trim()[0]?.toUpperCase() ?? '?';

  return (
    <View style={[s.page, { height }]}>
      {/* Poster underlay (shows until the video paints, and on web where HLS may not play) */}
      {!!video.thumbnailUrl && (
        <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      <VideoLayer source={video.hlsUrl || null} isActive={isActive} muted={muted} />
      {/* legibility scrim */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.75)']}
        locations={[0, 0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Store pill — top-left */}
      <Pressable style={s.storePill} onPress={() => onStorePress(store)} hitSlop={8}>
        {store?.logoUrl
          ? <Image source={{ uri: store.logoUrl }} style={s.storeLogo} />
          : <View style={[s.storeLogo, s.storeInitial]}><Text style={s.storeInitialTxt}>{initial}</Text></View>}
        <Text style={s.storeName} numberOfLines={1}>{store?.name}</Text>
      </Pressable>

      {/* Mute — top-right */}
      <Pressable style={s.mute} onPress={onToggleMute} hitSlop={10}>
        {muted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
      </Pressable>

      {/* Right rail — like + share */}
      <View style={s.rail}>
        <Pressable style={s.railBtn} onPress={onLike} hitSlop={8}>
          <Heart size={30} color={liked ? Colors.danger : '#fff'} fill={liked ? Colors.danger : 'transparent'} />
          <Text style={s.railTxt}>{likeCount > 0 ? likeCount : 'Like'}</Text>
        </Pressable>
        <Pressable style={s.railBtn} onPress={onShare} hitSlop={8}>
          <Share2 size={28} color="#fff" />
          <Text style={s.railTxt}>Share</Text>
        </Pressable>
      </View>

      {/* Caption + product card(s) — bottom */}
      <View style={[s.bottom, { bottom: bottomOffset }]}>
        {!!video.caption && <Text style={s.caption} numberOfLines={2}>{video.caption}</Text>}

        {products.length <= 1 ? (
          primary && <ProductCard product={primary} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
            {products.map((p, i) => (
              <View key={i} style={s.carouselCard}><ProductCard product={p} compact /></View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const ProductCard: React.FC<{ product: TaggedProduct; compact?: boolean }> = ({ product, compact }) => {
  const buyable = !!product.url;
  return (
    <Pressable
      style={[s.card, compact && s.cardCompact]}
      onPress={buyable ? () => Linking.openURL(product.url!) : undefined}
    >
      <View style={s.cardTop}>
        <Text style={s.cardName} numberOfLines={1}>{product.title}</Text>
        <Text style={s.price}>{inr(product.price)}</Text>
      </View>
      {!!product.description && <Text style={s.cardDesc} numberOfLines={2}>{product.description}</Text>}
      {buyable && (
        <View style={s.shopRow}>
          <Text style={s.shopTxt}>Shop now</Text>
          <ExternalLink size={13} color={Colors.primaryLight} />
        </View>
      )}
    </Pressable>
  );
};

/** Dev-only fixture so the item renders before the backend is live. */
export const SAMPLE_VIDEOS: FeedVideo[] = [
  {
    _id: 'sample1', streamUid: 'x', status: 'ready',
    hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    thumbnailUrl: 'https://picsum.photos/seed/brew/540/1080',
    durationSec: 30, caption: 'Cold-brew season is officially open ❄️ new menu live today.',
    hashtags: [], cta: { type: 'shop' }, publishedAt: new Date(0).toISOString(),
    stats: { views: 1200, likes: 1200, shares: 88, saves: 340 },
    store: { name: 'Brew & Co', logoUrl: 'https://picsum.photos/seed/brewlogo/80' },
    taggedProducts: [{ title: 'Signature Cold Brew', description: 'Slow-steeped 18 hours, served over ice.', price: 180, url: 'https://example.com/cold-brew' }],
  },
  {
    _id: 'sample2', streamUid: 'y', status: 'ready',
    hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    thumbnailUrl: 'https://picsum.photos/seed/fashion/540/1080',
    durationSec: 30, caption: 'Festive collection just dropped ✨ limited sizes.',
    hashtags: [], cta: { type: 'shop' }, publishedAt: new Date(0).toISOString(),
    stats: { views: 3400, likes: 3400, shares: 120, saves: 210 },
    store: { name: 'Trendline Fashion', logoUrl: 'https://picsum.photos/seed/trendlogo/80' },
    taggedProducts: [{ title: 'Wine Anarkali Set', description: 'Hand-embroidered, festive-ready.', price: 1499 }],
  },
];

const s = StyleSheet.create({
  page: { width: '100%', backgroundColor: '#000', position: 'relative' },
  storePill: {
    position: 'absolute', top: 52, left: 14, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(20,20,25,0.5)', paddingVertical: 5, paddingLeft: 5, paddingRight: 11, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', maxWidth: '70%',
  },
  storeLogo: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#333' },
  storeInitial: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  storeInitialTxt: { color: '#fff', fontFamily: Fonts.bold, fontSize: 12 },
  storeName: { color: '#fff', fontFamily: Fonts.bold, fontSize: 13 },
  mute: {
    position: 'absolute', top: 52, right: 14, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(20,20,25,0.5)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  rail: { position: 'absolute', right: 12, bottom: 150, alignItems: 'center', gap: 18 },
  railBtn: { alignItems: 'center', gap: 3 },
  railTxt: { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 11, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  bottom: { position: 'absolute', left: 12, right: 12 },
  caption: { color: '#fff', fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18, marginBottom: 10, marginRight: 70, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 5 },
  carousel: { gap: 10, paddingRight: 60 },
  carouselCard: { width: 240 },
  card: {
    marginRight: 60, backgroundColor: 'rgba(15,16,20,0.62)', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', gap: 5,
  },
  cardCompact: { marginRight: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  cardName: { color: '#fff', fontFamily: Fonts.bold, fontSize: 14, flexShrink: 1 },
  price: { color: Colors.primaryLight, fontFamily: Fonts.extraBold, fontSize: 15 },
  cardDesc: { color: 'rgba(255,255,255,0.72)', fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(71,132,226,0.22)', paddingVertical: 5, paddingHorizontal: 11, borderRadius: 9 },
  shopTxt: { color: Colors.primaryLight, fontFamily: Fonts.bold, fontSize: 12 },
});

export default VideoFeedItem;
