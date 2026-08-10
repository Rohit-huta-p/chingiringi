import React, { useEffect } from 'react';
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
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => { (isActive && !paused) ? player.play() : player.pause(); }, [isActive, paused, player]);
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

export default VideoLayer;
