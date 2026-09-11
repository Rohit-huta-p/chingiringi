// Native (iOS/Android) RTMP publisher. Re-exported through a platform-resolved
// module so the native-only code (react-native codegenNativeComponent) never
// enters the WEB bundle — Metro picks LiveStreamView.web.tsx there instead.
export { ApiVideoLiveStreamView as LiveStreamView } from '@api.video/react-native-livestream';
