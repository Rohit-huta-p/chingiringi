# Click-confirmed shares — design spec

Date: 2026-08-11
Status: approved design, pre-plan

## Goal

Today a share credits the share reward (`coinsPerShare`) the instant the client
calls `POST /api/shares` — which only proves the share *sheet* opened (or that
someone called the API with a valid token). There's no evidence the share
reached a real person, so the reward is trivially farmable.

Make the reward **click-confirmed**: a share is *promised* (pending, no coins)
when made, and only *paid* (confirmed) once someone **other than the sharer**
actually opens the shared link. This is the standard referral-program bar.

## Decisions (locked)

- **Confirm rule:** web-click heuristic — a different visitor (IP ≠ sharer's),
  after a short delay. No app-install or login required of the opener.
- **Coins:** withheld until confirmed. The wallet only ever holds real,
  spendable coins — no pending bucket, no clawback.
- **Reward amount:** `coinsPerShare = 50` → ₹0.05 (5 paise) at the intended
  `coinsPerRupee = 1000`; the 100/day cap = ₹5/day max per user. The reward is a
  separate knob from the exchange rate, so this changes shares only — not
  withdrawals, cashback, or ₹-liability. Never re-derive 5 paise by changing
  `coinsPerRupee` (that devalues every coin system-wide).
- **Link:** self-describing — `<SHARE_BASE>/s/<type>/<id>?ref=cr_<userId>`.
  No server round-trip before sharing; maps 1:1 to a `ShareEvent` via the
  existing unique `(userId,itemType,itemId,day)` index.
- **Redirect host:** `SHARE_BASE = https://chingiringi-backend.onrender.com`
  (the deployed backend). A branded domain fronting it is a later, code-free
  follow-up.

## Lifecycle

```
share  ──▶  pending (no coins)  ──▶  friend opens link  ──▶  different visitor?
                                                              ├─ yes ▶ confirmed (pay coinsPerShare = 50 CR)
                                                              └─ no  ▶ stays pending
pending, 30 days, nobody opens  ──▶  expired (never paid)
```

## Data model — `ShareEvent` additions

`backend/src/modules/shares/shareModel.js`:

- `status: { type: String, enum: ['pending','confirmed','expired'], default: 'pending', index: true }`
- `sharerIp: String`, `sharerUa: String` — captured at share time; used to reject the sharer opening their own link
- `confirmedAt: Date`
- `coinsAwarded` stays, but is only moved into the wallet on confirm

Keep the unique index `(userId, itemType, itemId, day)` — the self-describing
link resolves to exactly one `ShareEvent` per day via these fields.

**Migration:** existing rows (created under instant-credit) predate `status`.
One-off `updateMany({ status: { $exists: false } }, { $set: { status: 'confirmed' } })`
— they were already paid, so mark them confirmed. Pre-launch, likely few/none.

## Backend

### 1. `createShare` (POST /api/shares) — stop crediting; go pending

Unchanged: item validation, daily-cap check, dedup (the unique index).
Changed: instead of crediting the wallet + writing a Transaction, create a
**pending** `ShareEvent` capturing `sharerIp = req.ip`, `sharerUa =
req.headers['user-agent']`. Return `{ status:'pending', shareUrl, remainingToday }`
where `shareUrl = ${SHARE_BASE}/s/${itemType}/${itemId}?ref=cr_${userId}`.
The wallet-credit block moves out to the confirm path (below).

### 2. `GET /s/:type/:id` — the redirect + confirm endpoint (public)

New route, mounted OUTSIDE `/api` (e.g. `app.use('/s', shareRedirectRoutes)`),
`optionalProtect` (opener is usually anonymous). Mirrors the existing
`redirectAndLog` pattern (`clickController.js:115`).

1. Parse `type`/`id` from the path; `sharerUserId` from `?ref=cr_<userId>`
   (validate ObjectId; if missing/invalid → skip confirm, just redirect).
2. `day = istDayBucket()`; find the `ShareEvent` `(sharerUserId, type, id, day)`.
   (Also try recent prior days within the pending window, since a friend may
   click a day or two later — match the most recent pending event for that
   `(user,type,id)` within 30 days.)
3. Log the open (visitor `ip`, `ua`, `ts`) — a lightweight `ShareClick` record
   (or reuse `ClickEvent` with `source:'share'`).
4. Run `evaluateShareConfirm(...)` (below). If it says confirm → confirm
   (status → `confirmed`, `confirmedAt`, credit wallet, write Transaction,
   notify).
5. **Always** `302` redirect onward to the share target, even if not confirmed
   or something errored. Wrap logging/confirm in try/catch — the opener's
   redirect must never fail.

**Redirect target — open the app at that product first, else the web page.**
App if installed; otherwise the web version of that product/store. No app-store
fallback — a not-installed user lands on web.

Key constraint: confirmation requires the click to reach our server, so we do
**NOT** use OS universal/app links (those open the app directly and bypass our
endpoint → nothing confirms). Instead `/s/:type/:id` returns a tiny
**interstitial page** that runs *after* we've logged + confirmed:
1. Attempt the app via a custom scheme — `chingiringapp://<type>/<id>`.
2. If the app doesn't take over within ~1.5s (not installed / desktop), redirect
   to the web page — `${WEB_BASE}/<type>/<id>` (`WEB_BASE` configurable).
3. Include a visible "Open in app / Continue on web" button so in-app browsers
   (WhatsApp/IG webviews often block scheme redirects) aren't a dead end.

**Graceful degradation (why the destination isn't a blocker):** the web fallback
works from day one. The *native app-open* only lights up once the app registers
the `chingiringapp://` scheme and routes `product/:id` / `store/:id` to the
detail screens (Expo Linking config → needs an EAS rebuild). Until that rebuild
ships, every click simply lands on web — fine, and fully testable now.

Dependency: a live **web page** at `${WEB_BASE}/<type>/:id` for the fallback to
land on (the Expo web build, or a minimal product/store page). If none exists
yet, `WEB_BASE` can point at a placeholder until it does.

### 3. `evaluateShareConfirm(...)` — pure, testable core

`backend/src/modules/shares/shareConfirm.js`:

```
evaluateShareConfirm({ status, sharerIp, visitorIp, visitorUa, ageSeconds, minAgeSeconds = 15 })
  → { confirm: boolean, reason: string }
isLikelyBot(ua) → boolean
```

Confirm iff: `status === 'pending'` AND `!isLikelyBot(visitorUa)` AND
`visitorIp && visitorIp !== sharerIp` AND `ageSeconds >= minAgeSeconds`.
Otherwise `{confirm:false, reason:'…'}` (`already_confirmed` | `bot` |
`self_ip` | `too_soon` | `not_found`). No I/O.

**Bot / preview-fetch exclusion (critical).** When a link is posted to
WhatsApp/Telegram/iMessage/FB, the platform's servers fetch it to render a
preview card — a different-IP GET that arrives *before any human clicks*.
Without filtering, every share auto-confirms from the preview bot. `isLikelyBot`
denies known crawler UAs (`facebookexternalhit`, `WhatsApp`, `TelegramBot`,
`Twitterbot`, `Slackbot`, `LinkedInBot`, `Discordbot`, and generic
`bot`/`crawler`/`spider`/`preview`). Imperfect (a UA-less prefetch slips
through), but it removes the dominant false-positive; the min-age check is a
weak backstop, not the defense.

Idempotency: the actual DB confirm is guarded by `status === 'pending'` (an
atomic `findOneAndUpdate({_id, status:'pending'}, {$set:{status:'confirmed',…}})`),
so concurrent opens pay exactly once.

### 4. Confirm = the credit (moved verbatim from today's `createShare`)

On confirm: `wallet.coins += coinsPerShare`, `wallet.lifetimeEarned +=
coinsPerShare`, `Transaction { type:'coin_credit', status:'confirmed',
metadata:{ reason:'share', itemType, itemId } }`, `notify('wallet_credited')`.
Same primitives as the current code — just relocated to fire on confirm.

### 5. Expiry

Pending `ShareEvent`s older than 30 days → `expired` (never credited).
Lazy-expire when listing a user's shares, plus a periodic sweep reusing the
`confirmExpiredLocks` job pattern.

### 6. Daily cap + dedup — unchanged

Both still apply to **created** shares (bounds pending-record spam). The
reward gate is now confirmation, not creation.

## App (chingiring-app)

- Share link → `${EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com'}/s/${type}/${id}?ref=cr_${user.id}` in the 4 detail screens
  (`ProductDetailScreen`, `MobileProductDetailScreen`, `StoreDetailScreen`,
  `OfflineStoresScreen`). Also fixes the stale `chingiring.app` fallback in
  `StoreDetailScreen`.
- `createShare` no longer credits → UI copy changes from an instant "Earn N CR"
  Alert to **"Pending — N CR unlocks when a friend opens your link."**
- **Read the amount from settings — don't hardcode.** `ShareSheet` currently
  defaults `coins = 100` and renders "Earn {coins} CR" (`ShareSheet.tsx:56,92`),
  and the detail screens pass nothing → the UI shows 100 even though the backend
  now pays `coinsPerShare = 50`. The app must source the amount from
  `coinsPerShare` (surface it on `GET /api/shares/quota`, which the screens
  already call) so the promise always matches the payout.
- Wallet/quota surfaces reflect pending vs confirmed. Keep the current share
  order (the link is self-describing, so the pending event just needs to exist
  before the friend clicks — which it does).

## Dashboard consistency

Earnings must count **confirmed only**. Transaction-based metrics self-correct
(the Transaction now only exists on confirm). The one spot to fix:
`adminController.getDashboardStats` hero `coinsFromShares` sums
`ShareEvent.coinsAwarded` → filter `status:'confirmed'`. Optionally surface
pending-vs-confirmed share counts. Small, in scope.

## Error handling & config

- **`trust proxy` (critical).** The IP compare only works if `req.ip` is the
  real client IP. On Render the app sits behind a proxy, so without
  `app.set('trust proxy', 1)` (reading `X-Forwarded-For`), both `sharerIp` and
  every `visitorIp` collapse to the proxy IP → `visitorIp === sharerIp` always →
  nothing ever confirms. Verify/enable it; it also fixes `sharerIp` capture in
  `createShare`.
- The `/s` redirect is best-effort on logging/confirm and **always** 302s.
- Confirm is atomic + idempotent via the `status:'pending'` guard.
- Rate-limit `/s` (it's a public GET that can trigger a wallet credit) — cover
  it with the existing global limiter or a dedicated one.
- Credit stays non-transactional to match existing wallet code (worst case: a
  confirmed event with a rare save failure = user short one reward, recoverable).

## Testing

- `evaluateShareConfirm` unit tests: self-IP → no, too-soon → no, **bot UA
  (`facebookexternalhit`/`WhatsApp`) → no**, different IP + human UA after
  delay → yes, already-confirmed → no, missing visitorIp → no. Plus
  `isLikelyBot` cases.
- Route test: `GET /s/product/:id` returns 302; a same-IP/too-soon/bot-UA open
  does NOT confirm (status stays pending, no Transaction).
- Keep existing share tests; update the `createShare` test to assert pending +
  no immediate credit.

## Security / abuse — honest limits

The IP heuristic catches lazy self-farming. It does NOT stop a determined
abuser with a second device on mobile data (different IP → self-confirms), and
it under-credits genuine friends on the **same home WiFi** (same IP as sharer).
Mitigations: velocity/pattern flags on `ShareClick` for admin review; the
strict upgrade (require the opener to sign in) stays available later. State this
plainly — the reward is "reached a different network," not "reached a verified
human."

## Launch config (stored-value flips, not just schema defaults)

Both live on the singleton `AdminSettings` doc; changing the schema default does
NOT touch an existing row — flip the stored value (admin Wallet-Ops settings or
`PATCH /api/admin/settings`):

- `coinsPerShare = 50` (schema default 100 → 50, and flip the stored doc).
- `coinsPerRupee = 1000` (the existing gate — if the stored value is still `10`,
  every ₹ figure, including a confirmed share, reads 100× off).

## Follow-ups (out of scope for v1)

- Branded redirect domain (`l.chingiring.com` → Render).
- A real product/store web landing page as the redirect target.
- Sign-in-confirmed shares (strict tier) and abuse-scoring.
- Device fingerprint beyond IP+UA.
