# Report a video + block a creator

**Date:** 2026-08-14
**Status:** approved (design)
**Scope:** backend (`modules/videos`) + app (`chingiring-app`).

## Confirmed decisions
- **A. Block = the creator** — hides *all* of that creator's clips from the blocker's feed.
- **B. On report** — the clip is hidden from the reporter immediately, and queued for admin. It stays live for everyone else until an admin acts.
- **C. Admin review** — a **"Reported"** tab on the existing admin Videos screen.
- **D. Reporter feedback** — none (just a "we'll review" toast).
- **E. Audit** — full `VideoReport` records (who / why / when / resolution), admin-only.

## Data models
**`VideoReport`** — one per (video, reporter); doubles as the reporter's hide-list.
```
video:    ObjectId ref Video, required, index
reporter: ObjectId ref User,  required
reason:   enum ['spam','inappropriate','violence','hate','misleading','copyright','other']
note:     String, maxlength 300, default ''
status:   enum ['open','reviewed','dismissed'], default 'open'
timestamps
```
Unique `{ video, reporter }`; index `{ status, _id }` for the admin queue.

**`VideoBlock`** — blocked creators (A).
```
user:        ObjectId ref User, required   // the blocker
blockedUser: ObjectId ref User, required   // the creator being blocked
timestamps
```
Unique `{ user, blockedUser }`; index `{ user }`.

**`Video.reportCount`** — `Number, default 0`: count of OPEN reports (for the admin
filter/badge). `+1` on a new report; set `0` on dismiss or remove.

## API (under `/api/videos`)
- `POST /:id/reports` `{ reason, note? }` — `protect` + `reportLimiter`. Upsert (dedupe
  per user); on first report `$inc reportCount`. No global hide. 200 either way.
- `POST /block/:creatorId` / `DELETE /block/:creatorId` — `protect`. Upsert / remove a
  `VideoBlock`. Can't block yourself.
- `GET /blocks` — `protect`. The signed-in user's blocked creators (id + name/avatar) for a
  manage list.
- `GET /admin/reported` — `admin`. Videos with `reportCount > 0`, newest-reported first,
  each with count + distinct reasons.
- `GET /admin/reports/:videoId` — `admin`. The individual reports for one clip (reporter +
  reason + note + time) — the audit view.
- `PATCH /admin/reports/:videoId` `{ action: 'dismiss' }` — `admin`. Open reports → dismissed,
  `reportCount = 0`, clip stays live.
- **Remove** reuses the existing `moderateVideo` reject (`status: removed`, uploader notified);
  extend it to also mark that clip's open reports `reviewed` and zero `reportCount`.

### Feed filter (`getFeed`, optional-auth)
For a signed-in user, exclude clips where `createdBy ∈ my VideoBlock.blockedUser` **or**
`_id ∈` clips I've reported (`VideoReport.reporter = me`). Anonymous feed unchanged.

## App
- **`⋯` (more) button** on the feed clip + `VideoScreen` → a small sheet: **Report video** ·
  **Block {creator}**.
- **`ReportSheet`** — the 7 reasons as a tappable list + optional note + Submit → `report()`.
  On success: toast, close, and drop the clip from the current feed (it's now hidden for you).
- **Block** → `confirmAsync("Block {creator}? You won't see their videos.")` → `block()` →
  invalidate the feed (their clips disappear).
- **Blocked list** — a "Blocked accounts" row in Profile → simple list with **Unblock**.
- **Admin**: a **Reported** tab on `AdminVideoUploadScreen` (filter `reportCount > 0`), each
  card showing the count + reasons, with **Remove** (moderate-reject) and **Dismiss reports**.
  A tap opens the per-clip report detail (`/admin/reports/:videoId`).
- `api/videos.ts`: `report`, `block`, `unblock`, `listBlocks`, `adminListReported`,
  `adminReportDetail`, `dismissReports`; `FeedVideo.reportCount?`.

## Notifications
None new. Removal-via-report reuses the existing `video_rejected` notification to the uploader.

## Abuse / moderation
- Auth required to report/block; `reportLimiter` (e.g. 20/min/user). Report dedupe via the
  unique index. Blocking is idempotent (upsert).

## Out of scope
Auto-flag/takedown after N reports (admin decides), reporting a comment or a store, appeals,
blocking by device/anonymous, notifying the reporter.

## Verification
- Report → clip vanishes from the reporter's feed; `reportCount` bumps; shows in the admin
  Reported tab; other users still see it.
- Dismiss → leaves the Reported tab, stays live. Remove → out of feed, uploader notified.
- Block → all that creator's clips vanish from your feed; Unblock restores them.
- Report/block dedupe (unique indexes); can't block yourself.
- `tsc --noEmit` clean; backend `node --check`.
