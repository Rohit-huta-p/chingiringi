# Referral system — design spec

Date: 2026-08-11
Status: approved design, pre-plan

## Goal

Turn the half-scaffolded referral fields into a working growth loop: every user
has a shareable code; a referred friend who **downloads the app and logs in via
the app** unlocks a bonus for both sides. The app-login gate is deliberate —
the whole point is to convert web traffic into app installs.

## Decisions (locked)

- **Reward (asymmetric, two-sided):** referrer **₹25 = 25,000 coins**, referee
  **₹5 = 5,000 coins**, at the intended `coinsPerRupee = 1000`. Each is its own
  AdminSettings knob (`coinsPerReferralReferrer`, `coinsPerReferralReferee`).
  **Never** re-derive ₹ by changing `coinsPerRupee` — that devalues every coin
  system-wide (same rule the shares spec enforces).
- **Payout gate:** the bonus is *promised* (pending, no coins) at signup and
  *paid* (confirmed) only when the **referee opens the app and its client calls
  the confirm endpoint**. The app is the only client wired to call it, so a
  web-only user stays pending until they install and open the app — a **product
  gate, not a hard boundary** (see Anti-abuse). This is the "sign-in-confirmed /
  strict tier" the click-confirmed-shares spec listed as a follow-up.
- **No new collection.** A referral is 1:1 with the referee (one ever), so its
  state lives on the referee's `User` doc: `referredBy` (exists) + a new
  `referralStatus`. Referrer stats come from aggregation over `referral`
  Transactions + a `referredBy` count. The wallet only ever holds real,
  spendable coins — no pending bucket, no clawback.
- **Deferred deep-link = manual fallback (v1).** Autofill works only when the
  app is already installed (the `/r/:code` link opens it with the code).
  Not-installed → App/Play Store → the user types the code manually at signup
  (the manual-entry path we already want). No IP-match, no third-party SDK.
- **Link:** `<SHARE_BASE>/r/<CODE>` where the code is the existing per-user
  `referralCode`. Host = the deployed backend (like `/s/`), branded domain later.

## Lifecycle

```
signup w/ code  ──▶  pending (no coins)  ──▶  referee logs in VIA APP  ──▶  confirmed
                                                                            (pay both:
                                                                             referrer 25,000
                                                                             referee   5,000)
web signup, never opens app   ──▶  stays pending
pending, 30 days (defaultLockDays)  ──▶  expired (never paid)
app-native signup             ──▶  app-authenticated immediately ──▶ confirmed at once
```

## Data model

### `User` additions — `backend/src/modules/users/userModel.js`

- `referralCode` — **already exists**: `crypto.randomBytes(4).toString('hex')
  .toUpperCase()`, `unique`, returned by `getMe`. Reused as-is.
- `referredBy` — **already exists**: `ObjectId → User`, the referrer. Set at capture.
- **New** `referralStatus: { type: String, enum: ['pending','confirmed','expired'], index: true }`
  — absent for organic signups; set only when a referral is captured.

Pending age = `now - user.createdAt` (referral is captured at user creation), so
no separate timestamp is needed. Transactions carry the credit timestamps.

**Migration (one-off):** backfill `referralCode` for any pre-existing users that
lack one — the `unique` index is **not** `sparse`, so multiple blank codes would
collide. Pre-launch this is likely few/none, but run it before the index bites.

### AdminSettings knobs — `backend/src/modules/admin/adminSettingsModel.js`

- `coinsPerReferralReferrer: { type: Number, default: 25000, min: 0 }`
- `coinsPerReferralReferee:  { type: Number, default: 5000,  min: 0 }`

Reuse `defaultLockDays` (30) for referral expiry. `Transaction.type` already
includes `'referral'`; the wallet earnings aggregation already counts it.

## Backend — new `referrals/` module

`backend/src/modules/referrals/` — small: controller + routes + one pure helper.
Reuses the existing wallet-credit primitive, `AdminSettings.get()`, `notify()`.

### 1. `POST /api/referrals/apply { code }` (auth) — capture

Called by the client **right after a successful signup** (any method: email,
Google, or phone-OTP). Keeping capture in its own endpoint means the referral
logic never touches the shared auth/login paths (the mobile signup is phone-OTP,
which auto-creates the user deep inside `verifyUserOTP` — threading a code
through it is messy and risky). Guards live in the pure `canApplyReferral`
helper: unknown code, self-referral, already-referred, and a 48h
"applied within the signup window" check. On success it sets `referredBy` +
`referralStatus:'pending'` on the caller (guarded by `{referredBy:{$exists:false}}`
against a double-apply race). A bad/unknown code returns `{applied:false}`
without erroring — signup UX is never blocked.

### 2. `POST /api/referrals/claim` (auth, app-only) — the confirm

The app calls this once after a successful login/signup **from the app**
(cheap no-op unless the caller is `pending`). `getMe` surfaces `referralStatus`
so the app knows when a claim is worthwhile.

```
const referee = req.user;
// atomic, idempotent — only a pending referral flips
const updated = await User.findOneAndUpdate(
  { _id: referee._id, referralStatus: 'pending' },
  { $set: { referralStatus: 'confirmed' } }, { new: true });
if (!updated) return res.json({ status: 'success', data: { credited: false } });

const s = await AdminSettings.get();
// credit both sides (same primitive as shares/adminWalletOps):
//   wallet.coins += amount; wallet.lifetimeEarned += amount;
//   Transaction { type:'referral', status:'confirmed', metadata:{ reason:'referral', role } }
//   notify('wallet_credited')
creditWallet(updated.referredBy, s.coinsPerReferralReferrer, { role:'referrer' });
creditWallet(referee._id,        s.coinsPerReferralReferee,  { role:'referee'  });
return res.json({ status:'success', data:{ credited:true, referee: s.coinsPerReferralReferee }});
```

Idempotent via the `referralStatus:'pending'` guard — concurrent/repeat claims
pay exactly once. Credit stays non-transactional to match existing wallet code
(worst case: a rare save failure = one side short a reward, recoverable).

### 3. `GET /r/:code` — smart redirect + interstitial (public, outside `/api`)

Mounted `app.use('/r', referralRedirectRoutes)`. Best-effort, always responds.

1. `pickStoreUrl(ua)` (pure) → App Store (iOS) / Play Store (Android) / web
   signup (desktop), URLs from env (placeholder until the apps are published).
2. Return a tiny **interstitial** HTML page:
   - attempt the app: `window.location = 'chingiring://signup?ref=' + code`
     (reuses the existing `Signup` linking route);
   - after ~1.5s (not installed) → `pickStoreUrl(ua)`;
   - visible **"Open app / Get the app / Continue on web"** buttons — in-app
     browsers (WhatsApp/IG) block scheme redirects, so buttons are the escape.
3. An unknown code still serves a generic "get the app" page (don't leak / don't 500).

No OS universal links (custom scheme only, as configured), so the link reaches
our page rather than deep-opening past it — consistent with the shares design.

### 4. `GET /api/referrals/stats` (auth) — fills the dashboard zeros

Returns `{ referralCode, confirmedCount, pendingCount, earningsCoins }`:
- `confirmedCount = User.countDocuments({ referredBy: me, referralStatus:'confirmed' })`
- `earningsCoins` = sum of this user's `type:'referral'` Transactions (accurate history).

Lazy-expire here: pending referees with `createdAt < now - defaultLockDays` →
set `referralStatus:'expired'` (plus reuse the `confirmExpiredLocks` sweep pattern).

## App (chingiring-app)

- **SignupScreen:** optional "Referral code" field. **Autofill** from
  `route.params.ref` when opened via `chingiring://signup?ref=<code>` (reuses the
  existing `Signup` linking route — no new route; the app scheme is `chingiring`,
  not `chingiringi`, so `linking.ts` `prefixes` need `chingiring://` added).
  **Manual entry** otherwise (the not-installed path). On signup success, call
  `referralsAPI.apply(code)` **before** `hydrate()` (so the pending referral
  exists before the native `claim()` fires).
- **OTP-login path (`MobileLoginScreen` → `MobileOTPScreen`):** phone-OTP
  auto-creates a brand-new user inside `verifyUserOTP`, so the OTP-login tab
  carries its own optional "Referral code" field, threaded to `MobileOTPScreen`
  via nav params. On verify success it calls `referralsAPI.apply(code)`
  **before** `hydrate()`, mirroring SignupScreen. Without this, a friend who
  signs up the frictionless way (phone only, never touching SignupScreen) never
  gets their code applied. `apply()`'s guards make it a safe no-op when an
  existing user merely logs in via OTP.
- **Post-login:** call `POST /api/referrals/claim` once after a successful
  app login/signup (no-op unless pending). On `credited:true`, toast
  "You earned ₹5!".
- **Referral card / ReferScreen:** wire `MobileProfileScreen`'s hardcoded
  `referralCount`/`referralEarnings` `0`s to `GET /api/referrals/stats`; fix copy
  **"Earn ₹50 per friend" → "Earn ₹25 — your friend gets ₹5"**; link =
  `${EXPO_PUBLIC_SHARE_BASE || <backend>}/r/${referralCode}`.

## Anti-abuse — honest ceiling

One referral per referee (the single `referralStatus` on their User doc),
self-referral blocked, unknown codes ignored. Identity anchor = OTP/Google-
verified signup — **the same farmable ceiling as share-to-earn**: someone who
mass-creates verified accounts can farm. Accepted; matches the existing bar.

The app-login gate is enforced only by *which client calls `/claim`* (the app
does, the web bundle doesn't) — a technical user could call the endpoint
directly and self-confirm without installing. For the non-technical majority the
gate holds and installs are driven as intended; hardening it into a real
boundary (require a verified app signal on claim) is a follow-up, not v1.
Velocity/pattern flags for admin review stay a later option.

## Testing

- `canApplyReferral` (pure): unknown code → `invalid_code`, self → `self`,
  already-referred → `already_referred`, past the 48h window → `too_old`, else `ok`.
- `pickStoreUrl` / `referralConfirmDecision` (pure): device routing + confirm/expire guards.
- `claim`: pending → credits both correct amounts + flips confirmed; **double
  claim → credits once** (idempotent); non-pending → no-op.
- `pickStoreUrl(ua)`: iOS UA → App Store, Android UA → Play Store, else web.
- Route: `GET /r/:code` returns an interstitial (200) for known and unknown codes.

## Config / deploy gates

- **Flip the stored AdminSettings doc**, not just the schema default:
  `coinsPerReferralReferrer=25000`, `coinsPerReferralReferee=5000` (same gotcha
  as `coinsPerShare`/`coinsPerRupee`).
- **Store-URL env** (`IOS_STORE_URL`, `ANDROID_STORE_URL`, `WEB_SIGNUP_URL`):
  placeholders until the apps are published — the store fallback isn't testable
  until then; installed-app + web paths are testable now.
- **App ships via EAS**, not a main merge. The `refer/:code` deep-link route
  needs an EAS rebuild to actually open the app; **manual entry covers the gap**
  until then.

## Follow-ups (out of scope for v1)

- IP+UA deferred autofill (auto-fill the code through an install) — add only if
  manual-entry conversion disappoints.
- Branch/Adjust SDK for bulletproof deferred attribution.
- Branded `/r` redirect domain fronting the backend.
- Real store URLs once the apps are listed.
- Velocity/abuse scoring on referral claims.
