# Video preview, 30s trim gate, and My-Videos playback

**Date:** 2026-08-13
**Status:** approved
**Scope:** app-only (`chingiring-app`); no backend. Ships via EAS.

## Problem

1. The upload modal never shows the picked clip — users publish blind.
2. The 30s cap is enforced only downstream (Cloudflare `maxDurationSeconds: 30`),
   so a longer pick uploads then fails to encode. Users get no trim and no clear
   pre-upload error.
3. In **My Videos** (`/my-videos`) tapping a clip does nothing — no way to watch
   your own posted clip.

## Approach (chosen)

**OS trimmer + gate** for the length cap (no new deps, no backend):
- Native picker's OS trim UI does the actual cut where the OS supports it (iOS).
- Everywhere else (web, best-effort Android), a pre-upload duration gate blocks
  `> 30s` with a clear message instead of a silent encode failure.

Rejected: server/provider clip (needs a backend endpoint + provider wiring) and a
native trimmer library (new native dep + EAS rebuild). Revisit if web-parity
in-app trim becomes a requirement.

## Units

### 1. `LocalVideoPreview` — play the picked clip in the modal
- New component, platform-split like `VideoLayer`:
  - `.web.tsx` → DOM `<video controls playsInline muted>` at `src = uri`.
  - `.tsx` (native) → expo-video `VideoView` with `nativeControls`, source `uri`.
- Rendered inside `VideoUploadModal` create-mode picked-clip card, replacing the
  Film-icon placeholder. Name / size / **Replace** stay. Edit mode unchanged
  (still shows the existing thumbnail — the file isn't re-uploadable there).

### 2. Duration capture + 30s gate + OS trim
- `PickedVideo` gains `durationSec?: number`.
- `useVideoUpload.pickVideo`:
  - Native: pass `allowsEditing: true` (→ iOS OS trim handles, capped by the
    existing `videoMaxDuration: 30`). Read `asset.duration` (ms) → `durationSec`.
  - Web: after `URL.createObjectURL`, load an offscreen `<video>`, await
    `loadedmetadata`, read `.duration` → `durationSec`.
- `VideoUploadModal`:
  - Show duration on the picked card (e.g. `0:42 · 18.4 MB`).
  - If `durationSec > 30.5`, render an inline warning row and block **Publish**
    via `notify("This clip is 42s — trim to 30s. On iPhone, trim right in the
    picker; on web/Android, shorten it before uploading.")`.
  - Existing 200 MB guard stays.
- 30.5 epsilon absorbs metadata rounding.

### 3. `VideoPlayerModal` — tap-to-play in My Videos
- New component: fullscreen black `Modal` = `VideoLayer` (HLS, already
  landscape-aware) + close **✕** + tap-to-pause + mute toggle.
- `MyVideosScreen`: pass `onPress` (prop already exists on `VideoList`) →
  - `status === 'ready'` && `hlsUrl` → open `VideoPlayerModal`.
  - otherwise → `notify` the state ("Still encoding" / "Under review" /
    "Rejected").

## Reuse
`VideoLayer`, `VideoList.onPress` (already present, currently unused), `notify`,
`confirmAsync`, expo-video, hls.js.

## Out of scope
Web/Android client-side cut, custom scrub/timeline UI, blurred-fill letterbox,
re-uploading the file in edit mode.

## Verification
- Web preview: pick a clip → it plays with controls in the modal.
- Gate: pick a `> 30s` clip → duration shows, Publish blocked with the message.
- My Videos: tap a `ready` clip → fullscreen playback; tap a `processing` one →
  status notice.
- `tsc --noEmit` clean; browser-verify the web paths (preview + gate + play).
