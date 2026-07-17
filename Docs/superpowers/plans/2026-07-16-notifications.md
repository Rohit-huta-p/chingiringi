# Notifications v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build in-app + Expo-push notifications driven automatically by 5 money-path events, with persisted per-user preferences that gate delivery.

**Architecture:** A `Notification` Mongo collection + a `notificationService.notify()` called inline at each trigger site (try/catch, best-effort — never blocks the money op). Push via `expo-server-sdk` (fire-and-forget). Client reads list + unread count over REST with React Query (focus refetch + light poll). No event bus, no sockets.

**Tech Stack:** Express ESM + Mongoose (backend), jest + supertest (backend tests), React Native / Expo SDK 54 + React Query (client), `expo-notifications` + `expo-device` (client push), `expo-server-sdk` (backend push).

Spec: `docs/superpowers/specs/2026-07-16-notifications-design.md`.

## Global Constraints

- Backend is ESM (`import`/`export`), Mongoose models default-export a `mongoose.model(...)`.
- All notification routes are user-scoped behind `protect`; a user only sees/mutates their own rows.
- Trigger-site `notify()` calls are wrapped in try/catch and never awaited in a way that can fail the money op (mirror the existing fire-and-forget `Deal.findByIdAndUpdate({$inc:{clickCount}})`).
- Notification prefs default **ON** (opt-out). Category pref off ⇒ no in-app row AND no push.
- Web (`Platform.OS === 'web'`) never registers for push (Expo push is native-only); the in-app center still works.
- Backend tests follow `src/__tests__/categories.test.js`: supertest against `app.js`, with the ECONNREFUSED/Mongo-not-connected graceful skip.
- Client changes verified via `npx tsc --noEmit` + the running app (no client test framework).

---

## File Map

**Backend (create):**
- `src/modules/notifications/notificationModel.js` — the Notification schema.
- `src/modules/notifications/notificationTemplates.js` — `type → {title, body}` builder.
- `src/modules/notifications/notificationService.js` — `notify()` + Expo push send/prune.
- `src/modules/notifications/notificationController.js` — list/unread/read/read-all/push-token.
- `src/modules/notifications/notificationRoutes.js` — routes.
- `src/__tests__/notifications.test.js` — supertest smoke tests.

**Backend (modify):**
- `src/modules/users/userModel.js` — add `pushTokens[]` + `notificationPrefs`.
- `src/modules/users/userController.js` (+ routes) — `PATCH /api/users/me/notification-prefs`.
- `src/app.js` — mount `/api/notifications`.
- `src/modules/admin/walletOpsController.js` — `notify()` in `importReport` + `updateWithdrawal`.
- `src/modules/wallet/walletController.js` — `notify()` in `requestWithdrawal`.
- `src/scripts/confirmExpiredLocks.js` — `notify()` per unlocked user.
- `package.json` — add `expo-server-sdk`.

**Client (create):**
- `src/api/notifications.ts` — API client.
- `src/lib/push.ts` — Expo push register/unregister + handlers.
- `src/hooks/useUnreadCount.ts` — unread-count query hook.

**Client (modify):**
- `src/screens/Dashboard/NotificationsScreen.tsx` — real list.
- Nav components (sidebar + mobile) — unread badge on the Notifications item.
- `src/screens/Dashboard/SettingsScreen.tsx` + `MobileSettingsScreen.tsx` — wire prefs toggles.
- App root (where auth/session boots) — call push register on login, unregister on logout.
- `package.json` — add `expo-notifications`, `expo-device`.

---

## Phase 1 — Backend foundation

### Task 1: Notification model

**Files:** Create `src/modules/notifications/notificationModel.js`

**Produces:** default-exported `Notification` model with fields `{ userId, type, title, body, data, read, readAt, timestamps }`; `type` enum `['coins_credited','coins_unlocked','withdrawal_submitted','withdrawal_paid','withdrawal_rejected']`; indexes `{userId,createdAt:-1}` and `{userId,read}`.

- [ ] **Step 1:** Write the model (mirror `dealModel.js` structure): schema with the fields above, `data: { type: mongoose.Schema.Types.Mixed, default: {} }`, `read: { type: Boolean, default: false }`, `timestamps: true`; add the two indexes; `export default mongoose.model('Notification', schema)`.
- [ ] **Step 2:** `node --check src/modules/notifications/notificationModel.js` → OK.
- [ ] **Step 3:** Commit `feat(notifications): add Notification model`.

### Task 2: User model — pushTokens + notificationPrefs

**Files:** Modify `src/modules/users/userModel.js`

**Produces:** `user.pushTokens: [{ token, platform, updatedAt }]` and `user.notificationPrefs: { cashback:Boolean=true, withdrawals:Boolean=true, push:Boolean=true }`.

- [ ] **Step 1:** Add to the user schema:
  ```js
  pushTokens: [{ token: String, platform: String, updatedAt: Date }],
  notificationPrefs: {
    cashback:    { type: Boolean, default: true },
    withdrawals: { type: Boolean, default: true },
    push:        { type: Boolean, default: true },
  },
  ```
- [ ] **Step 2:** `node --check src/modules/users/userModel.js` → OK.
- [ ] **Step 3:** Commit `feat(notifications): user push tokens + notification prefs`.

### Task 3: notificationService + templates (+ expo-server-sdk)

**Files:** Create `notificationTemplates.js`, `notificationService.js`; Modify `package.json`

**Consumes:** Notification model (T1), User model (T2).
**Produces:** `buildTemplate(type, data) → { title, body }`; `async notify({ userId, type, data }) → notification|null` (respects prefs, creates in-app row, sends push).

- [ ] **Step 1:** `cd backend && npm install expo-server-sdk`.
- [ ] **Step 2:** `notificationTemplates.js` — `export function buildTemplate(type, data)` with a switch over the 5 types returning `{title, body}`. Copy (data-interpolated):
  - `coins_credited` → `{ title: 'Cashback on the way 🎉', body: \`\${data.coins} coins from order \${data.orderId} are pending — they unlock in 30 days.\` }`
  - `coins_unlocked` → `{ title: 'Coins unlocked ✅', body: \`\${data.coins} coins are now available to withdraw.\` }`
  - `withdrawal_submitted` → `{ title: 'Withdrawal requested', body: \`Your ₹\${data.amount} withdrawal is being processed.\` }`
  - `withdrawal_paid` → `{ title: 'Withdrawal paid 💸', body: \`₹\${data.amount} has been sent to your \${data.method || 'account'}.\` }`
  - `withdrawal_rejected` → `{ title: 'Withdrawal rejected', body: \`Your ₹\${data.amount} withdrawal was rejected. Your coins were not debited.\` }`
- [ ] **Step 3:** `notificationService.js` — `CATEGORY = { coins_credited:'cashback', coins_unlocked:'cashback', withdrawal_submitted:'withdrawals', withdrawal_paid:'withdrawals', withdrawal_rejected:'withdrawals' }`. `notify()`:
  1. `const user = await User.findById(userId).select('pushTokens notificationPrefs').lean(); if (!user) return null;`
  2. `const prefs = user.notificationPrefs || {}; if (prefs[CATEGORY[type]] === false) return null;`
  3. `const { title, body } = buildTemplate(type, data); const notif = await Notification.create({ userId, type, title, body, data });`
  4. `if (prefs.push !== false && user.pushTokens?.length) sendPush(user, { title, body, data }).catch(()=>{});` (fire-and-forget)
  5. `return notif;`
  - `sendPush(user, msg)`: build Expo messages for each valid `Expo.isExpoPushToken` token, `expo.sendPushNotificationsAsync` in chunks; on `status:'error'` + `details.error==='DeviceNotRegistered'`, `User.updateOne({_id:user._id},{$pull:{pushTokens:{token}}})`.
- [ ] **Step 4:** `node --check` both files → OK.
- [ ] **Step 5:** Commit `feat(notifications): notify() service + Expo push + templates`.

---

## Phase 2 — Backend API

### Task 4: Notification routes + controller + mount + prefs endpoint

**Files:** Create `notificationController.js`, `notificationRoutes.js`, `src/__tests__/notifications.test.js`; Modify `src/app.js`, `src/modules/users/userController.js` (+ its routes)

**Consumes:** Notification model, notify() service, User model.
**Produces:** REST endpoints listed in the spec §API.

- [ ] **Step 1:** `notificationController.js` (async handlers, `req.user._id`):
  - `list` → `Notification.find({userId, ...(before?{createdAt:{$lt:before}}:{})}).sort({createdAt:-1}).limit(Math.min(+limit||30,100)).lean()` → `{ status:'success', data:{ notifications } }`.
  - `unreadCount` → `{ data:{ count: await Notification.countDocuments({userId, read:false}) } }`.
  - `markRead` → `Notification.updateOne({_id:req.params.id, userId}, {$set:{read:true, readAt:new Date()}})`.
  - `markAllRead` → `Notification.updateMany({userId, read:false}, {$set:{read:true, readAt:new Date()}})`.
  - `registerPushToken` → `User.updateOne({_id:userId}, {$pull:{pushTokens:{token}}})` then `{$push:{pushTokens:{token,platform,updatedAt:new Date()}}}` (dedupe).
  - `unregisterPushToken` → `User.updateOne({_id:userId}, {$pull:{pushTokens:{token}}})`.
- [ ] **Step 2:** `notificationRoutes.js`: `router.use(protect)`; wire GET `/`, GET `/unread-count`, PATCH `/:id/read`, PATCH `/read-all`, POST `/push-token`, DELETE `/push-token`.
- [ ] **Step 3:** `app.js`: `app.use('/api/notifications', notificationRoutes)` (next to the other `/api/*` mounts).
- [ ] **Step 4:** userController: add `updateNotificationPrefs` (`User.findByIdAndUpdate(req.user._id, {$set: pick(req.body, ['notificationPrefs.cashback','notificationPrefs.withdrawals','notificationPrefs.push'])}, {new:true})`) and route `PATCH /api/users/me/notification-prefs` under `protect`.
- [ ] **Step 5:** `notifications.test.js` (mirror categories.test.js harness incl. Mongo-skip): `GET /api/notifications` → 401 without auth; `GET /api/notifications/unread-count` → 401 without auth; `POST /api/notifications/push-token` → 401 without auth.
- [ ] **Step 6:** Run `npm test -- notifications` → PASS (or graceful skip if no Mongo). Boot the server (`preview_start backend`) and confirm clean boot + `MongoDB Connected`.
- [ ] **Step 7:** Commit `feat(notifications): REST API + prefs endpoint`.

---

## Phase 3 — Backend triggers

### Task 5: Wire notify() into the 5 sites

**Files:** Modify `walletOpsController.js`, `walletController.js`, `scripts/confirmExpiredLocks.js`

**Consumes:** `notify()` from T3.

- [ ] **Step 1:** `walletOpsController.importReport` — after the per-row `Wallet.updateOne({$inc:{pendingCoins}})` (~line 606), add `try { await notify({ userId, type:'coins_credited', data:{ coins: coinsToCredit, orderId: row.orderId } }); } catch {}`.
- [ ] **Step 2:** `walletOpsController.updateWithdrawal` — after status resolves (~line 363–378): if `nextStatus==='completed'` → `notify(... 'withdrawal_paid', {amount, method})`; if `nextStatus==='rejected'` → `notify(... 'withdrawal_rejected', {amount})`. (Get `userId`/`amount`/`method` from the withdrawal doc.) Wrap each in try/catch.
- [ ] **Step 3:** `walletController.requestWithdrawal` — after the withdrawal is created (line 133+), `try { await notify({ userId:req.user._id, type:'withdrawal_submitted', data:{ amount } }); } catch {}`.
- [ ] **Step 4:** `confirmExpiredLocks.js` — inside the per-user `for (const [userId, amt] of perUser)` loop (~line 63), after the `Wallet.updateOne`, `try { await notify({ userId, type:'coins_unlocked', data:{ coins: amt } }); } catch {}`. Import `notify`.
- [ ] **Step 5:** `node --check` all 3 files; boot backend → clean.
- [ ] **Step 6:** Integration check (manual, needs Mongo + a test user): run a report import via the admin UI → confirm a `coins_credited` row exists (`GET /api/notifications` as that user). *(Reuse the QA flow; clean up after.)*
- [ ] **Step 7:** Commit `feat(notifications): emit notifications on coin + withdrawal events`.

---

## Phase 4 — Client in-app center

### Task 6: notifications API client

**Files:** Create `src/api/notifications.ts`

**Produces:** `notificationsAPI = { list(before?), unreadCount(), markRead(id), markAllRead(), registerPushToken(token,platform), unregisterPushToken(token), updatePrefs(prefs) }` using `apiClient`.

- [ ] **Step 1:** Write it (mirror `src/api/clicks.ts` shape). Each method calls `apiClient` and returns `res.data?.data`.
- [ ] **Step 2:** `npx tsc --noEmit` (grep for notifications) → clean.
- [ ] **Step 3:** Commit `feat(notifications): client api`.

### Task 7: NotificationsScreen — real list

**Files:** Modify `src/screens/Dashboard/NotificationsScreen.tsx`

**Consumes:** notificationsAPI.

- [ ] **Step 1:** Replace the placeholder: `useQuery(['notifications'], () => notificationsAPI.list())`; render a list — each row: type icon (lucide: Coins / ArrowDownToLine), title (bold), body, relative time, an unread dot when `!read`. Tapping a row → `notificationsAPI.markRead(id)` + invalidate. A "Mark all read" header action → `markAllRead` + invalidate. Keep the existing empty-state card for zero. Pull-to-refresh (RefreshControl → refetch).
- [ ] **Step 2:** `npx tsc --noEmit` → clean.
- [ ] **Step 3:** Verify in the app: as a user with notifications, the list renders + mark-read clears the dot + updates the badge. (Depends on T5 producing rows.)
- [ ] **Step 4:** Commit `feat(notifications): real notifications screen`.

### Task 8: Unread badge on the nav

**Files:** Create `src/hooks/useUnreadCount.ts`; Modify the user sidebar + mobile nav components that render the "Notifications" item.

**Consumes:** notificationsAPI.unreadCount.

- [ ] **Step 1:** `useUnreadCount` → `useQuery(['notifications','unread'], notificationsAPI.unreadCount, { refetchInterval: 60000, refetchOnWindowFocus: true })`.
- [ ] **Step 2:** In the nav, render a small red badge with the count next to "Notifications" when `count > 0` (cap at "9+").
- [ ] **Step 3:** `npx tsc --noEmit` → clean. Verify the badge shows/clears.
- [ ] **Step 4:** Commit `feat(notifications): unread badge on nav`.

---

## Phase 5 — Client push

### Task 9: Expo push registration + handlers

**Files:** Create `src/lib/push.ts`; Modify `package.json`, the app root (login/logout wiring), `app.json`/config if a projectId is needed.

**Consumes:** notificationsAPI.registerPushToken/unregisterPushToken.

- [ ] **Step 1:** `npx expo install expo-notifications expo-device`.
- [ ] **Step 2:** `push.ts`:
  - `registerForPush()`: `if (Platform.OS === 'web' || !Device.isDevice) return;` request permissions (`Notifications.getPermissionsAsync` → `requestPermissionsAsync`); if granted, `const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;` → `notificationsAPI.registerPushToken(token, Platform.OS)`; set the Android channel. Store the token locally (SecureStore) so logout can unregister it.
  - `unregisterForPush()`: read stored token → `notificationsAPI.unregisterPushToken(token)` → clear it.
  - Set `Notifications.setNotificationHandler` (show alerts in foreground); add a response listener that deep-links (e.g. navigates to Wallet or the notification) on tap.
- [ ] **Step 3:** Call `registerForPush()` after a successful login (only if `prefs.push !== false`) and `unregisterForPush()` on logout, in the auth flow.
- [ ] **Step 4:** `npx tsc --noEmit` → clean. Boot the app on web → confirm push code is skipped (no errors). Native push verified manually on a device (permission prompt → token registered → send a test event → push received/tapped).
- [ ] **Step 5:** Commit `feat(notifications): expo push registration + handlers`.

---

## Phase 6 — Settings wiring

### Task 10: Wire the Settings toggles to prefs

**Files:** Modify `src/screens/Dashboard/SettingsScreen.tsx`, `src/screens/Dashboard/MobileSettingsScreen.tsx`

**Consumes:** notificationsAPI.updatePrefs; the user's `notificationPrefs` (from the auth/profile query).

- [ ] **Step 1:** Load current prefs (from the cached user / a profile fetch). Wire "Cashback Updates" → `cashback`, add a "Withdrawal Updates" row → `withdrawals`, add a "Push Notifications" row → `push`. Each toggle → optimistic local state + `notificationsAPI.updatePrefs({ [key]: value })`. The push toggle, when turned on, also triggers `registerForPush()`; when off, `unregisterForPush()`. Leave Deal/Referral/Email toggles as-is (cosmetic).
- [ ] **Step 2:** `npx tsc --noEmit` → clean. Verify: toggling persists (reload → state restored) and gating works (turn Cashback off → no coin notification on the next credit).
- [ ] **Step 3:** Commit `feat(notifications): wire settings prefs toggles`.

---

## Self-review notes

- **Spec coverage:** model (T1) · prefs+tokens (T2) · service+push+templates (T3) · API+prefs endpoint (T4) · 5 triggers (T5) · client api (T6) · screen (T7) · badge (T8) · push (T9) · settings (T10). All spec sections mapped.
- **Types:** `notify({userId,type,data})` is the single service signature used by all of T5; `notificationsAPI` method names in T6 are consumed verbatim by T7/T8/T9/T10.
- **Deps:** `expo-server-sdk` (T3), `expo-notifications`+`expo-device` (T9) — the only new packages.
- **Web:** push guarded in T9 (`Platform.OS==='web' || !Device.isDevice` early-return).
