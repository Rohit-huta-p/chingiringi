import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface VideoLayerProps {
  source: string | null;
  isActive: boolean;
  muted: boolean;
}

/** Native player (iOS/Android) — expo-video plays HLS directly. */
export const VideoLayer: React.FC<VideoLayerProps> = ({ source, isActive, muted }) => {
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

export default VideoLayer;
