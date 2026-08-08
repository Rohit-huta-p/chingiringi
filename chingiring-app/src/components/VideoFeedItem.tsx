import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Heart, Share2, Volume2, VolumeX, BadgeCheck, ChevronRight } from 'lucide-react-native';
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
  onProductPress: (p: TaggedProduct) => void;
  onStorePress: (store: VideoStore) => void;
  onLike: () => void;
  onShare: () => void;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const discountPct = (price: number, mrp?: number) =>
  mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : 0;

/**
 * Native-only player layer. Never mounted on web — browsers outside Safari have
 * no native HLS and expo-video stalls the web renderer, so web shows the poster
 * only. Isolating the hook here keeps expo-video entirely off the web path.
 */
const VideoLayer: React.FC<{ source: string | null; isActive: boolean; muted: boolean }> = ({ source, isActive, muted }) => {
  const player = useVideoPlayer(source, (p) => { p.loop = true; p.muted = muted; });
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => { isActive ? player.play() : player.pause(); }, [isActive, player]);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
};

export const VideoFeedItem: React.FC<Props> = ({
  video, isActive, muted, height, liked, likeCount,
  onToggleMute, onProductPress, onStorePress, onLike, onShare,
}) => {
  const products = video.taggedProducts ?? [];
  const primary = products[0];
  const store = video.store;

  return (
    <View style={[s.page, { height }]}>
      {/* Poster underlay (shows until the video paints, and on web where HLS may not play) */}
      {!!video.thumbnailUrl && (
        <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      {Platform.OS !== 'web' && (
        <VideoLayer source={video.hlsUrl || null} isActive={isActive} muted={muted} />
      )}
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
          : <View style={[s.storeLogo, s.storeInitial]}><Text style={s.storeInitialTxt}>{(store?.shortName || '?')[0]?.toUpperCase()}</Text></View>}
        <Text style={s.storeName} numberOfLines={1}>{store?.shortName || store?.name}</Text>
        {store?.isVerified && <BadgeCheck size={15} color={Colors.primary} fill={Colors.primary} strokeWidth={0} />}
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

      {/* Caption + product card — bottom */}
      <View style={s.bottom}>
        {!!video.caption && <Text style={s.caption} numberOfLines={2}>{video.caption}</Text>}

        {products.length <= 1 ? (
          primary && <ProductCard product={primary} onPress={() => onProductPress(primary)} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
            {products.map((p) => (
              <View key={p._id} style={s.carouselCard}>
                <ProductCard product={p} onPress={() => onProductPress(p)} compact />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const ProductCard: React.FC<{ product: TaggedProduct; onPress: () => void; compact?: boolean }> = ({ product, onPress, compact }) => {
  const off = discountPct(product.price, product.mrp);
  const thumb = product.images?.[0];
  return (
    <Pressable style={[s.card, compact && s.cardCompact]} onPress={onPress}>
      {thumb
        ? <Image source={{ uri: thumb }} style={s.cardThumb} />
        : <View style={[s.cardThumb, s.cardThumbEmpty]} />}
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={1}>{product.name}</Text>
        <View style={s.priceRow}>
          <Text style={s.price}>{inr(product.price)}</Text>
          {off > 0 && <Text style={s.mrp}>{inr(product.mrp!)}</Text>}
          {off > 0 && <Text style={s.off}>{off}% OFF</Text>}
        </View>
      </View>
      <View style={s.shopBtn}>
        <Text style={s.shopTxt}>Shop</Text>
        <ChevronRight size={15} color="#fff" />
      </View>
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
    store: { _id: 's1', name: 'Brew & Co', shortName: 'brewandco', logoUrl: 'https://picsum.photos/seed/brewlogo/80', isVerified: true },
    taggedProducts: [{ _id: 'p1', name: 'Signature Cold Brew', price: 180, mrp: 240, images: ['https://picsum.photos/seed/coldbrew/120'] }],
  },
  {
    _id: 'sample2', streamUid: 'y', status: 'ready',
    hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    thumbnailUrl: 'https://picsum.photos/seed/fashion/540/1080',
    durationSec: 30, caption: 'Festive collection just dropped ✨ limited sizes.',
    hashtags: [], cta: { type: 'shop' }, publishedAt: new Date(0).toISOString(),
    stats: { views: 3400, likes: 3400, shares: 120, saves: 210 },
    store: { _id: 's2', name: 'Trendline Fashion', shortName: 'trendline', logoUrl: 'https://picsum.photos/seed/trendlogo/80', isVerified: true },
    taggedProducts: [{ _id: 'p2', name: 'Wine Anarkali Set', price: 1499, mrp: 2199, images: ['https://picsum.photos/seed/anarkali/120'] }],
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
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 58 },
  caption: { color: '#fff', fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18, marginBottom: 10, marginRight: 70, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 5 },
  carousel: { gap: 10, paddingRight: 60 },
  carouselCard: { width: 240 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11, marginRight: 60,
    backgroundColor: 'rgba(15,16,20,0.62)', borderRadius: 16, padding: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  cardCompact: { marginRight: 0 },
  cardThumb: { width: 46, height: 46, borderRadius: 11, backgroundColor: '#333' },
  cardThumbEmpty: { backgroundColor: 'rgba(255,255,255,0.12)' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  price: { color: '#fff', fontFamily: Fonts.extraBold, fontSize: 14 },
  mrp: { color: 'rgba(255,255,255,0.55)', fontFamily: Fonts.regular, fontSize: 11, textDecorationLine: 'line-through' },
  off: { color: '#fff', backgroundColor: Colors.success, fontFamily: Fonts.bold, fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, overflow: 'hidden' },
  shopBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.primary, paddingVertical: 9, paddingLeft: 13, paddingRight: 9, borderRadius: 11 },
  shopTxt: { color: '#fff', fontFamily: Fonts.bold, fontSize: 12.5 },
});

export default VideoFeedItem;
