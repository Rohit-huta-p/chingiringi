# Chingiringi — Test Findings Summary

Focused extract from the [Manual Test Plan](Manual_Test_Plan.md) — **only the items that need attention** from the 2026-07-16 run: bugs/issues, partially-verified cases, and deliberately-skipped cases. Full pass details live in the main plan.

**Run:** 2026-07-16 · frontend `localhost:8082` (Expo web) ↔ backend `localhost:8000` (MongoDB Atlas, live data) · desktop 1440×920 · accounts `admin@gmail.com`, `vcrohithuta@gmail.com`.

| Group | Count | Meaning |
|---|---|---|
| 🔴 **Bugs & issues** | 1 bug + 4 issues | Something is broken or wrong — needs a code/copy fix |
| 🟡 **Partial** | 7 | Works but only partly exercised — needs follow-up verification |
| 🔵 **Skipped** | 6 | Deliberately not run this pass (destructive, mutates config, or not drivable in the in-app browser) |

---

## 1. 🔴 Bugs & issues

### 1.1 🔴 BUG — Report import isn't atomic; no success confirmation/audit on a deal-linked match
- **Where:** Admin → Wallet Ops → Reports Inbox → Import *(plan §12.3 / §17.1)*
- **What happens:** Importing a report row that matches by subid **and** has a recent deal-linked click **credits the coins** (wallet `pendingCoins += N` and a `coin_credit` transaction are written), but the **`ReportImport` audit document fails to save** — so the admin sees **no success card and no "Past imports" entry**.
- **Root cause (code trace):** the controller sets `row.matchedVia = 'subid+click'` (or `'click_log_fallback'`), which is **not in the schema enum** `['subid','click_log','manual','none']` (`backend/src/modules/admin/reportImportModel.js` ~line 24). `ReportImport.create()` throws a Mongoose `ValidationError` **after** the wallet/transaction writes already committed (`walletOpsController.js`, sets `matchedVia` ~:609–611, creates the audit ~:622).
- **Observed:** the import credited **+440 pending coins** (visible on the user wallet + admin timeline) yet produced **no** "Past imports" row; the accidental re-import was then correctly **deduped** ("1 failed — duplicate").
- **Impact:** silent success — the user is credited, but there's **no confirmation and no audit trail**. No double-credit (dedup protects that), but reconciliation is broken.
- **Fix:** add `'subid+click'` / `'click_log_fallback'` to the `matchedVia` enum, **and/or** wrap the wallet credit + transaction + audit write in one DB transaction so they commit or roll back together.

### 1.2 🟡 ISSUE — Coin formula: live config, UI copy, and docs all disagree
- **Where:** Reports Inbox help text + coin economy config *(plan §12.9 / §17.2)*
- **The three numbers:** the Reports Inbox help says **"commission × 10 coins"**; the plan §0 default says **pass-through 25%** (→ ×2.5); the **live credit was 440 for ₹200 → effective ×2.2 (pass-through ≈22%)**.
- **Fix:** confirm the intended pass-through, set it in Wallet Ops → Settings, and fix the help copy (it omits the pass-through factor entirely).

### 1.3 🟡 ISSUE — Currency symbol on a coin amount
- **Where:** User wallet → Transaction History row *(plan §4.2 / §17.3)*
- **What:** the transaction row shows **"+₹440"** while the Pending Coins card correctly shows **"440 coins ≈ ₹44"**.
- **Fix:** the row should read coins ("+440 coins") or the rupee value ("+₹44"), not "₹440".

### 1.4 🟡 ISSUE — Admin User-Wallet tiles don't surface pending coins
- **Where:** Admin → Wallet Ops → User Wallet *(plan §12.5 / §17.4)*
- **What:** the four summary tiles read **COINS 0 / PENDING ₹0** even when the timeline shows **+440 pending coins**. The "PENDING" tile is rupees-only, so pending coins appear in no tile.
- **Fix:** add a pending-coins figure to the admin summary tiles.

### 1.5 🟡 DATA — Stale test deal
- **Where:** Admin → Deals *(plan §6.5 / §17.7)*
- **What:** the "Headphone" deal expired **15/07/2026** (a day before the run), so it's correctly hidden from users but still shows to admin.
- **Fix:** bump its expiry if it should remain visible (not a code bug — stale data).

---

## 2. 🟡 Partial — works, but only partly verified

| # | Case | ✅ Verified this run | ⏳ Left to verify |
|---|---|---|---|
| 2.8 | Open a product | Product/deal cards render with correct data | Tapping a card did **not** fire navigation in the automated browser (RN-web synthetic-click quirk, §17.8) — confirm on a real device / Expo Go |
| 4.4 | Withdraw funds overlay | The **Withdraw Funds** button renders | With ₹0 balance the click is a no-op (correct guard); open + drive the overlay once the account has a withdrawable balance |
| 6.4 | Open a deal | Deal cards render (brand, cashback %, days-to-expiry); the Shop-Now network path is verified separately (§3.2) | Tap-to-detail didn't fire in automation (same §17.8 quirk) — confirm manually |
| 8.2 | About | About + legal links (Affiliate Partners, Terms, Help, Privacy) present on Profile | Open the About screen and confirm app-info content |
| 12.3 | Reports Inbox — import credits coins | Credit works: **+440 pending coins** landed, `coin_credit` txn created, visible on user wallet + admin timeline | The success/audit path is broken on deal-linked matches → **see Bug 1.1** |
| 14.1 | Users list | Real users returned via Wallet Ops → User Wallet search (two "Rohit Hutagonna") | Open the dedicated **Users** screen; confirm empty state + search there |
| 15 | End-to-end affiliate flow | **Steps 1–5 PASS**: deal → click (subid) → CSV import → **+440 pending coins** visible to user | **Steps 6–8**: run `npm run cron:confirm-locks -- --force` (lock → withdrawable), then user withdrawal → admin approve & pay |

---

## 3. 🔵 Skipped — deliberately not run this pass

| # | Case | Why skipped | How to test properly |
|---|---|---|---|
| 1.3 | Login — OTP | OTP delivery not exercisable in this environment | Use a real phone/number with SMS; verify send + correct/incorrect OTP + <10-digit block |
| 1.4 | Login on Safari | The in-app browser is Chromium, not Safari | Log in on desktop/iOS Safari; confirm wallet/profile load with no 401s (the Bearer-token / ITP fix) |
| 1.8 | Delete account | Destructive — removes an account | On a throwaway account: pick a reason, confirm "Delete Forever" only enables after a reason, then delete |
| 5.2 | Edit profile — avatar upload | OS file picker can't be driven from the in-app browser | Web: upload a file → Cloudinary → preview. Native: photo-library permission → pick → upload |
| 11.3 | Configure Razorpay | Saving would mutate live payment config | On a staging config: save keys, reopen to confirm the secret is masked (`••••••1234`), blank-on-resave keeps the stored secret |
| 13.5 | Image upload (all forms) | OS file dialog not drivable in the in-app browser | Web file picker + native photo picker + "paste image URL" fallback across deal/product/banner forms |

---

## Suggested priority

1. **Fix Bug 1.1** (import atomicity / `matchedVia` enum) — it silently breaks the admin audit trail for the core money path.
2. **Reconcile the coin formula (1.2)** — three sources disagree; pick the source of truth and align copy + config + docs.
3. Polish the two display issues (1.3, 1.4) — small, user-visible.
4. Verify the 🟡 partials on a real device / with balances (esp. §15 steps 6–8 and the card-tap navigation).
5. Run the 🔵 skipped set manually where they matter (OTP, Safari, uploads).
