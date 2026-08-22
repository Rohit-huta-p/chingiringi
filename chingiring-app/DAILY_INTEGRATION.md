# Daily.co Integration Guide

> **Status:** Pending native rebuild. All SDK hooks are stubbed;
> follow the steps below to activate real video.

## 1. Install the SDK

```bash
# From the chingiring-app directory
npm install @daily-co/react-native-daily-js
```

Daily requires native modules — there is no Expo Go support.

## 2. Native rebuild (required once)

```bash
npx expo prebuild --clean          # re-generates ios/ and android/
```

For iOS:
```bash
cd ios && pod install && cd ..
npx expo run:ios
```

For Android:
```bash
npx expo run:android
```

> **Why `--clean`?** The Daily SDK ships its own CocoaPod and Gradle
> dependencies (WebRTC, Daily's media engine). A clean prebuild ensures
> `Podfile.lock` and `build.gradle` are generated fresh without stale
> module entries.

## 3. Environment variable

Add to `.env` (and to your backend `.env`):

```
DAILY_API_KEY=<your-api-key-from-daily.co-dashboard>
```

The backend's `POST /api/streams` already calls Daily's REST API to create
a room and mint broadcaster / viewer tokens. The tokens are returned to
the app as `broadcasterToken` and `viewerToken`.

## 4. Wire BroadcasterScreen (sender)

**File:** `src/screens/Live/BroadcasterScreen.tsx`

### Replace the expo-camera preview

```tsx
// REMOVE:
import { CameraView, useCameraPermissions } from 'expo-camera';
// ADD:
import Daily, { DailyMediaView } from '@daily-co/react-native-daily-js';
```

### Mount / join on screen focus

```tsx
const callObjectRef = useRef<DailyCall | null>(null);

useEffect(() => {
  const co = Daily.createCallObject();
  callObjectRef.current = co;

  co.join({ url: roomUrl, token: broadcasterToken }).catch(console.error);

  return () => {
    co.leave().finally(() => co.destroy());
  };
}, []);

// After join, read local session ID for DailyMediaView
const [localSessionId, setLocalSessionId] = useState<string | null>(null);

useEffect(() => {
  const co = callObjectRef.current;
  if (!co) return;
  const handler = () => setLocalSessionId(co.participants()?.local?.session_id ?? null);
  co.on('joined-meeting', handler);
  return () => { co.off('joined-meeting', handler); };
}, []);
```

### Replace CameraView with DailyMediaView

```tsx
// REMOVE:
<CameraView style={StyleSheet.absoluteFill} facing={facing} />
// ADD:
{localSessionId ? (
  <DailyMediaView
    sessionId={localSessionId}
    videoScaleMode="fill"
    style={StyleSheet.absoluteFill}
  />
) : (
  <ActivityIndicator color="#fff" style={StyleSheet.absoluteFill} />
)}
```

### Wire the flip control

```tsx
// Replace the setFacing toggle with:
const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
const handleFlip = () => {
  const next = cameraFacing === 'user' ? 'environment' : 'user';
  callObjectRef.current?.setCameraDevice(next === 'user' ? 'front' : 'back');
  setCameraFacing(next);
};
```

### Wire the mute control (KI-8)

```tsx
// In the mute Pressable onPress:
onPress={() => {
  const next = !muted;
  setMuted(next);
  callObjectRef.current?.setLocalAudio(!next); // true = unmuted
}}
```

### Wire End Stream

```tsx
// Before calling endStream():
await callObjectRef.current?.leave();
await callObjectRef.current?.destroy();
callObjectRef.current = null;
if (streamId) await endStream(streamId);
```

## 5. Wire ViewerScreen (receiver)

**File:** `src/screens/Live/ViewerScreen.tsx`

```tsx
import Daily, { DailyMediaView } from '@daily-co/react-native-daily-js';

// On mount (token comes from route params or GET /api/streams/:id/viewer-token):
const co = Daily.createCallObject();
await co.join({ url: roomUrl, token: viewerToken });

// Find the broadcaster's session:
const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
co.on('participant-joined', (e) => {
  // The broadcaster owns the room — they join first; viewers join after.
  if (!e.participant.local) setBroadcasterId(e.participant.session_id);
});

// Render:
{broadcasterId && (
  <DailyMediaView
    sessionId={broadcasterId}
    videoScaleMode="fill"
    style={StyleSheet.absoluteFill}
  />
)}

// On unmount:
await co.leave();
await co.destroy();
```

Replace the existing `VideoPendingPlaceholder` / countdown with the above.

## 6. Viewer count (already wired ✅)

The socket namespace `/stream` already emits `viewer_count_update` and
`stream_ended`. `ViewerScreen` (Sprint 5 D2) and `LiveDiscoveryScreen`
both subscribe to these events. No additional work needed.

## 7. Check-list before QA

- [ ] `DAILY_API_KEY` is set in backend `.env`
- [ ] `npx expo prebuild --clean` ran and native files generated
- [ ] `pod install` succeeded (iOS)
- [ ] BroadcasterScreen shows self-view after `co.join()`
- [ ] ViewerScreen shows broadcaster video
- [ ] Mute/unmute silences audio for viewers (use two devices to verify)
- [ ] End Stream: viewer sees "stream ended" socket event; broadcaster navigates to MainTabs
- [ ] `POST /api/streams/:id/end` marks the stream inactive in MongoDB
