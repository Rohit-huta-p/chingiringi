import React, { useState } from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Volume2, VolumeX } from 'lucide-react-native';
import VideoLayer from './VideoLayer';
import { FeedVideo } from '../api/videos';

interface Props {
  /** The clip to play; null closes the modal. Only `ready` clips have an hlsUrl. */
  video: FeedVideo | null;
  onClose: () => void;
}

/**
 * Fullscreen playback of a single clip (used by "My Videos" tap-to-play).
 * Reuses <VideoLayer/> (HLS, landscape-aware) with a tap-to-pause layer,
 * a mute toggle and a close button. No feed chrome / products / like rail.
 */
export const VideoPlayerModal: React.FC<Props> = ({ video, onClose }) => {
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const visible = !!video;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.root}>
        {video && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((p) => !p)}>
            <VideoLayer source={video.hlsUrl || null} isActive muted={muted} paused={paused} />
          </Pressable>
        )}
        <SafeAreaView style={s.overlay} edges={['top']} pointerEvents="box-none">
          <Pressable style={s.iconBtn} onPress={onClose} hitSlop={10}>
            <X size={22} color="#fff" />
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => setMuted((m) => !m)} hitSlop={10}>
            {muted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,20,25,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
});

export default VideoPlayerModal;
