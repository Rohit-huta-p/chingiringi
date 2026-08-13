# Video comments (Instagram-style, flat)

**Date:** 2026-08-13
**Status:** approved (design)
**Scope:** backend (`modules/videos`, `modules/notifications`) + app (`chingiring-app`).

## Goal
Let signed-in users comment on a video and read others' comments in an
Instagram-style slide-up sheet. **Flat** (no reply threads), **no comment likes**.
Mirrors the existing `modules/reviews` pattern.

## Confirmed decisions
- **A. Flat only** — no replies/threading.
- **B. No comment likes.**
- **C. Notify** the video owner on a new comment (skip if the commenter *is* the owner).
- **D. Delete rights:** the commenter, the video owner (`createdBy`), or an admin.

## Data model
New `VideoComment` (mirrors `reviewModel.js`, minus rating; **not** unique per user
— a user may comment many times):
```
video:     ObjectId ref Video, required, index
user:      ObjectId ref User,  required
text:      String, trim, required, maxlength 500
timestamps: true
```
Indexes: `{ video: 1, _id: -1 }` (list newest-first + cursor paginate).

`Video.stats` gains `comments: { type: Number, default: 0 }` — `+1` on create,
`-1` on delete (existing docs default to 0).

## API (mounted under `/api/videos`)
- `POST /:id/comments` `{ text }` — `protect` + `commentLimiter` (30/min/user).
  Validates non-empty ≤500; creates; `$inc stats.comments`; fires `video_comment`
  notify to `video.createdBy` (unless self). Returns the created comment with
  `user` populated (`_id, name, username, avatarUrl`).
- `GET /:id/comments?cursor=<id>&limit=20` — `optionalProtect`; newest-first;
  `_id`-cursor pagination; each item populated with `user` + a `mine` flag
  (`String(user._id) === req.user?._id`). Returns `{ comments, nextCursor }`.
- `DELETE /comments/:commentId` — `protect`; allowed if requester is the
  commenter **or** the comment's video `createdBy` **or** `role === 'admin'`;
  else 403. `$inc stats.comments -1`.
- Route order: declare `/:id/comments` and `/comments/:commentId` **before** the
  bare `/:id` routes (same guard the file already documents).

## App
- **Rail** (`VideoFeedItem`): add a Comment button (`MessageCircle`) between Like
  and Share, showing `video.stats.comments`; `onComment(video)` prop opens the sheet.
- **`CommentsSheet`** (new): a transparent slide-up `Modal` — dimmed backdrop
  (tap to close) over the top, a ~72%-height surface sheet below so the clip keeps
  playing behind it. Header "Comments · N" + close. `FlatList` of comments
  (avatar · name · text · relative time · a trash affordance when deletable).
  Bottom input bar pinned above the keyboard (`KeyboardAvoidingView`): your avatar +
  `Add a comment…` + **Post**. Optimistic append on post; infinite scroll on
  end-reached; empty state "Be the first to comment."
- **`useComments(videoId)`** — React Query `useInfiniteQuery` (list) + mutations
  (add, delete) with optimistic updates and `stats.comments` bump on the cached feed.
- `api/videos.ts`: `listComments`, `addComment`, `deleteComment`; `FeedVideo.stats`
  gains `comments`.
- State for which video's sheet is open lives in `MobileVideosScreen`; delete
  visibility computed client-side from `comment.mine || video.createdBy === me || isAdmin`.

## Notifications
- New type `video_comment`; enum (`notificationModel`) + `NotificationType` (app) +
  a `MessageCircle` icon in `NotificationsScreen`.
- Template: title "New comment", body `{name} commented: "{first ~60 chars}"`.
  data `{ videoId, name }`.

## Abuse / moderation
- Auth required to post; `commentLimiter` caps burst posting.
- No profanity filter in MVP (out of scope). Deleting is the moderation lever.

## Out of scope
Replies/threads, comment likes, @mentions, edit-comment, reporting a comment
(revisit with the paused report/block feature), rich media/emoji picker.

## Verification
- `POST` → appears in `GET`, `stats.comments` increments, owner gets a notification.
- `DELETE` as commenter/owner/admin succeeds and decrements; as a stranger → 403.
- Rail shows the live count and opens the sheet; optimistic post then reconciles.
- `tsc --noEmit` clean; backend `node --check` on touched files.
