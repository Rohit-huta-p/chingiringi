# Chingiringi — Manual Test Plan

Every flow, every screen, every scenario. Use this to manually verify the app end to end after a deploy or a fresh database reset. Each case lists a **precondition**, **steps**, and the **expected result**. The **Status** line records the result of the latest test run.

---

## Test run — 2026-07-16

**Environment:** frontend `localhost:8082` (Expo web) ↔ backend `localhost:8000` (MongoDB Atlas, live data) · desktop 1440×920 · accounts `admin@gmail.com` and `vcrohithuta@gmail.com` · driver: automated browser pass.

**Not covered this run:** native Expo Go, Safari, mobile layouts, and file‑picker uploads (the OS file dialog can't be driven from the in‑app browser). These are marked 🔵 or ⚪ below.

### Status legend (color codes)

| Badge | Meaning |
|---|---|
| 🟢 **PASS** | Verified working this run |
| 🔴 **FAIL / BUG** | Verified broken — details in §17 |
| 🟡 **PARTIAL** | Works with a caveat, or only partly exercised |
| 🔵 **SKIPPED** | Deliberately not run (destructive, mutates config, or not drivable here) |
| ⚪ **NOT TESTED** | Not exercised this run |

### Scoreboard

**≈30 🟢 PASS · 7 🟡 PARTIAL · 1 🔴 BUG · 6 🔵 SKIPPED · remainder ⚪ NOT TESTED.**
Headline: the **end‑to‑end money path (deal → click → report import → pending coins) works** and every admin/user core screen renders real data. One real bug and three UI/copy issues surfaced — all consolidated in **§17. Findings & issues**.

---

## 0. Test setup and data

Before testing, prepare the environment.

| Item | How |
|---|---|
| Backend | Running (local `npm run dev` in `backend/`, or the Render deploy). Confirm the dashboard/settings endpoints are live (they need a redeploy after backend changes). |
| Frontend | `npx expo start --web` for the browser, or reload Expo Go on the phone. |
| Admin account | One admin user exists (role `admin`). After a reset: **Rohit Hutagonna / admin@gmail.com**. |
| Clean slate | `npm run seed:test-flow -- <phone>` sets up two test deals + a click. Or `node src/scripts/resetToAdminOnly.js --confirm --include-content` to wipe to admin-only. |
| Cloudinary | Unsigned preset configured (`EXPO_PUBLIC_CLOUDINARY_*` in `.env`) so image uploads work. |
| Coin economy | Default settings: pass-through 25%, 10 coins = ₹1, 30-day lock. **⚠️ The live DB this run credited ×2.2 (pass‑through ≈22%), not 25% — see §17.2.** |

**Two surfaces to test:** the **mobile app** (Expo Go / narrow browser) and the **desktop web** (wide browser). Many screens have separate mobile/desktop layouts — test both where noted.

---

## 1. Authentication

### 1.1 Sign up (new user)
- **Pre:** Logged out. On the login screen.
- **Steps:** Tap "Sign up" → enter name, username, email, phone, password → submit.
- **Expected:** Account created, auto-logged-in, lands on Home. New user appears in Admin → Users.
- **Status:** ⚪ Not tested.

### 1.2 Login — username / password
- **Pre:** A user exists. Logged out.
- **Steps:** On login, keep "Username / Password" tab → enter username + password → Signin.
- **Expected:** Lands on Home. Wrong credentials show an inline error, not a crash.
- **Status:** 🟢 PASS — logged in as both admin and user multiple times; lands correctly (admin → dashboard, user → home). (Wrong‑credential path not exercised.)

### 1.3 Login — OTP
- **Pre:** A user with a phone exists.
- **Steps:** Switch to "OTP Login" tab → enter 10-digit mobile → Send OTP → enter OTP on the next screen → verify.
- **Expected:** OTP screen appears; correct OTP logs in. Invalid phone (< 10 digits) is blocked with a message.
- **Status:** 🔵 Skipped — OTP delivery not exercisable in this run. (The "OTP Login" tab is present on the login screen.)

### 1.4 Login on Safari
- **Pre:** Use Safari (desktop or iOS).
- **Steps:** Log in with valid credentials.
- **Expected:** Login succeeds AND subsequent screens load (wallet, profile) without 401s. (This is the Bearer-token fix — Safari ITP used to drop the cross-origin cookie.)
- **Status:** 🔵 Skipped — the in‑app browser is Chromium, not Safari. (Note: auth uses a Bearer token in `localStorage` **and** a rehydrating session cookie — see §17.8.)

### 1.5 Session persistence
- **Steps:** Log in → close/reopen the app (or refresh the browser tab).
- **Expected:** Still logged in, lands on Home without re-entering credentials.
- **Status:** 🟢 PASS — a full page reload (deep link to `/profile`) kept the session and resolved the route. Session also rehydrated from a cookie after `localStorage` tokens were cleared.

### 1.6 Forgot / reset password
- **Steps:** Login → "Forgot Password?" → enter identifier → follow reset flow.
- **Expected:** Reset flow completes; new password works on next login.
- **Status:** ⚪ Not tested. ("Forgot Password?" link is present.)

### 1.7 Logout
- **Steps:** Profile / Settings → Logout.
- **Expected:** Returns to login. Protected screens are no longer reachable; the old session 401s on its next request.
- **Status:** 🟢 PASS — user side shows a confirm dialog ("Are you sure…") then returns to login; admin side logs out immediately from the sidebar. Both land on the login screen.

### 1.8 Delete account
- **Pre:** Logged-in user. Mobile Settings screen.
- **Steps:** Settings → Delete Account → pick a reason → "Delete Forever".
- **Expected:** "Delete Forever" only enables after a reason is picked; the blue retention offer sits above the red warning. On confirm, account is removed and user is logged out.
- **Status:** 🔵 Skipped — destructive. The "Delete Account" button + Danger Zone copy are present in Settings; not triggered.

---

## 2. Home (user)

Test both the **mobile home** and the **desktop home** (wide browser).

### 2.1 Home loads
- **Pre:** Logged in.
- **Expected:** Greeting + name in the header, search bar, category chips, product grid / banners. No fake "Rahul Sharma" / template products.
- **Status:** 🟢 PASS — real product data (e.g. "Cricket Bat · ₹5,000 · 1,200 coins"), search bar, category chips, RH avatar. No mock names.

### 2.2 Categories are real
- **Pre:** Admin has added categories (Admin → Products → category picker).
- **Expected:** The category chips are **"All" + the real categories admin added** — not a hardcoded Fashion/Electronics/Beauty list. Adding a new category in admin makes it appear here after refresh.
- **Status:** 🟢 PASS — chips are **All / shoes / eletronic / bat**, the exact categories from the admin CategoryPicker. Confirmed the same set drives the admin deal form.

### 2.3 Category filter works
- **Steps:** Tap a category chip.
- **Expected:** Product grid filters to that category. The chip highlights. On desktop, the page scrolls to top. Tap "All" to clear.
- **Status:** ⚪ Not tested.

### 2.4 Search works
- **Steps:** Type a product name / keyword in the search box.
- **Expected:** Grid filters to matching products (by name or description) live. Clearing the box restores the full list.
- **Status:** ⚪ Not tested.

### 2.5 See all
- **Pre:** Desktop home, real products exist.
- **Steps:** Tap "See all" on a section (e.g. Top Electronics).
- **Expected:** Applies that section's category filter and scrolls to the top.
- **Status:** ⚪ Not tested. ("See all" links render on Home sections.)

### 2.6 Empty states
- **Pre:** Fresh DB (no products).
- **Expected:** No demo/template tiles. Sections show "No products yet." A search with no matches shows "No products match your search." "Shop by category" is hidden when there are no categories.
- **Status:** ⚪ Not tested — the DB has data, so the empty path wasn't reachable. (Other empty states verified — see §16.1.)

### 2.7 Pull to refresh
- **Steps:** Pull down at the top of the home.
- **Expected:** A spinner appears briefly and data refetches; the spinner never sticks.
- **Status:** ⚪ Not tested.

### 2.8 Open a product
- **Steps:** Tap any product card.
- **Expected:** Navigates to Product Detail with that product's data.
- **Status:** 🟡 Partial — product/deal cards render with correct data, but tapping a card did not fire navigation in the automated browser (RN‑web synthetic‑click quirk, §17.8). Needs a manual confirm on a real device.

---

## 3. Product detail → Shop Now (affiliate click)

### 3.1 Product detail renders
- **Expected:** Image, title, price, coins, description. Real data (or the passed product).
- **Status:** ⚪ Not tested — could not open the detail screen via web tap (see §2.8 / §17.8).

### 3.2 Shop Now logs a click
- **Pre:** The product is tied to a deal with an affiliate URL.
- **Steps:** Tap **Shop Now**.
- **Expected:** The app calls `POST /api/clicks/log`, then opens the **rewritten** URL (Cuelinks-wrapped or Amazon-tagged, with `subid=cr_<userId>`). A `ClickEvent` is created (visible later in Admin → Wallet Ops → Users → timeline). On failure it falls back to the raw URL.
- **Status:** 🟢 PASS — exercised the exact Shop‑Now call for the QA deal. `POST /api/clicks/log` → `{ clickId, redirectUrl: "https://amazon.in/qa-test-deal?ascsubtag=cr_6a523de8…" }`. Subid `cr_<userId>` correctly written as Amazon's `ascsubtag`. The ClickEvent appears on the admin user timeline ("Click · amazon · QA Test Deal") and the dashboard Total Clicks incremented 3→4.

---

## 4. Wallet (user)

Test **mobile wallet** and **desktop wallet**.

### 4.1 Balances are real
- **Expected:** No fake ₹1250 / 840 coins. A fresh account shows **0**. Cards: **Coins** (withdrawable), **Pending Coins** (locked), **Pending ₹**. Desktop "Available to Withdraw" = coins ÷ 10, matching the withdraw overlay.
- **Status:** 🟢 PASS — fresh account read **0** everywhere. Cards present: Available to Withdraw, **Pending Coins**, **Total Coins**, Total Earned. Lucide icons render. Coin‑consistent.

### 4.2 Transactions list
- **Expected:** Real transactions only. Empty account shows **"No transactions yet."** — no Myntra/Amazon mock rows. Filter chips (All / Cashback / Coins / Withdrawal) filter the list.
- **Status:** 🟢 PASS — empty state showed "No transactions yet."; after the import a real "amazon · Today" row appeared. Filter chips (All / Cashback / Coins / Withdrawals) present. (Filtering behavior itself not clicked through.)

### 4.3 Pending coins appear after an import
- **Pre:** Admin imported a report crediting this user (see §12).
- **Expected:** The **Pending Coins** card shows the credited amount right after import (pull to refresh). It moves to **Coins** only after the lock clears.
- **Status:** 🟢 PASS — after the report import the **Pending Coins** card went **0 → 440** ("In lock period · ≈ ₹44"); **Total Coins** stayed **0** (still locked). Exactly the intended lock behavior.

### 4.4 Withdraw funds overlay (desktop `/wallet`)
- **Steps:** Click **Withdraw Funds**.
- **Expected:** Overlay opens (Figma design): Available card + green check; **UPI / Bank / Paytm** segment; method input (UPI ID / account no. + IFSC for Bank / Paytm number); amount input with **₹100 / ₹500 / ₹1000** chips; Confirm button.
- **Status:** 🟡 Partial — the **Withdraw Funds** button renders, but with a ₹0 balance the click is a no‑op (correctly guards zero‑balance), so the overlay didn't open. Re‑test with a positive withdrawable balance.

### 4.5 Withdraw validation
- **Steps:** Try amounts below ₹100, above balance, and empty details.
- **Expected:** Below ₹100 → "Amount too low"; above balance → "Insufficient balance"; empty details → "Missing details"; Bank without IFSC → "Missing IFSC". Confirm is disabled until valid.
- **Status:** ⚪ Not tested (overlay not reachable at ₹0 balance).

### 4.6 Submit a withdrawal
- **Steps:** Enter a valid amount + UPI ID → Confirm.
- **Expected:** "Request submitted" and the request appears in Admin → Wallet Ops → Pending Queue and the user's timeline as a **pending withdrawal**. Coins are NOT debited yet (debit happens on admin approval).
- **Status:** ⚪ Not tested (no withdrawable balance yet — coins are still in the 30‑day lock).

---

## 5. Profile & edit profile (user)

### 5.1 Profile shows real data
- **Expected:** Real name/email/phone (empty rows hidden, not fake "Dev Chavan"). Wallet stat tiles reflect real balances. Referral count/earnings show real values (0 until referrals exist).
- **Status:** 🟢 PASS — "Rohit Hutagonna", **vcrohithuta@gmail.com**, phone **9673390378**, referral code **19C98013**, "Member since 2026". Balance tiles (Confirmed/Pending/Coins) coin‑consistent. Legal links present.

### 5.2 Edit profile — avatar upload
- **Steps:** Edit Profile → tap the avatar → pick a photo.
- **Expected (web):** File picker → uploads to Cloudinary → preview updates. **(native):** Photo-library permission prompt → picker → upload. Save → the new avatar shows on Profile AND everywhere the avatar appears (home header, etc.).
- **Status:** 🔵 Skipped — the OS file picker can't be driven from the in‑app browser.

### 5.3 Edit profile — fields
- **Steps:** Change name / other fields → Save.
- **Expected:** "Saved" and the values persist after navigating away and back.
- **Status:** ⚪ Not tested. (Edit Profile button present.)

### 5.4 Referral code
- **Steps:** Copy / Share the referral code.
- **Expected:** Copy works (web clipboard / native share sheet). Empty code doesn't crash.
- **Status:** ⚪ Not tested — code **19C98013** displays; copy/share not exercised.

### 5.5 Address management
- **Steps:** Profile → addresses → add / edit / delete an address.
- **Expected:** Empty list shows **"No addresses yet."** (no fake Mumbai addresses). Added addresses persist.
- **Status:** ⚪ Not tested. ("Manage Addresses" quick‑action present.)

---

## 6. Deals list (user)

### 6.1 Deals render
- **Expected:** With real deals: hero card, Trending Now, All Deals grid, Featured Picks. Cashback %, expiry, brand are real.
- **Status:** 🟢 PASS — hero ("Up to 5% cashback on shoes brands"), LIVE DEALS counter, Trending Now (Myntra 5%), All Deals grid, Featured Picks all render with real cashback/expiry/brand.

### 6.2 Empty state
- **Pre:** No deals.
- **Expected:** **No fake hero** ("Up to 20% cashback" / "Electronics Sale" are gone). The hero row is hidden; All Deals shows **"No deals yet · Deals you add will appear here."** Trending/Featured are hidden.
- **Status:** ⚪ Not tested — deals exist, so the empty path wasn't reachable.

### 6.3 Filter + search
- **Steps:** Pick a category chip / type in search.
- **Expected:** All Deals filters; no matches shows "No deals match your filter."
- **Status:** ⚪ Not tested.

### 6.4 Open a deal
- **Steps:** Tap a deal.
- **Expected:** Navigates to detail; Shop Now works (see §3.2).
- **Status:** 🟡 Partial — deal cards render with correct data (brand, cashback %, days‑to‑expiry), but tap‑to‑detail didn't fire in the automated browser (§17.8). The Shop‑Now network path itself is verified (§3.2).

### 6.5 Expired deals are hidden from users *(new)*
- **Pre:** A deal exists whose `expiresAt` is in the past.
- **Expected:** The user Deals list **excludes** expired deals; the admin Deals list still **lists** them (so admins can see/renew).
- **Status:** 🟢 PASS — admin listed **3–4** deals including "Headphone" (expired **15/07/2026**); the user Deals list showed only the non‑expired ones ("All Deals · 2 deals" before the QA deal). Expiry filter works. (See §17.7 for the stale Headphone date.)

---

## 7. Offline stores & videos (user)

### 7.1 Stores tab
- **Expected:** Lists stores from the local data set (mock — no backend yet). Search/filter works. *(Flagged: this is the only remaining mock feature.)*
- **Status:** ⚪ Not tested.

### 7.2 Videos tab
- **Expected:** The Videos section renders without crashing.
- **Status:** ⚪ Not tested.

---

## 8. Settings & About (user)

### 8.1 Settings
- **Expected:** Profile strip, notification toggles, security/privacy nav, About link, logout, delete-account button. Toggles flip and persist.
- **Status:** 🟢 PASS — notification toggles (Cashback Updates / Deal Alerts / Referral Updates / Email), Security & Privacy nav (Change Password, 2FA: Disabled, Linked Accounts), Logout, and the Danger Zone / Delete Account all render. (Toggle persistence not re‑checked across reload.)

### 8.2 About
- **Steps:** Settings → About.
- **Expected:** About screen renders with app info.
- **Status:** 🟡 Partial — the **About** link (plus Affiliate Partners, Terms, Help, Privacy) is present on the Profile screen; the About screen itself wasn't opened.

---

## 9. Admin — login & shell

### 9.1 Admin login
- **Pre:** Admin account.
- **Steps:** Log in as admin.
- **Expected:** Lands in the admin panel (mobile: stack with the shared blue nav; desktop: permanent sidebar drawer).
- **Status:** 🟢 PASS — lands in the desktop admin panel with the permanent sidebar.

### 9.2 Navigation is consistent
- **Expected (mobile):** The blue "Admin Panel" header + horizontal section nav (Dashboard · Deals · Wallet Ops · Payouts · Users · Products · Banners · Coupons) is identical on **every** admin screen. Tapping a tab switches sections; the active tab highlights.
- **Expected (desktop):** Left sidebar with the same sections, ending in **Logout** at the bottom. **No profile in the sidebar** — the profile (SA · Super Admin · email) is **top-right** in the content top bar.
- **Note:** "Conversions" is removed from the nav.
- **Status:** 🟢 PASS (desktop) — sidebar sections all route; profile is top‑right; Logout at the bottom; no "Conversions". Mobile nav not verified this run.

### 9.3 Open the admin profile
- **Steps (desktop):** Click the SA profile badge top-right. **(mobile):** Tap the avatar in the nav header.
- **Expected:** Opens the Admin Profile screen (§11).
- **Status:** 🟢 PASS — the top‑right SA badge opens the Admin Profile screen.

---

## 10. Admin — dashboard

### 10.1 Real stats
- **Pre:** Backend redeployed.
- **Expected:** Total Clicks, Conversions, Cashback Issued, Active Users, and the Coins Economy pills (Issued / Redeemed / Circulating) are **aggregated from the DB** — no 45,280 / 3,456 / 1.2M mock numbers. A fresh DB reads **zeros**. No fake "+12.5%" deltas.
- **Status:** 🟢 PASS — real aggregates: Total Clicks **3→4**, Conversions **1**, Cashback **₹15**, Active Users **0**; Coins Economy **100 issued / 10 redeemed / 90 circulating**. No mock numbers, no fake deltas.

### 10.2 Revenue Trend chart
- **Expected:** A smooth dual-line chart (Revenue + Conversions) over 30 days with a legend, grid, and axes. It **fills the full card width**. With no data it's flat at zero with a "No revenue yet" note. As conversions credit, the lines rise.
- **Status:** 🟢 PASS — dual‑line (Revenue + Conversions), legend/grid/axes, full card width, with a real spike near Jul 14–15.

### 10.3 Top deals / top users
- **Expected:** Real top deals (by click count) and top users (by lifetime earnings). No "Rahul Sharma / Myntra Fashion Sale" mock rows — empty states ("No deals with clicks yet." / "No user activity yet.") when there's no data.
- **Status:** 🟢 PASS — Top deal "Fashion" (real), Top user "Manvendra Singh Chauhan · ₹20" (real). No mock rows.

---

## 11. Admin — profile & Razorpay

### 11.1 Profile hero
- **Expected:** SA badge, name, email, role pill. Stats: Pending Payouts · Coins Issued · Active Users (live).
- **Status:** 🟢 PASS — hero with SA badge, name, email, role, and live stat tiles.

### 11.2 Payouts / Razorpay card
- **Expected:** Shows status **Not connected / Configured / Connected** based on saved keys, plus pending payout total and request count.
- **Status:** 🟢 PASS — Razorpay/payouts card renders with a status and payout totals.

### 11.3 Configure Razorpay
- **Steps:** Tap "Configure Razorpay" → enter Key ID, Key Secret, RazorpayX account, toggle enable → Save.
- **Expected:** Saved. The secret is **write-only** — reopening shows a masked `••••••••1234`, never the raw value. Leaving the secret blank on re-save keeps the stored one. Status flips to Configured/Connected.
- **Status:** 🔵 Skipped — saving would mutate live payment config. The Configure form opens; not submitted.

### 11.4 Quick actions
- **Steps:** Tap Wallet Operations / Coin Economy Settings / Manage Users / Manage Deals.
- **Expected:** Each navigates to the right admin section.
- **Status:** 🟢 PASS — quick actions navigate to the correct admin sections.

---

## 12. Admin — Wallet Operations Hub

The core admin workflow. Four tabs.

### 12.1 Pending Queue
- **Expected:** Three counters — **Withdrawals waiting**, **Ready to confirm** (lock expired), **Recent imports**. A list of pending withdrawals with an **Open** button that jumps to the user's timeline.
- **Status:** 🟢 PASS — three counters (0 / 0 / 0) + correct empty states ("No pending withdrawals 🎉", "No reports imported yet").

### 12.2 Reports Inbox — parse
- **Steps:** Pick a merchant chip (e.g. Cuelinks) → paste a CSV → **Parse Report**.
- **Expected:** Auto-detects columns; preview shows each row with a **green "subid ✓"** or yellow "unmatched", plus an estimated coins-per-row using the live pass-through formula.
- **Status:** 🟢 PASS — Amazon chip selected, pasted CSV, Parse produced a preview: **Total 1 · Will match 1 · Unmatched 0 · ~coins 440**, row badge **SUBID** (green). Column auto‑detect worked.

**Sample CSV (Cuelinks):**
```
order_id,subid,amount,commission,status
MYN-9X8B,cr_<userId>,2799,179.14,confirmed
```

**CSV actually used this run (Amazon):**
```
order_id,subid,amount,commission,status
QA-TEST-001,cr_6a523de8e0921e3355021104,1000,200,confirmed
```

### 12.3 Reports Inbox — import credits coins
- **Steps:** Click **Import**.
- **Expected:** For each matched row, coins = `commission × passThrough × coinsPerRupee` (or the deal's `coinsReward` override). A pending `coin_credit` transaction is created and added to the user's **pendingCoins**. Success card shows totals; the import appears in history.
- **Status:** 🟡 Partial — the credit **works**: **+440 pending coins** landed on the user (commission ₹200 × ~2.2), a `coin_credit` transaction was created, and it shows on the user wallet + admin timeline. **BUT** on this deal‑linked (subid+click) match the import returned **no success card and created no "Past imports" entry** → 🔴 **BUG, see §17.1**. The credit is real; the confirmation/audit is missing.

### 12.4 Attribution scenarios
| Row | subid | Expected | Status |
|---|---|---|---|
| Valid | `cr_<validUserId>` | Matched (100% confidence), coins credited | 🟢 PASS — matched via SUBID, +440 credited |
| Empty | *(blank)* | Fallback: if exactly one user clicked this merchant in 48h → credited (70%); else `no_subid_match` | ⚪ Not tested |
| Anonymous | `cr_anon_x` | `no_subid_match` | ⚪ Not tested |
| Bad user | `cr_<nonexistent id>` | `user_not_found` | ⚪ Not tested |
| Zero commission | commission `0` | `zero_commission` (failed) | ⚪ Not tested |
| Duplicate order | repeat of an imported orderId | `duplicate` (failed, no double credit) | 🟢 PASS — re‑importing `QA-TEST-001` was rejected ("1 failed — duplicate"); **no double credit** |

### 12.5 User Wallet tab
- **Steps:** Search a user → open.
- **Expected:** Identity card + 4 stat tiles (Confirmed ₹ / Pending ₹ / Coins / Lifetime). Buttons: **Credit / Debit Coins** and **Credit / Debit ₹**. On mobile the search and detail stack (with a "← Back to search"); on desktop they're side-by-side.
- **Status:** 🟢 PASS — search (2+ chars) returned real users; opening one shows the identity card, 4 tiles (Confirmed/Pending/Coins/Lifetime), and Credit/Debit Coins + Credit/Debit ₹ buttons. ⚠️ The 4 tiles read **COINS 0 / PENDING ₹0** even though the timeline shows **+440 pending** — pending coins aren't surfaced in the tiles (§17.4).

### 12.6 Manual credit / debit
- **Steps:** Credit Coins → enter amount + reason.
- **Expected (native):** A prompt modal appears (not a web `window.prompt`). The user's coin balance updates; a transaction lands on the timeline.
- **Status:** ⚪ Not tested — buttons present; not triggered.

### 12.7 Approve / reject a withdrawal
- **Pre:** The user has a pending withdrawal.
- **Steps:** In the user detail, "Approve & Pay" → paste UPI TXN id. Or "Reject".
- **Expected:** Approve debits the user's coins and marks the withdrawal **completed**; Reject leaves coins untouched. The Pending Queue count drops.
- **Status:** ⚪ Not tested — no pending withdrawal existed (coins still locked).

### 12.8 Timeline
- **Expected:** Interleaved clicks + transactions, newest first, color-coded by status.
- **Status:** 🟢 PASS — the user timeline interleaves newest‑first: "Amazon reward · order QA‑TEST‑001 · PENDING · +440 · 3m ago" above "Click · amazon · QA Test Deal · 12m ago".

### 12.9 Settings tab
- **Steps:** Change pass-through %, coins per ₹1, lock days, Cuelinks publisher ID, Amazon associate tag → Save.
- **Expected:** Live preview recalculates as you type. Saving affects **new** credits/withdrawals only. On mobile, fields stack vertically.
- **Status:** ⚪ Not tested — but the **live config differs from the documented default**: a ₹200 commission credited 440 coins → effective ×2.2 (pass‑through ≈22%, not 25%). See §17.2.

---

## 13. Admin — content management

### 13.1 Deals CRUD
- **Steps:** Deals → New → fill title, brand, category, cashback %, **Coins Reward** (optional), **Via Cuelinks** toggle, affiliate URL, expiry → Save. Then edit and delete one.
- **Expected:** Deal appears in the list and on the user Deals screen. Empty list shows an empty state (no mock deals).
- **Status:** 🟢 PASS (create) — created **"QA Test Deal — Cricket Gear"** (Amazon, 12%, category "bat", expiry 2027‑12‑31). Total Deals **3→4** (list auto‑refetched). Verified the **CategoryPicker name→id bridge**: picking "bat" resolved to its ObjectId and the backend (which *requires* a valid category ObjectId) accepted it. The deal propagated to the **user** side (new "bat Sale — 12% cashback" banner; LIVE DEALS 2+→3+; "534 days" expiry). Edit/delete not exercised.

### 13.2 Products CRUD + category picker
- **Steps:** Products → New → fill fields, upload an image, use the inline **category picker** (search / create-on-the-fly / rename / delete) → Save.
- **Expected:** Product appears on the user Home; new categories appear as Home filter chips. Image upload works (web file picker / native photo picker).
- **Status:** ⚪ Not tested (products form) — but the **shared CategoryPicker** it uses was verified via §13.1: it loads real categories (shoes/eletronic/bat) with search + create‑on‑the‑fly + rename + delete controls.

### 13.3 Banners CRUD
- **Steps:** Banners → New → pick a **slot** (hero / flash-strip / dual / earn-coins / refer-earn / inline) → upload image or set gradient + badges + CTA + link → Save.
- **Expected:** Banner shows in the matching slot on the user Home (image if uploaded, gradient fallback otherwise). Empty list shows an empty state.
- **Status:** ⚪ Not tested — though a **category‑driven "bat Sale" banner auto‑appeared** on the user Deals screen after the QA deal was created.

### 13.4 Coupons CRUD + usage
- **Steps:** Coupons → New → code, discount type/value, min order, usage limits, expiry → Save. Toggle active/inactive. View usage.
- **Expected:** Coupon card shows status (Active/Inactive/Expired) + usage progress. Empty list shows an empty state.
- **Status:** ⚪ Not tested.

### 13.5 Image upload (all forms)
- **Expected:** **Web** → click to upload → Cloudinary → URL returned. **Native** → tap → photo library → upload. "Paste an image URL" fallback works on both. Uploading shows a spinner; success shows the preview.
- **Status:** 🔵 Skipped — the OS file dialog can't be driven from the in‑app browser. (The "Click to upload an image · PNG, JPG, WEBP up to 10 MB" dropzone renders in the deal form.)

---

## 14. Admin — users & payouts

### 14.1 Users list
- **Expected:** Real users only (no "Rahul Sharma" mock). Empty → "No users yet." Search by name/phone/email.
- **Status:** 🟡 Partial — via the Wallet Ops → User Wallet search, real users returned (two "Rohit Hutagonna", phones 9673390378 and 2222222222). The dedicated **Users** screen wasn't opened.

### 14.2 Block / unblock
- **Steps:** Block a user → unblock.
- **Expected:** Status flips; a blocked user can't act (verify on the user side if feasible).
- **Status:** ⚪ Not tested.

### 14.3 Payouts screen
- **Expected:** Real withdrawal requests (no mock payouts). Empty → "No withdrawal requests yet." Process / complete / reject actions work and reflect on the user's wallet.
- **Status:** ⚪ Not tested — Pending Queue showed no withdrawals; the dedicated Payouts screen wasn't opened.

---

## 15. End-to-end affiliate flow (the money path)

The full arc, one pass. Use `npm run seed:test-flow -- <phone> --with-click` to pre-stage, or do it all manually.

1. **Admin adds a deal** (Cuelinks or Amazon) with an affiliate URL. *(§13.1)*
2. **User taps Shop Now** on that deal → click logged with `subid=cr_<userId>`, rewritten URL opens. *(§3.2)*
3. **User buys** on the merchant (external). Merchant reports the commission days later.
4. **Admin pastes the merchant CSV** into Reports Inbox → Parse → Import. *(§12.2–12.3)*
5. **Coins credited to pendingCoins** — the user sees **+N pending coins** in the wallet. *(§4.3)*
6. **Lock expires** → run `npm run cron:confirm-locks` (add `--force` to skip the wait for testing) → pending coins move to **withdrawable coins**, transaction flips to confirmed.
7. **User requests a withdrawal** from the wallet. *(§4.6)*
8. **Admin approves & pays** in Wallet Ops → coins debited, marked completed. *(§12.7)*

**Expected:** Numbers reconcile at every step — `commission × 0.25 × 10` coins credited, `coins ÷ 10` ₹ paid out. No coins are withdrawable until the lock clears.

- **Status:** 🟡 Partial — **steps 1–5 PASS end to end** on 2026‑07‑16:
  - **1)** Created "QA Test Deal — Cricket Gear" (Amazon). ✅
  - **2)** Logged the click → `subid=cr_6a523de8…` written as `ascsubtag`; ClickEvent created. ✅
  - **4)** Pasted the Amazon CSV → Parse → Import. ✅
  - **5)** **+440 pending coins** credited and visible on the user's Pending Coins card ("≈ ₹44, in lock period") and the admin timeline. ✅
  - **Steps 6–8 (lock‑confirm → withdraw → approve/pay) ⚪ not run.**
  - **Reconciliation note:** the doc predicts `200 × 0.25 × 10 = 500`; the live config credited **440** (`200 × ~2.2`). The internal preview and actual both said 440 (self‑consistent), but the **live pass‑through is ≈22%, not the documented 25%** — reconcile intended config (§17.2). No coins were withdrawable (correctly still locked).

---

## 16. Cross-cutting checks

### 16.1 Empty states everywhere
- **Pre:** Fresh admin-only DB.
- **Expected:** Every list (home, deals, wallet, users, withdrawals, coupons, banners, top deals/users) shows an honest empty state — **never fake data**. Dashboard stats read zero.
- **Status:** 🟢 PASS (observed) — honest empty states seen across the run: "No transactions yet.", "No pending withdrawals 🎉", "No reports imported yet", fresh wallet at 0, and no mock rows on the dashboard. (Not every list forced to empty, since the DB has data.)

### 16.2 Responsive layout
- **Steps:** Resize the browser (narrow ↔ wide) and test on the phone.
- **Expected:** Mobile screens use the stacked layouts; desktop uses side-by-side / sidebar. The revenue chart, wallet ops tabs, and settings adapt.
- **Status:** ⚪ Not tested — only desktop 1440×920 was exercised.

### 16.3 API failure handling
- **Steps:** Stop the backend, then open the wallet / dashboard.
- **Expected:** No fake fallback data appears — screens show zeros / empty states or a clear loading/error, not mock balances.
- **Status:** ⚪ Not tested.

### 16.4 Auth boundaries
- **Steps:** As a non-admin, try to reach `/admin`.
- **Expected:** Admin screens are not served to non-admin roles.
- **Status:** ⚪ Not tested. (Backend enforces `protect + admin` on the deal‑create and report‑import routes — verified by code inspection, not by driving a non‑admin.)

---

## 17. Findings & issues (from the 2026-07-16 run) *(new)*

Consolidated issues discovered while running the flows above. Ranked by severity.

### 17.1 🔴 BUG — Report import isn't atomic; no success confirmation/audit on a deal-linked match
- **What happens:** Importing a report row that matches by subid **and** has a recent deal‑linked click credits the coins (wallet `pendingCoins` += N and a `coin_credit` transaction are written), but the **`ReportImport` audit document fails to save**, so the admin sees **no success card and no "Past imports" entry**.
- **Root cause (from code trace):** the controller sets `row.matchedVia = 'subid+click'` (or `'click_log_fallback'`), which is **not in the `ReportImport` schema enum** `['subid','click_log','manual','none']`. The audit `create()` throws a Mongoose `ValidationError` **after** the wallet/transaction writes already committed. So coins land, but the write is non‑atomic and the admin gets no confirmation/audit trail.
- **Evidence:** the first Import credited **+440** (visible on the user wallet + admin timeline) yet produced no "Past imports" row; the accidental re‑import was then correctly **deduped** ("1 failed — duplicate").
- **Impact:** silent success — credited without confirmation/audit. No double‑credit (dedup protects that), but reconciliation/audit is broken.
- **Fix:** add `'subid+click'` / `'click_log_fallback'` to the `matchedVia` enum, **and/or** wrap the wallet credit + transaction + audit write in a single transaction so they commit or roll back together.

### 17.2 🟡 ISSUE — Coin formula: live config and UI copy disagree
- The Reports Inbox help text says **"commission × 10 coins"**; the doc §0 default says **pass‑through 25%** (→ ×2.5). The **live credit was 440 for ₹200 → effective ×2.2 (pass‑through ≈22%)**.
- Three sources, three numbers. Confirm the intended pass‑through and fix the help copy (it omits the pass‑through factor entirely).

### 17.3 🟡 ISSUE — Currency symbol on a coin amount
- The wallet **transaction row** shows **"+₹440"** while the **Pending Coins card** correctly shows **"440 coins ≈ ₹44"**. The transaction row should read coins (e.g. "+440 coins") or the rupee value ("+₹44"), not "₹440".

### 17.4 🟡 ISSUE — Admin User‑Wallet tiles don't surface pending coins
- The four summary tiles read **COINS 0 / PENDING ₹0** even when the timeline shows **+440 pending coins**. Pending coins aren't reflected in any tile (the "PENDING" tile is rupees‑only). Add a pending‑coins figure to the admin view.

### 17.5 🟢 GOOD — Duplicate‑order dedup works
- Re‑importing the same `orderId` for a merchant is rejected as a duplicate — **no double credit**. (See §12.4.)

### 17.6 🟢 GOOD — Category name→id bridge works
- The admin deal form's shared **CategoryPicker** emits a category **name**, resolves it to the ObjectId on submit, and the backend (which requires a valid category ObjectId) accepts it. Same categories drive the user Home/Deals chips.

### 17.7 🟡 DATA — Stale test deal
- The "Headphone" deal expired **15/07/2026** (a day before this run), so it's correctly hidden from users but still shows to admin. Bump its expiry if it should remain visible.

### 17.8 ℹ️ ENV NOTES (automation, not necessarily product bugs)
- **Deep links** on web require a full reload (Metro re‑bundle); after that, routing works and the session persists.
- **Auth** persists via a Bearer token in `localStorage` **and** a session cookie — clearing `localStorage` alone did not log out; the cookie rehydrated the session.
- **Tapping deal/product cards** in the in‑app browser sometimes didn't fire the RN‑web `onPress` (synthetic‑click quirk). This blocked opening the Product/Deal detail screens (§2.8, §3.1, §6.4) — confirm on a real device / Expo Go before treating as a product bug.

### 17.9 🧹 Test data left behind (throwaway)
- Deal **"QA Test Deal — Cricket Gear"** (Amazon, labeled "safe to delete").
- 1 ClickEvent + a **440 pending‑coin** credit on `vcrohithuta@gmail.com` (order `QA-TEST-001`).
- To clean up: delete the QA deal (trash icon) and reverse the credit via Wallet Ops → User Wallet → **Debit Coins**. Or run `npm run cron:confirm-locks -- --force` to convert the pending coins and continue the E2E (steps 6–8).

---

## Sign-off

| Area | Status | Notes |
|---|---|---|
| Authentication | 🟡 | Login/logout/session ✅; sign‑up, OTP, Safari, forgot, delete ⚪/🔵 |
| Home + search + filters | 🟡 | Loads + real dynamic categories ✅; filter/search/open‑product ⚪ |
| Product detail + Shop Now | 🟡 | Click log + subid rewrite ✅ (§3.2); detail screen ⚪ (§17.8) |
| Wallet + withdraw | 🟡 | Balances, txns, pending‑coins credit ✅; withdraw overlay/submit ⚪ |
| Profile + edit + avatar | 🟢 | Real data ✅; edit/avatar ⚪/🔵 |
| Deals list | 🟢 | Renders + expiry filter ✅; open‑deal tap ⚪ (§17.8) |
| Admin shell + dashboard | 🟢 | Shell, nav, real dashboard + chart ✅ |
| Admin profile + Razorpay | 🟢 | Profile + Razorpay card ✅; configure 🔵 |
| Wallet Operations Hub | 🟡 | Parse, import‑credit, timeline, user wallet ✅; **import audit bug** 🔴 (§17.1) |
| Content CRUD + image upload | 🟡 | Deal create + category picker ✅; products/banners/coupons ⚪; upload 🔵 |
| Users + payouts | ⚪ | Real users seen via Wallet Ops search; dedicated screens ⚪ |
| End-to-end affiliate flow | 🟡 | Steps 1–5 (deal→click→import→pending coins) ✅; lock/withdraw/approve ⚪ |
| Empty states + responsive | 🟡 | Empty states ✅; responsive/API‑failure/auth‑boundary ⚪ |
