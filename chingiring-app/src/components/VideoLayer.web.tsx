import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export interface VideoLayerProps {
  source: string | null;
  isActive: boolean;
  muted: boolean;
  /** Tap-to-pause: when true, hold the active clip paused. */
  paused?: boolean;
}

/**
 * Web player. Chrome/Firefox have no native HLS → hls.js; Safari uses its built-in
 * HLS. Playback starts when the stream is READY (manifest parsed / metadata loaded),
 * not on mount — calling play() before the source is loaded makes muted-autoplay
 * reject and the video sits black. This file is web-only (Metro resolves .web.tsx on
 * web, VideoLayer.tsx on native).
 */
export const VideoLayer: React.FC<VideoLayerProps> = ({ source, isActive, muted, paused = false }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const shouldPlay = isActive && !paused;
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;
  // Portrait/square clips fill the frame (cover); landscape clips are letterboxed
  // (contain) so they sit centred and uncropped. Aspect is read from the element
  // once metadata loads — no backend dimensions needed, works for existing clips.
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');

  useEffect(() => {
    const video = ref.current;
    if (!video || !source) return;
    video.muted = true; // required for autoplay to be allowed
    setFit('cover'); // reset until this source's real aspect is known
    const playIfActive = () => { if (shouldPlayRef.current) video.play?.().catch(() => {}); };
    const onMeta = () => {
      const { videoWidth: w, videoHeight: h } = video;
      if (w && h) setFit(w > h ? 'contain' : 'cover');
    };
    video.addEventListener('loadedmetadata', onMeta);

    let hls: Hls | undefined;
    // hls.js FIRST whenever MSE is available. Chrome/Firefox/Edge/Electron
    // report canPlayType('application/vnd.apple.mpegurl') === 'maybe' but CANNOT
    // actually play HLS natively — only Safari can. Native src is the fallback.
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      // Register listeners BEFORE loadSource — a cached manifest can parse
      // synchronously and fire MANIFEST_PARSED before a later .on() attaches.
      hls.on(Hls.Events.MANIFEST_PARSED, playIfActive);
      if (__DEV__) hls.on(Hls.Events.ERROR, (_e, d) => console.warn('[hls]', d?.type, d?.details, d?.fatal));
      hls.loadSource(source);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.addEventListener('loadedmetadata', playIfActive);
      video.src = source; // Safari — native HLS
    } else {
      video.addEventListener('loadedmetadata', playIfActive);
      video.src = source; // last resort
    }
    return () => {
      hls?.destroy();
      video.removeEventListener('loadedmetadata', playIfActive);
      video.removeEventListener('loadedmetadata', onMeta);
    };
  }, [source]);

  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (shouldPlay) v.play?.().catch(() => {});
    else v.pause?.();
  }, [shouldPlay]);

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      style={{ position: 'absolute', inset: 0 as any, width: '100%', height: '100%', objectFit: fit, background: 'transparent' }}
    />
  );
};

export default VideoLayer;
