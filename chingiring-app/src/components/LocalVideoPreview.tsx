import React from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface LocalVideoPreviewProps {
  /** Local file uri of the picked clip. */
  uri: string;
}

/** Native preview of a locally-picked clip with the platform video controls. */
export const LocalVideoPreview: React.FC<LocalVideoPreviewProps> = ({ uri }) => {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
    />
  );
};

export default LocalVideoPreview;
