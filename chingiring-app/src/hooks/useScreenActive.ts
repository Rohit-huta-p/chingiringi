import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

/**
 * True only while this screen is BOTH the focused route AND the app is in the
 * foreground. Video screens gate audio + playback on this so a clip never keeps
 * sounding after you switch tabs or leave the app: on blur/background the clip is
 * muted and paused, and it resumes (at your own mute preference) when you return.
 *
 * Mirrors the useIsFocused + AppState idiom already used by useVideoFeed — native
 * has no window-focus event, so AppState supplies the foreground signal (on web
 * react-native-web maps it to document visibility).
 */
export function useScreenActive(): boolean {
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  return isFocused && appActive;
}

export default useScreenActive;
