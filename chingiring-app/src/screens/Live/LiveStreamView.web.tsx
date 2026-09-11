// Web has no native RTMP publisher. Exporting null (and importing nothing
// native) keeps @api.video/react-native-livestream out of the web bundle;
// BroadcasterScreen renders its "needs the dev build" fallback when this is null.
export const LiveStreamView: any = null;
