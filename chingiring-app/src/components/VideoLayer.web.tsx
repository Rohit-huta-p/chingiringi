import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export interface VideoLayerProps {
  source: string | null;
  isActive: boolean;
  muted: boolean;
}

/**
 * Web player. Browsers outside Safari can't play HLS (.m3u8) natively, so we use
 * hls.js; Safari uses its built-in HLS. Renders a real <video> element (this file
 * is web-only — Metro resolves .web.tsx on web, VideoLayer.tsx on native).
 */
export const VideoLayer: React.FC<VideoLayerProps> = ({ source, isActive, muted }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !source) return;
    let hls: Hls | undefined;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source; // Safari — native HLS
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(source);
      hls.attachMedia(video);
    } else {
      video.src = source; // last resort
    }
    return () => { hls?.destroy(); };
  }, [source]);

  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive) v.play?.().catch(() => {}); // autoplay may reject until muted/interacted
    else v.pause?.();
  }, [isActive]);

  return (
    <video
      ref={ref}
      muted={muted}
      loop
      playsInline
      style={{ position: 'absolute', inset: 0 as any, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
    />
  );
};

export default VideoLayer;
