import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface VideoLayerProps {
  source: string | null;
  isActive: boolean;
  muted: boolean;
  /** Tap-to-pause: when true, hold the active clip paused. */
  paused?: boolean;
}

/** Native player (iOS/Android) — expo-video plays HLS directly. */
export const VideoLayer: React.FC<VideoLayerProps> = ({ source, isActive, muted, paused = false }) => {
  const player = useVideoPlayer(source, (p) => { p.loop = true; p.muted = muted; });
  // Portrait/square fills the frame (cover); landscape is letterboxed (contain) so
  // it sits centred and uncropped. Aspect comes from the loaded track's size.
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => { (isActive && !paused) ? player.play() : player.pause(); }, [isActive, paused, player]);
  useEffect(() => {
    setFit('cover'); // reset until this source's real aspect is known
    const sub = player.addListener('sourceLoad', ({ availableVideoTracks }) => {
      const sz = availableVideoTracks?.[0]?.size;
      if (sz?.width && sz?.height) setFit(sz.width > sz.height ? 'contain' : 'cover');
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
