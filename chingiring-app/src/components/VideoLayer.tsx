import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface VideoLayerProps {
  source: string | null;
  isActive: boolean;
  muted: boolean;
  /** Tap-to-pause: when true, hold the active clip paused. */
  paused?: boolean;
}

/** Native player (iOS/Android) — expo-video plays HLS via AVPlayer / ExoPlayer. */
export const VideoLayer: React.FC<VideoLayerProps> = ({ source, isActive, muted, paused = false }) => {
  // Type the source as HLS so AVPlayer (iOS) reliably loads the .m3u8 manifest and
  // its video tracks — a bare URI string can leave an HLS stream un-played on iOS.
  // Memoised so a new object identity each render doesn't recreate the player.
  const videoSource = useMemo(
    () => (source ? { uri: source, contentType: 'hls' as const } : null),
    [source],
  );
  const player = useVideoPlayer(videoSource, (p) => { p.loop = true; p.muted = muted; });
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');

  const shouldPlay = isActive && !paused;
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => { shouldPlay ? player.play() : player.pause(); }, [shouldPlay, player]);

  useEffect(() => {
    setFit('cover'); // reset until this source's real aspect is known
    const sub = player.addListener('sourceLoad', ({ availableVideoTracks }) => {
      const sz = availableVideoTracks?.[0]?.size;
      if (sz?.width && sz?.height) setFit(sz.width > sz.height ? 'contain' : 'cover');
      // Source is ready now — (re)issue play so a play() that fired before the
      // manifest finished loading (common on iOS) doesn't leave the clip paused.
      if (shouldPlayRef.current) player.play();
    });
    return () => sub.remove();
  }, [player, source]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit={fit}
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
};

export default VideoLayer;
