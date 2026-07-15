# Chingiringi — Manual Test Plan

Every flow, every screen, every scenario. Use this to manually verify the app end to end after a deploy or a fresh database reset. Each case lists a **precondition**, **steps**, and the **expected result**. Check the box when it passes.

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
| Coin economy | Default settings: pass-through 25%, 10 coins = ₹1, 30-day lock. |

**Two surfaces to test:** the **mobile app** (Expo Go / narrow browser) and the **desktop web** (wide browser). Many screens have separate mobile/desktop layouts — test both where noted.

---

## 1. Authentication

### 1.1 Sign up (new user)
- **Pre:** Logged out. On the login screen.
- **Steps:** Tap "Sign up" → enter name, username, email, phone, password → submit.
- **Expected:** Account created, auto-logged-in, lands on Home. New user appears in Admin → Users.

### 1.2 Login — username / password
- **Pre:** A user exists. Logged out.
- **Steps:** On login, keep "Username / Password" tab → enter username + password → Signin.
- **Expected:** Lands on Home. Wrong credentials show an inline error, not a crash.

### 1.3 Login — OTP
- **Pre:** A user with a phone exists.
- **Steps:** Switch to "OTP Login" tab → enter 10-digit mobile → Send OTP → enter OTP on the next screen → verify.
- **Expected:** OTP screen appears; correct OTP logs in. Invalid phone (< 10 digits) is blocked with a message.

### 1.4 Login on Safari
- **Pre:** Use Safari (desktop or iOS).
- **Steps:** Log in with valid credentials.
- **Expected:** Login succeeds AND subsequent screens load (wallet, profile) without 401s. (This is the Bearer-token fix — Safari ITP used to drop the cross-origin cookie.)

### 1.5 Session persistence
- **Steps:** Log in → close/reopen the app (or refresh the browser tab).
- **Expected:** Still logged in, lands on Home without re-entering credentials.

### 1.6 Forgot / reset password
- **Steps:** Login → "Forgot Password?" → enter identifier → follow reset flow.
- **Expected:** Reset flow completes; new password works on next login.

### 1.7 Logout
- **Steps:** Profile / Settings → Logout.
- **Expected:** Returns to login. Protected screens are no longer reachable; the old session 401s on its next request.

### 1.8 Delete account
- **Pre:** Logged-in user. Mobile Settings screen.
- **Steps:** Settings → Delete Account → pick a reason → "Delete Forever".
- **Expected:** "Delete Forever" only enables after a reason is picked; the blue retention offer sits above the red warning. On confirm, account is removed and user is logged out.

---

## 2. Home (user)

Test both the **mobile home** and the **desktop home** (wide browser).

### 2.1 Home loads
- **Pre:** Logged in.
- **Expected:** Greeting + name in the header, search bar, category chips, product grid / banners. No fake "Rahul Sharma" / template products.

### 2.2 Categories are real
- **Pre:** Admin has added categories (Admin → Products → category picker).
- **Expected:** The category chips are **"All" + the real categories admin added** — not a hardcoded Fashion/Electronics/Beauty list. Adding a new category in admin makes it appear here after refresh.

### 2.3 Category filter works
- **Steps:** Tap a category chip.
- **Expected:** Product grid filters to that category. The chip highlights. On desktop, the page scrolls to top. Tap "All" to clear.

### 2.4 Search works
- **Steps:** Type a product name / keyword in the search box.
- **Expected:** Grid filters to matching products (by name or description) live. Clearing the box restores the full list.

### 2.5 See all
- **Pre:** Desktop home, real products exist.
- **Steps:** Tap "See all" on a section (e.g. Top Electronics).
- **Expected:** Applies that section's category filter and scrolls to the top.

### 2.6 Empty states
- **Pre:** Fresh DB (no products).
- **Expected:** No demo/template tiles. Sections show "No products yet." A search with no matches shows "No products match your search." "Shop by category" is hidden when there are no categories.

### 2.7 Pull to refresh
- **Steps:** Pull down at the top of the home.
- **Expected:** A spinner appears briefly and data refetches; the spinner never sticks.

### 2.8 Open a product
- **Steps:** Tap any product card.
- **Expected:** Navigates to Product Detail with that product's data.

---

## 3. Product detail → Shop Now (affiliate click)

### 3.1 Product detail renders
- **Expected:** Image, title, price, coins, description. Real data (or the passed product).

### 3.2 Shop Now logs a click
- **Pre:** The product is tied to a deal with an affiliate URL.
- **Steps:** Tap **Shop Now**.
- **Expected:** The app calls `POST /api/clicks/log`, then opens the **rewritten** URL (Cuelinks-wrapped or Amazon-tagged, with `subid=cr_<userId>`). A `ClickEvent` is created (visible later in Admin → Wallet Ops → Users → timeline). On failure it falls back to the raw URL.

---

## 4. Wallet (user)

Test **mobile wallet** and **desktop wallet**.

### 4.1 Balances are real
- **Expected:** No fake ₹1250 / 840 coins. A fresh account shows **0**. Cards: **Coins** (withdrawable), **Pending Coins** (locked), **Pending ₹**. Desktop "Available to Withdraw" = coins ÷ 10, matching the withdraw overlay.

### 4.2 Transactions list
- **Expected:** Real transactions only. Empty account shows **"No transactions yet."** — no Myntra/Amazon mock rows. Filter chips (All / Cashback / Coins / Withdrawal) filter the list.

### 4.3 Pending coins appear after an import
- **Pre:** Admin imported a report crediting this user (see §12).
- **Expected:** The **Pending Coins** card shows the credited amount right after import (pull to refresh). It moves to **Coins** only after the lock clears.

### 4.4 Withdraw funds overlay (desktop `/wallet`)
- **Steps:** Click **Withdraw Funds**.
- **Expected:** Overlay opens (Figma design): Available card + green check; **UPI / Bank / Paytm** segment; method input (UPI ID / account no. + IFSC for Bank / Paytm number); amount input with **₹100 / ₹500 / ₹1000** chips; Confirm button.

### 4.5 Withdraw validation
- **Steps:** Try amounts below ₹100, above balance, and empty details.
- **Expected:** Below ₹100 → "Amount too low"; above balance → "Insufficient balance"; empty details → "Missing details"; Bank without IFSC → "Missing IFSC". Confirm is disabled until valid.

### 4.6 Submit a withdrawal
- **Steps:** Enter a valid amount + UPI ID → Confirm.
- **Expected:** "Request submitted" and the request appears in Admin → Wallet Ops → Pending Queue and the user's timeline as a **pending withdrawal**. Coins are NOT debited yet (debit happens on admin approval).

---

## 5. Profile & edit profile (user)

### 5.1 Profile shows real data
- **Expected:** Real name/email/phone (empty rows hidden, not fake "Dev Chavan"). Wallet stat tiles reflect real balances. Referral count/earnings show real values (0 until referrals exist).

### 5.2 Edit profile — avatar upload
- **Steps:** Edit Profile → tap the avatar → pick a photo.
- **Expected (web):** File picker → uploads to Cloudinary → preview updates. **(native):** Photo-library permission prompt → picker → upload. Save → the new avatar shows on Profile AND everywhere the avatar appears (home header, etc.).

### 5.3 Edit profile — fields
- **Steps:** Change name / other fields → Save.
- **Expected:** "Saved" and the values persist after navigating away and back.

### 5.4 Referral code
- **Steps:** Copy / Share the referral code.
- **Expected:** Copy works (web clipboard / native share sheet). Empty code doesn't crash.

### 5.5 Address management
- **Steps:** Profile → addresses → add / edit / delete an address.
- **Expected:** Empty list shows **"No addresses yet."** (no fake Mumbai addresses). Added addresses persist.

---

## 6. Deals list (user)

### 6.1 Deals render
- **Expected:** With real deals: hero card, Trending Now, All Deals grid, Featured Picks. Cashback %, expiry, brand are real.

### 6.2 Empty state
- **Pre:** No deals.
- **Expected:** **No fake hero** ("Up to 20% cashback" / "Electronics Sale" are gone). The hero row is hidden; All Deals shows **"No deals yet · Deals you add will appear here."** Trending/Featured are hidden.

### 6.3 Filter + search
- **Steps:** Pick a category chip / type in search.
- **Expected:** All Deals filters; no matches shows "No deals match your filter."

### 6.4 Open a deal
- **Steps:** Tap a deal.
- **Expected:** Navigates to detail; Shop Now works (see §3.2).

---

## 7. Offline stores & videos (user)

### 7.1 Stores tab
- **Expected:** Lists stores from the local data set (mock — no backend yet). Search/filter works. *(Flagged: this is the only remaining mock feature.)*

### 7.2 Videos tab
- **Expected:** The Videos section renders without crashing.

---

## 8. Settings & About (user)

### 8.1 Settings
- **Expected:** Profile strip, notification toggles, security/privacy nav, About link, logout, delete-account button. Toggles flip and persist.

### 8.2 About
- **Steps:** Settings → About.
- **Expected:** About screen renders with app info.

---

## 9. Admin — login & shell

### 9.1 Admin login
- **Pre:** Admin account.
- **Steps:** Log in as admin.
- **Expected:** Lands in the admin panel (mobile: stack with the shared blue nav; desktop: permanent sidebar drawer).

### 9.2 Navigation is consistent
- **Expected (mobile):** The blue "Admin Panel" header + horizontal section nav (Dashboard · Deals · Wallet Ops · Payouts · Users · Products · Banners · Coupons) is identical on **every** admin screen. Tapping a tab switches sections; the active tab highlights.
- **Expected (desktop):** Left sidebar with the same sections, ending in **Logout** at the bottom. **No profile in the sidebar** — the profile (SA · Super Admin · email) is **top-right** in the content top bar.
- **Note:** "Conversions" is removed from the nav.

### 9.3 Open the admin profile
- **Steps (desktop):** Click the SA profile badge top-right. **(mobile):** Tap the avatar in the nav header.
- **Expected:** Opens the Admin Profile screen (§11).

---

## 10. Admin — dashboard

### 10.1 Real stats
- **Pre:** Backend redeployed.
- **Expected:** Total Clicks, Conversions, Cashback Issued, Active Users, and the Coins Economy pills (Issued / Redeemed / Circulating) are **aggregated from the DB** — no 45,280 / 3,456 / 1.2M mock numbers. A fresh DB reads **zeros**. No fake "+12.5%" deltas.

### 10.2 Revenue Trend chart
- **Expected:** A smooth dual-line chart (Revenue + Conversions) over 30 days with a legend, grid, and axes. It **fills the full card width**. With no data it's flat at zero with a "No revenue yet" note. As conversions credit, the lines rise.

### 10.3 Top deals / top users
- **Expected:** Real top deals (by click count) and top users (by lifetime earnings). No "Rahul Sharma / Myntra Fashion Sale" mock rows — empty states ("No deals with clicks yet." / "No user activity yet.") when there's no data.

---

## 11. Admin — profile & Razorpay

### 11.1 Profile hero
- **Expected:** SA badge, name, email, role pill. Stats: Pending Payouts · Coins Issued · Active Users (live).

### 11.2 Payouts / Razorpay card
- **Expected:** Shows status **Not connected / Configured / Connected** based on saved keys, plus pending payout total and request count.

### 11.3 Configure Razorpay
- **Steps:** Tap "Configure Razorpay" → enter Key ID, Key Secret, RazorpayX account, toggle enable → Save.
- **Expected:** Saved. The secret is **write-only** — reopening shows a masked `••••••••1234`, never the raw value. Leaving the secret blank on re-save keeps the stored one. Status flips to Configured/Connected.

### 11.4 Quick actions
- **Steps:** Tap Wallet Operations / Coin Economy Settings / Manage Users / Manage Deals.
- **Expected:** Each navigates to the right admin section.

---

## 12. Admin — Wallet Operations Hub

The core admin workflow. Four tabs.

### 12.1 Pending Queue
- **Expected:** Three counters — **Withdrawals waiting**, **Ready to confirm** (lock expired), **Recent imports**. A list of pending withdrawals with an **Open** button that jumps to the user's timeline.

### 12.2 Reports Inbox — parse
- **Steps:** Pick a merchant chip (e.g. Cuelinks) → paste a CSV → **Parse Report**.
- **Expected:** Auto-detects columns; preview shows each row with a **green "subid ✓"** or yellow "unmatched", plus an estimated coins-per-row using the live pass-through formula.

**Sample CSV (Cuelinks):**
```
order_id,subid,amount,commission,status
MYN-9X8B,cr_<userId>,2799,179.14,confirmed
```

### 12.3 Reports Inbox — import credits coins
- **Steps:** Click **Import**.
- **Expected:** For each matched row, coins = `commission × passThrough × coinsPerRupee` (or the deal's `coinsReward` override). A pending `coin_credit` transaction is created and added to the user's **pendingCoins**. Success card shows totals; the import appears in history.

### 12.4 Attribution scenarios
| Row | subid | Expected |
|---|---|---|
| Valid | `cr_<validUserId>` | Matched (100% confidence), coins credited |
| Empty | *(blank)* | Fallback: if exactly one user clicked this merchant in 48h → credited (70%); else `no_subid_match` |
| Anonymous | `cr_anon_x` | `no_subid_match` |
| Bad user | `cr_<nonexistent id>` | `user_not_found` |
| Zero commission | commission `0` | `zero_commission` (failed) |
| Duplicate order | repeat of an imported orderId | `duplicate` (failed, no double credit) |

### 12.5 User Wallet tab
- **Steps:** Search a user → open.
- **Expected:** Identity card + 4 stat tiles (Confirmed ₹ / Pending ₹ / Coins / Lifetime). Buttons: **Credit / Debit Coins** and **Credit / Debit ₹**. On mobile the search and detail stack (with a "← Back to search"); on desktop they're side-by-side.

### 12.6 Manual credit / debit
- **Steps:** Credit Coins → enter amount + reason.
- **Expected (native):** A prompt modal appears (not a web `window.prompt`). The user's coin balance updates; a transaction lands on the timeline.

### 12.7 Approve / reject a withdrawal
- **Pre:** The user has a pending withdrawal.
- **Steps:** In the user detail, "Approve & Pay" → paste UPI TXN id. Or "Reject".
- **Expected:** Approve debits the user's coins and marks the withdrawal **completed**; Reject leaves coins untouched. The Pending Queue count drops.

### 12.8 Timeline
- **Expected:** Interleaved clicks + transactions, newest first, color-coded by status.

### 12.9 Settings tab
- **Steps:** Change pass-through %, coins per ₹1, lock days, Cuelinks publisher ID, Amazon associate tag → Save.
- **Expected:** Live preview recalculates as you type. Saving affects **new** credits/withdrawals only. On mobile, fields stack vertically.

---

## 13. Admin — content management

### 13.1 Deals CRUD
- **Steps:** Deals → New → fill title, brand, category, cashback %, **Coins Reward** (optional), **Via Cuelinks** toggle, affiliate URL, expiry → Save. Then edit and delete one.
- **Expected:** Deal appears in the list and on the user Deals screen. Empty list shows an empty state (no mock deals).

### 13.2 Products CRUD + category picker
- **Steps:** Products → New → fill fields, upload an image, use the inline **category picker** (search / create-on-the-fly / rename / delete) → Save.
- **Expected:** Product appears on the user Home; new categories appear as Home filter chips. Image upload works (web file picker / native photo picker).

### 13.3 Banners CRUD
- **Steps:** Banners → New → pick a **slot** (hero / flash-strip / dual / earn-coins / refer-earn / inline) → upload image or set gradient + badges + CTA + link → Save.
- **Expected:** Banner shows in the matching slot on the user Home (image if uploaded, gradient fallback otherwise). Empty list shows an empty state.

### 13.4 Coupons CRUD + usage
- **Steps:** Coupons → New → code, discount type/value, min order, usage limits, expiry → Save. Toggle active/inactive. View usage.
- **Expected:** Coupon card shows status (Active/Inactive/Expired) + usage progress. Empty list shows an empty state.

### 13.5 Image upload (all forms)
- **Expected:** **Web** → click to upload → Cloudinary → URL returned. **Native** → tap → photo library → upload. "Paste an image URL" fallback works on both. Uploading shows a spinner; success shows the preview.

---

## 14. Admin — users & payouts

### 14.1 Users list
- **Expected:** Real users only (no "Rahul Sharma" mock). Empty → "No users yet." Search by name/phone/email.

### 14.2 Block / unblock
- **Steps:** Block a user → unblock.
- **Expected:** Status flips; a blocked user can't act (verify on the user side if feasible).

### 14.3 Payouts screen
- **Expected:** Real withdrawal requests (no mock payouts). Empty → "No withdrawal requests yet." Process / complete / reject actions work and reflect on the user's wallet.

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

---

## 16. Cross-cutting checks

### 16.1 Empty states everywhere
- **Pre:** Fresh admin-only DB.
- **Expected:** Every list (home, deals, wallet, users, withdrawals, coupons, banners, top deals/users) shows an honest empty state — **never fake data**. Dashboard stats read zero.

### 16.2 Responsive layout
- **Steps:** Resize the browser (narrow ↔ wide) and test on the phone.
- **Expected:** Mobile screens use the stacked layouts; desktop uses side-by-side / sidebar. The revenue chart, wallet ops tabs, and settings adapt.

### 16.3 API failure handling
- **Steps:** Stop the backend, then open the wallet / dashboard.
- **Expected:** No fake fallback data appears — screens show zeros / empty states or a clear loading/error, not mock balances.

### 16.4 Auth boundaries
- **Steps:** As a non-admin, try to reach `/admin`.
- **Expected:** Admin screens are not served to non-admin roles.

---

## Sign-off

| Area | Pass | Notes |
|---|---|---|
| Authentication | ☐ | |
| Home + search + filters | ☐ | |
| Product detail + Shop Now | ☐ | |
| Wallet + withdraw | ☐ | |
| Profile + edit + avatar | ☐ | |
| Deals list | ☐ | |
| Admin shell + dashboard | ☐ | |
| Admin profile + Razorpay | ☐ | |
| Wallet Operations Hub | ☐ | |
| Content CRUD + image upload | ☐ | |
| Users + payouts | ☐ | |
| End-to-end affiliate flow | ☐ | |
| Empty states + responsive | ☐ | |
