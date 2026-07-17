# Notifications v1 — Design Spec

**Date:** 2026-07-16
**Status:** Approved (design), ready for planning
**Approach:** A — direct service + polling + Expo push

## Goal

Turn the placeholder Notifications feature into a working system: a real in-app
notification center (with unread badge) plus device push, driven automatically
by money-path events, with per-user preferences that gate delivery.

Today: `NotificationsScreen` is a static "No notifications yet" placeholder; the
Settings toggles don't persist; there is **no backend** for notifications (no
model, controller, routes), no push token on the User model, and no push libs.

## Scope

**In (v1):**
- In-app notification center: list + unread count + mark read / mark all read.
- Device push via Expo (native only; web is in-app only).
- 5 automatic triggers (all money-path):
  1. `coins_credited` — pending coins credited from a report import.
  2. `coins_unlocked` — pending coins confirmed → spendable after the 30-day lock.
  3. `withdrawal_submitted` — user requests a withdrawal.
  4. `withdrawal_paid` — admin approves & pays.
  5. `withdrawal_rejected` — admin rejects.
- Persisted per-user preferences that gate delivery.

**Out (v1):** admin broadcast/announcements, email channel, real-time sockets,
deal/referral notifications (those Settings toggles stay cosmetic).

## Architecture (Approach A)

A `Notification` collection + a small `notificationService.notify()` called
**inline** at each trigger site (matching how the codebase already does inline
side effects, e.g. the fire-and-forget `clickCount` bump). Push is sent
fire-and-forget via `expo-server-sdk`. The client reads the list + unread count
over REST with React Query (refetch on focus + a light poll). No new infra
(no event bus, no sockets).

## Data model (MongoDB / Mongoose)

**New `Notification` collection** (`backend/src/modules/notifications/notificationModel.js`):
- `userId` — ObjectId ref User, indexed
- `type` — enum: `coins_credited | coins_unlocked | withdrawal_submitted | withdrawal_paid | withdrawal_rejected`
- `title` — String
- `body` — String
- `data` — Mixed (context/deep-link, e.g. `{ coins, orderId, withdrawalId, amount }`)
- `read` — Boolean, default false
- `readAt` — Date
- timestamps
- Indexes: `{ userId: 1, createdAt: -1 }`, `{ userId: 1, read: 1 }`

**User model additions** (`backend/src/modules/users/userModel.js`):
- `pushTokens: [{ token: String, platform: String, updatedAt: Date }]` — multi-device Expo tokens
- `notificationPrefs: { cashback: Boolean (default true), withdrawals: Boolean (default true), push: Boolean (default true) }`

## Backend

**Service** (`backend/src/modules/notifications/notificationService.js`):
`notify({ userId, type, data })`:
1. Load the user (prefs + pushTokens). Map `type` → category (`coins_*` → `cashback`, `withdrawal_*` → `withdrawals`). If that category pref is off → return (no in-app, no push).
2. Build `{ title, body }` from a per-type template (`notificationTemplates.js`).
3. Insert the `Notification` row (in-app).
4. If `prefs.push` && `pushTokens.length` → send an Expo push (batched, fire-and-forget). On `DeviceNotRegistered` receipts, prune the dead token from the user.

**Trigger sites** (each wrapped in try/catch — a notification failure must never break the money op):
- `coins_credited` — `walletOpsController.importReport`, per matched row after `Wallet.updateOne({$inc:{pendingCoins}})` (~line 599–606).
- `coins_unlocked` — `scripts/confirmExpiredLocks.js`, per user after pendingCoins→coins move (~line 62–68).
- `withdrawal_submitted` — `walletController.requestWithdrawal` (line 133).
- `withdrawal_paid` — `walletOpsController.updateWithdrawal`, when `action === 'complete'` / status `completed` (line 341, 378).
- `withdrawal_rejected` — `walletOpsController.updateWithdrawal`, when `action === 'reject'` / status `rejected`.

**REST API** (`notificationRoutes.js`, mounted at `/api/notifications`, all `protect`):
- `GET /` — list, newest-first, paged (`?limit=&before=<cursor>`)
- `GET /unread-count` — `{ count }`
- `PATCH /:id/read` — mark one read
- `PATCH /read-all` — mark all read for the user
- `POST /push-token` — `{ token, platform }` register/refresh
- `DELETE /push-token` — `{ token }` unregister (on logout)
- Prefs: `PATCH /api/users/me/notification-prefs` — `{ cashback?, withdrawals?, push? }`

## Client (React Native + web)

- `src/api/notifications.ts` — `list`, `unreadCount`, `markRead`, `markAllRead`, `registerPushToken`, `unregisterPushToken`, `updatePrefs`.
- **NotificationsScreen** — replace placeholder with a React-Query list: each row = type icon · title · body · relative time · unread dot. Tapping a row marks it read (and can deep-link, e.g. to Wallet). "Mark all read" action. Keep the empty state for zero. Pull-to-refresh.
- **Unread badge** — on the sidebar "Notifications" nav item (desktop) and mobile nav: an `unread-count` query, refetch on focus + light interval poll.
- **Push registration** (native only): `src/lib/push.ts` — on launch, if `prefs.push`, request OS permission via `expo-notifications`, get the Expo token, `POST /push-token`. Unregister on logout. Foreground notification handler + tap → deep-link. **Web:** skip entirely (Expo push is native-only); in-app center still works.
- **Settings** (`SettingsScreen` + `MobileSettingsScreen`): load prefs; wire "Cashback Updates" → `cashback`, add "Withdrawal Updates" → `withdrawals` and "Push Notifications" → `push` (the push toggle also drives the OS permission request). Deal/Referral/Email toggles remain cosmetic in v1.

## Error handling & defaults

- Trigger-site `notify()` is best-effort: wrapped in try/catch so a failure never blocks the credit/withdrawal.
- Prefs default **ON** (opt-out) so users get money-path notifications by default.
- Expo pushes are batched via the SDK; invalid tokens pruned on receipt errors.
- Auth: all notification routes are user-scoped (`protect`); a user only ever sees/mutates their own notifications.

## Dependencies

- Backend: `expo-server-sdk`.
- Client: `expo-notifications` (+ `expo-device` for the real-device check).

## Testing

- Backend unit: `notificationService` — pref gating (category off → nothing), in-app row created, push skipped when no token / push off, template output. Token pruning on `DeviceNotRegistered`.
- Backend integration: report import → `coins_credited` row for the credited user; `updateWithdrawal` complete → `withdrawal_paid` row; reject → `withdrawal_rejected` row.
- Client: NotificationsScreen renders list + empty state; unread badge count; mark-read / mark-all-read flow.
- Push: verified manually on a real device (permission → token registered → push received/tapped).

## Rollout notes

- Web users get the in-app center only (no push) — no code path change needed; push registration is guarded by `Platform.OS !== 'web'`.
- Backfill: none — notifications start accruing from deploy forward.
