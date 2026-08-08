# Videos v1 — Client Feed & Player (Plan 2 of 5)

**Goal:** Replace the `MobileVideosScreen` placeholder with a working vertical, swipeable, **shoppable** video feed (Direction B — "Shop-forward"), backed by the Plan 1 API.

**Architecture:** A paged `FlatList` renders one full-screen `VideoFeedItem` per page. Only the on-screen item plays (`expo-video`, viewability-gated); the rest pause. Data comes from `GET /api/videos/feed` via a TanStack `useInfiniteQuery` cursor hook. Tapping a product → existing `ProductDetail`; tapping the store → store screen. Engagement (view/like/save/share) posts to the Plan 1 endpoints.

**Tech stack:** React Native 0.81 / Expo 54, `expo-video` (new), `@react-navigation`, `@tanstack/react-query` v5, `zustand`, `lucide-react-native`. Brand tokens from `constants/theme.ts` (`#4784E2`, Outfit).

## Global constraints
- **App has no jest.** Verification per task = `npx tsc --noEmit` (types) **+ Expo web preview** (`expo start --web`) rendering the screen. No new test framework (YAGNI).
- Mirror the existing API pattern: `api/videos.ts` exports a `videosAPI` object of `apiClient` calls returning `response.data` (the `{status, data}` envelope). Screens read `res.data.videos` etc.
- One new dependency only: `expo-video` (installed via `npx expo install`, which pins the SDK-54-correct version).
- Reuse `apiClient` (Bearer auth + refresh already handled). Reuse `Colors`/`Fonts` from `constants/theme.ts`.
- The feed surface is **dark/immersive** regardless of app theme (like Reels).
- **Execution method:** direct build with preview verification (not subagent-TDD — no app test suite, UI needs eyes on the preview).

## Dependency note
End-to-end playback needs the Plan 1 backend running with `CLOUDFLARE_*` env + real videos. Until then, verify UI with a **dev fixture** (Task 3 ships one behind `__DEV__`), using a public sample HLS URL so the player path is exercised. Wire to the live API in Task 4; it shows the empty state cleanly when the feed is empty.

---

## File structure
- Create `chingiring-app/src/api/videos.ts` — types + `videosAPI`.
- Create `chingiring-app/src/hooks/useVideoFeed.ts` — infinite feed query + engagement mutations.
- Create `chingiring-app/src/components/VideoFeedItem.tsx` — one full-screen shoppable item (player + Direction B overlay).
- Modify `chingiring-app/src/screens/Dashboard/MobileVideosScreen.tsx` — replace placeholder with the paged feed.
- Modify `chingiring-app/app.json` (or `app.config`) — add the `expo-video` plugin if required by the SDK.

---

## Task 1: `expo-video` + API module

**Files:** create `chingiring-app/src/api/videos.ts`; install `expo-video`.

- [ ] **Step 1: Install the player**

```bash
cd chingiring-app && npx expo install expo-video
```

- [ ] **Step 2: Create `api/videos.ts`**

```ts
import apiClient from './client';

export interface TaggedProduct {
  _id: string;
  name: string;
  price: number;
  mrp?: number;
  images?: string[];
  slug?: string;
}
export interface VideoStore {
  _id: string;
  name: string;
  shortName: string;
  slug?: string;
  logoUrl?: string;
  isVerified?: boolean;
}
export interface FeedVideo {
  _id: string;
  store: VideoStore;
  streamUid: string;
  status: 'processing' | 'ready' | 'error' | 'flagged' | 'removed';
  hlsUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  caption: string;
  hashtags: string[];
  taggedProducts: TaggedProduct[];
  cta: { type: 'shop' | 'store' | 'none'; productId?: string; url?: string };
  stats: { views: number; likes: number; shares: number; saves: number };
  publishedAt: string;
}

export const videosAPI = {
  getFeed: async (params?: { cursor?: string; limit?: number }) => {
    const res = await apiClient.get('/api/videos/feed', { params });
    return res.data as { status: string; data: { videos: FeedVideo[]; nextCursor: string | null } };
  },
  getVideo: async (id: string) => {
    const res = await apiClient.get(`/api/videos/${id}`);
    return res.data as { status: string; data: { video: FeedVideo } };
  },
  getStoreVideos: async (storeId: string) => {
    const res = await apiClient.get(`/api/videos/store/${storeId}`);
    return res.data as { status: string; data: { videos: FeedVideo[] } };
  },
  trackView: async (id: string, watchSec: number) => {
    const res = await apiClient.post(`/api/videos/${id}/view`, { watchSec });
    return res.data;
  },
  toggleLike: async (id: string) => (await apiClient.post(`/api/videos/${id}/like`)).data,
  toggleSave: async (id: string) => (await apiClient.post(`/api/videos/${id}/save`)).data,
  trackShare: async (id: string) => (await apiClient.post(`/api/videos/${id}/share`)).data,
};
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` (from `chingiring-app`) is clean. Commit:

```bash
git add chingiring-app/src/api/videos.ts chingiring-app/package.json chingiring-app/package-lock.json
git commit -m "feat(videos-client): expo-video + videos API module

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Feed hook (`hooks/useVideoFeed.ts`)

**Files:** create `chingiring-app/src/hooks/useVideoFeed.ts`.

- [ ] **Step 1: Implement**

```ts
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videosAPI, FeedVideo } from '../api/videos';

export function useVideoFeed() {
  const q = useInfiniteQuery({
    queryKey: ['videoFeed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => videosAPI.getFeed({ cursor: pageParam, limit: 5 }),
    getNextPageParam: (last) => last.data.nextCursor ?? undefined,
  });
  const videos: FeedVideo[] = (q.data?.pages ?? []).flatMap((p) => p.data.videos);
  return { ...q, videos };
}

export function useVideoEngagement() {
  const qc = useQueryClient();
  const like = useMutation({ mutationFn: (id: string) => videosAPI.toggleLike(id) });
  const save = useMutation({ mutationFn: (id: string) => videosAPI.toggleSave(id) });
  const share = useMutation({ mutationFn: (id: string) => videosAPI.trackShare(id) });
  const view = useMutation({ mutationFn: (v: { id: string; watchSec: number }) => videosAPI.trackView(v.id, v.watchSec) });
  return { like, save, share, view, qc };
}
```

- [ ] **Step 2: Verify** `tsc --noEmit` clean. Commit `feat(videos-client): infinite feed query + engagement mutations`.

---

## Task 3: `VideoFeedItem` — Direction B shoppable item + player

**Files:** create `chingiring-app/src/components/VideoFeedItem.tsx`.

**Spec (Direction B):** full-bleed player with a dark bottom scrim; overlaid, in a `SafeAreaView`:
- **Store pill (top-left):** `store.logoUrl` (or initial tile) + `store.shortName` + verified tick → `onStorePress`.
- **Caption** (2 lines, above the product card).
- **Docked product card (bottom, above tab bar):** first tagged product — thumbnail, name, `₹price`, struck `₹mrp` + `N% OFF` when `mrp > price`, and a **"Shop now"** button → `onProductPress(product)`. If `taggedProducts.length > 1`, horizontal scroll of cards; CTA count `Shop (N)`.
- **Slim rail (bottom-right):** like ❤ (filled when liked) + count, share ↗. Mute toggle 🔇 as a small top-right control.
- **Player:** `expo-video` `useVideoPlayer(source)` — `player.loop = true`, `player.muted = muted`; **play only when `isActive`**, else `pause()`. Show `thumbnailUrl` as a poster `Image` behind the player until it renders.

**Player lifecycle (key code):**

```tsx
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';

const player = useVideoPlayer(video.hlsUrl, (p) => { p.loop = true; p.muted = muted; });
useEffect(() => { player.muted = muted; }, [muted]);
useEffect(() => { isActive ? player.play() : player.pause(); }, [isActive]);
```

**Props:**
```ts
interface Props {
  video: FeedVideo;
  isActive: boolean;
  muted: boolean;
  height: number;             // screen height for full-page sizing
  liked: boolean;
  onToggleMute: () => void;
  onProductPress: (p: TaggedProduct) => void;
  onStorePress: (store: VideoStore) => void;
  onLike: () => void;
  onShare: () => void;
}
```

- [ ] **Step 1:** Build the component per the spec (styles mirror the Direction B mockup: dark, `#4784E2` accent, Outfit via `Fonts`, `lucide-react-native` icons — Heart, Share2, VolumeX, ShoppingBag, BadgeCheck).
- [ ] **Step 2: Dev fixture** — export a `SAMPLE_VIDEO: FeedVideo` (guarded for `__DEV__` use) pointing `hlsUrl` at a public test stream (`https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`) with 2 fake products, so the item renders in preview before the backend is live.
- [ ] **Step 3: Verify** — temporarily render `<VideoFeedItem video={SAMPLE_VIDEO} isActive muted .../>` in the feed; `expo start --web`; confirm layout matches Direction B (store pill, product card with price/discount, Shop-now, rail). Screenshot. Commit `feat(videos-client): VideoFeedItem (Direction B) + expo-video player`.

---

## Task 4: Feed screen — replace `MobileVideosScreen`

**Files:** modify `chingiring-app/src/screens/Dashboard/MobileVideosScreen.tsx`.

**Spec:**
- `useWindowDimensions()` → page height. Vertical `FlatList` of `videos`, `pagingEnabled`, `snapToInterval={height}`, `decelerationRate="fast"`, `showsVerticalScrollIndicator={false}`, `getItemLayout` for perf.
- `onViewableItemsChanged` (`viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}`) → set `activeIndex` (drives which item plays).
- `onEndReached` → `fetchNextPage()` when `hasNextPage`.
- Mute: `useState` (or a tiny Zustand slice) shared to items via `onToggleMute`.
- **View tracking:** track wall-clock while an item is active; on active-index change or screen blur, `view.mutate({ id, watchSec })` for the item that just lost focus (clamp handled server-side).
- **Navigation:** `onProductPress` → `navigation.navigate('ProductDetail', { productId: p._id, product: p })`. `onStorePress` → navigate to the store screen (confirm the route name during build — `Stores` tab or a store-detail screen; fall back to the `Stores` tab).
- **States:** `isLoading` → dark spinner; empty (`videos.length === 0`) → a tasteful "No videos yet" placeholder (keep the old icon styling); error → retry.

- [ ] **Step 1:** Implement the screen per spec, wiring `useVideoFeed` + `useVideoEngagement`.
- [ ] **Step 2: Verify** — `tsc --noEmit`; `expo start --web`; open the Videos tab. With the backend down it shows the empty state; with the Task 3 fixture array it pages/plays. Confirm swipe paging + only-active-plays + product tap navigates. Screenshot. Commit `feat(videos-client): shoppable vertical feed replaces placeholder`.

---

## Task 5: Polish — like/save optimistic UI, share sheet, mute persistence

**Files:** modify `VideoFeedItem.tsx`, `MobileVideosScreen.tsx`.

- [ ] **Step 1:** Optimistic like/save (toggle local state immediately, reconcile on settle). Share via RN `Share.share({ message, url })` with a deep link (`.../videos/<id>` — extend `linking.ts` `videos/:id` if opening a specific video is wanted; otherwise share the store/product URL). Persist mute preference (reuse `secureStore` theme-pref pattern, or a Zustand slice).
- [ ] **Step 2: Verify** — `tsc --noEmit`; preview interactions (like fills instantly, share opens the sheet). Commit `feat(videos-client): optimistic engagement + share sheet + mute memory`.

---

## Self-review checklist (run after build)
- Feed pages and only the visible video plays (others paused) — no audio overlap.
- Product card shows price + discount; Shop-now opens the correct PDP.
- Empty/loading/error states render on the dark surface.
- `tsc --noEmit` clean; no `expo-av` imported (use `expo-video`).
- Works in Expo web preview; note native-device playback is verified after backend deploy + Cloudflare + seed content.

## After Plan 2
- **Plan 3** — analytics events (`productTaps`/`storeTaps` via `clickModel`), completion metric.
- **Plan 4** — admin upload screen (pick → `upload-url` → direct upload → `create` → poll) + moderation queue UI.
- **Live end-to-end** needs: PR #9 merged + deployed (Render), `CLOUDFLARE_*` set, and a few seed clips.
