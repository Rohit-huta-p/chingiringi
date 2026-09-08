# Seller Navigation Map

Every seller screen and where each tap leads. Grounded in the real navigator
(`chingiring-app/src/navigation/SellerTabNavigator.tsx`) and each screen's actual
`navigation.navigate(...)` calls.

**Companion artifact (visual):** https://claude.ai/code/artifact/b01497ab-b68d-43ad-bf10-03a2fe520bdf

**Kinds:** `Tab` bottom-nav tab · `Stack` pushed screen (has Back) · `Sheet` bottom sheet / in-place modal · `Fullscreen` full-screen modal · `External` OS / email / phone / role switch · `State` a variant of a screen, not a route.

---

## App shell

- **Bottom tabs — always present** (`MainTabs`): **Dashboard** · **My Store** · **Go Live** · **Profile**
- **Pushed over the tabs** (root stack): `BusinessOnboarding` · `StoreVerification` · `Messages` · `Chat` · `EditProfile` · `EditStoreDetails` · `BroadcasterScreen` (fullscreen modal) · `Settings` · `Notifications` · `ProductDetail` · `About`

---

## Dashboard  ·  `SellerDashboardScreen`  ·  Tab
Reached from: bottom nav · app launch (default landing).

| Tap | → Destination | Kind |
|---|---|---|
| Messages bell (unread badge) | Messages | Stack |
| Go-live hero — "Start stream" | Go Live | Tab |
| Verification pill / banner (unverified) | Store Verification | Stack |
| "Shop as buyer" | Buyer mode | External (role switch) |
| Stat chips · recent-stream rows | stream recap | *planned* |

**States:** No store → "Set up my store" → **Onboarding** · Pending → banner → **Verification** · Rejected → "View & fix" → **Verification (Rejected)** · Loading → skeleton.

---

## My Store  ·  `MyStoreScreen`  ·  Tab
Reached from: bottom nav.

| Tap | → Destination | Kind |
|---|---|---|
| Product row | Product preview | Sheet |
| Preview → "Edit" | Product form | Sheet |
| "+ Add product" FAB | Product form (new) | Sheet |
| Search · Sort · Filter | Sort / Filter sheet | Sheet |
| Verification pill | Store Verification | Stack |

**States:** Empty → "Add product" → product form · No store → "Set up my store" → **Onboarding** · Error → "Retry" · Loading → skeleton.

---

## Go Live  ·  `GoLiveTabScreen`  ·  Tab
Reached from: bottom nav · Dashboard "Start stream".

| Tap | → Destination | Kind |
|---|---|---|
| "Go Live" button (verified) | Stream setup | Sheet |
| Setup → "Go Live now" | Broadcaster | Fullscreen |
| Previous-stream row | stream detail | *planned* |

**States:** Locked (unverified) → button replaced by "Verify now" → **Store Verification**.

---

## Profile  ·  `MobileProfileScreen`  ·  Tab
Reached from: bottom nav.

| Tap | → Destination | Kind |
|---|---|---|
| Avatar edit badge | Edit Profile | Stack |
| Settings gear | Settings | Stack |
| Verification card | Store Verification | Stack |
| Selling → "Edit store details" | Edit Store Details | Stack |
| Selling → "Shop as a buyer" | Buyer mode | External |
| My content → "My Videos" | My Videos | Stack |
| My content → "Blocked accounts" | Blocked Accounts | Stack |
| Refer & earn → "Share" | OS share sheet | External |
| About | Legal (About) | Sheet |
| Contact for support | Email · Phone | External |
| Privacy · Terms | Legal modal | Sheet |
| Log out | Sign out | External |

---

## Store Verification  ·  `StoreVerificationScreen`  ·  Stack
One hub, 4 states + resubmit. Reached from: verification banners on **Dashboard** / **My Store** / **Go Live** · Profile verification card · after onboarding.

| Tap | → Destination | Kind |
|---|---|---|
| Back | previous screen | External |
| Submit → "Submit for verification" | Pending state | State |
| Help & support → "Contact for support" | Email · Phone | External |
| Rejected → "Resubmit store document" | Resubmit view | State |
| Resubmit → "Submit for review" | Pending state | State |
| Verified → "Go to My Store" | My Store | Tab |
| Pending / Rejected → "Continue to Dashboard" | Dashboard | Tab |

**State machine:** Submit → Pending → Verified. If Rejected → names the failed item → Resubmit (identity stays ✓) → back to Pending.

---

## Business Onboarding  ·  `BusinessOnboardingScreen`  ·  Stack
6-step wizard. Reached from: "Set up my store" on Dashboard / My Store (no-store).

| Tap | → Destination | Kind |
|---|---|---|
| Steps 1–4 · Next / Back (Details · Location · Media · Review) | step ↔ step | in place |
| Step 2 → "Use my location" | Device location | External |
| Review → "Create My Store" | Step 5 · Verify store | State |
| Step 5 → "Next" / "Skip for now" | Step 6 · Verify ID | State |
| Step 6 → "Submit for verification" | Verification · Pending | Stack |
| Step 5 / 6 → "Skip for now" | Dashboard | Tab |

---

## Messages  ·  `MessagesScreen`  ·  Stack
Inbox. Reached from: Dashboard messages bell.

| Tap | → Destination | Kind |
|---|---|---|
| Back | Dashboard | Tab |
| Conversation row | Chat | Stack |
| All / Unanswered filter · search | in place | — |

---

## Chat (Thread)  ·  `ChatScreen`  ·  Stack
Reply to a buyer. Reached from: a Messages inbox row.

| Tap | → Destination | Kind |
|---|---|---|
| Back | Messages | Stack |
| Composer "+" | Selling actions | Sheet |
| Selling actions → "Send an offer", share, … | action in thread | — |

---

## Edit Profile  ·  `MobileEditProfileScreen`  ·  Stack
Reached from: Profile avatar edit badge.

| Tap | → Destination | Kind |
|---|---|---|
| Avatar "change photo" | Photo picker | External |
| "Save changes" | Profile (back) | Tab |
| "Cancel" / Back | Profile | Tab |

---

## Edit Store Details  ·  `EditStoreDetailsScreen`  ·  Stack
Reached from: Profile → "Edit store details".

| Tap | → Destination | Kind |
|---|---|---|
| Logo · store photos | Image uploader | External |
| Category pills · fields | in place | — |
| "Save changes" / Back | Profile (My Store refreshes) | Tab |

---

## Broadcaster  ·  `BroadcasterScreen`  ·  Fullscreen
The live console (Mux RTMP). Reached from: Go Live → stream setup → "Go Live now".

| Tap | → Destination | Kind |
|---|---|---|
| Live controls · feature products | in place | — |
| "End" → confirm → summary | Dashboard | Tab |

---

### Notes
- Items marked *planned* aren't wired yet (stream history / detail).
- "Buyer mode" is a role switch (`setViewAsBuyer`), not a seller screen.
- Product preview / form, Sort / Filter, and Selling-actions are **bottom sheets rendered in place**, not pushed routes.
- Redesign mockups for all of the above live on the canvas: **Seller Redesign — All Screens** (https://claude.ai/code/artifact/05f6bcb5-3860-4ba4-8355-8b341c90a78e).
