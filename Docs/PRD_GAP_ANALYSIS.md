# ChingiRingi PRD Gap Analysis

| Field | Value |
|---|---|
| **Last Updated** | April 6, 2026 |
| **PRD Version** | 1.0 (April 1, 2026) |
| **Branch Analyzed** | `develop` |
| **Analysis Type** | PRD requirements vs. implemented code |

---

## 1. Executive Summary

The ChingiRingi project has a comprehensive PRD defining 40 functional requirements across 7 modules, organized into 3 release phases. As of April 6, 2026 the codebase covers **Phase 1 (MVP) at approximately 65–70% completion**:

- **Authentication** is fully built end-to-end (email/password + OTP flow, token-based auth for native apps via `expo-secure-store`, cookie-based auth for web)
- **Deal Discovery** has backend APIs and a fully wired frontend (HomeScreen, ProductDetailScreen with working "Shop Now" affiliate redirect, click tracking)
- **Wallet / Profile / Address** modules have complete backend routes and fully wired frontend screens including Add/Edit Address CRUD
- **Admin Panel** is substantially built: role-based routing, Admin Dashboard, Deals Management (full CRUD), Admin Sidebar with navigation, responsive layout (desktop drawer + mobile stack)
- External service integrations (Admitad, Razorpay, MSG91, FCM) remain the primary blocker for Phase 1 go-live
- Phases 2 and 3 are largely unstarted in terms of business logic

**Overall completion: ~40% of total PRD scope (up from ~15% at initial analysis).**

---

## 2. Technical Architecture — Completed Fixes

These are cross-cutting technical improvements delivered since the initial analysis that are not tracked as individual FRs but were blocking or critical:

| Fix | Description | Status |
|---|---|---|
| TurboModule crash on Android (Expo Go) | `react-native-reanimated` caused crash on physical Android devices; fixed by lazy-loading the drawer navigator (web only) via `React.lazy()` + `Suspense` | **Complete** |
| Network error on physical Android | Auto-detect LAN IP from `Constants.expoGoConfig?.debuggerHost`; removed hardcoded `EXPO_PUBLIC_API_URL` override | **Complete** |
| Auth not persisting on native (401 on `/auth/me`) | Implemented dual auth strategy: `httpOnly` cookies on web, `Bearer` token + `expo-secure-store` on native; Axios interceptors handle token attach, refresh, and clear on logout | **Complete** |
| Token refresh on native | `POST /auth/refresh` now accepts `refreshToken` in request body (native) alongside cookies (web); frontend refresh interceptor handles 401 retry | **Complete** |
| Responsive navigation architecture | Mobile: Stack + BottomTabNavigator (no reanimated dependency); Web desktop: lazy-loaded `DrawerNavigator` with permanent sidebar | **Complete** |
| gstack developer tooling | Installed `gstack` (Garry Tan's AI skill factory) providing `/review`, `/cso`, `/ship`, `/investigate`, `/plan-eng-review`, `/qa` slash commands for Claude Code | **Complete** |

---

## 3. Module-by-Module Gap Analysis

### Module 1: Authentication & User Management (FR-001 to FR-010)

| FR ID | Feature | PRD Priority | Backend | Frontend | Status | Gap |
|---|---|---|---|---|---|---|
| FR-001 | Email/Password Signup | P0 | Built | Built | **Complete** | None |
| FR-002 | Email/Password Login | P0 | Built | Built | **Complete** | None |
| FR-003 | OTP-Based Login | P0 | Built (logic) | Built (UI) | **Partial** | OTP delivery not integrated — OTP is logged to console only; MSG91 not connected |
| FR-004 | Password Reset | P0 | Built | Built | **Partial** | Same OTP delivery gap as FR-003 |
| FR-005 | Token Refresh | P0 | Built | Built (Axios interceptor with retry) | **Complete** | None |
| FR-006 | Logout | P0 | Built | Built (clears SecureStore on native, cookies on web) | **Complete** | None |
| FR-007 | Google OAuth Login | P1 | Missing | Missing | **Not Started** | Phase 3 per PRD |
| FR-008 | User Profile Management | P1 | Built (GET/PUT/DELETE routes) | Built (ProfileScreen, EditProfileScreen) | **Partial** | Avatar upload missing; phone/email change with OTP verification not implemented |
| FR-009 | Address Management | P1 | Built (full CRUD + default) | **Built (MyAddressScreen + AddEditAddressScreen)** | **Complete** | Add/Edit address screen built and wired; all CRUD operations functional |
| FR-010 | Account Deletion | P1 | Built (DELETE /api/profile) | API client has `deleteAccount()`, SettingsScreen triggers it | **Partial** | Soft-delete with 30-day grace period logic not verified in backend; no confirmation email |

**Module 1 Assessment**: Core auth is solid and all P0 items are done. Address management is now fully functional. Main remaining gap is MSG91 OTP delivery for production use.

---

### Module 2: Deal Discovery & Affiliate Tracking (FR-011 to FR-016)

| FR ID | Feature | PRD Priority | Backend | Frontend | Status | Gap |
|---|---|---|---|---|---|---|
| FR-011 | Home Feed | P0 | Built (GET /api/deals with filters, pagination, search) | Built (HomeScreen with React Query + fallback) | **Partial** | API is functional; frontend shows real data when available, falls back to hardcoded when empty (no deals seeded yet) |
| FR-012 | Category Browsing | P0 | Built (category-based deal filtering) | Built (category pills + filter param) | **Partial** | Backend supports it; frontend passes category filter; requires real category + deal data |
| FR-013 | Deal Search | P0 | Built (MongoDB `$text` search) | Built (search bar UI) | **Partial** | Backend supports text search; frontend wired; fuzzy/partial matching not implemented |
| FR-014 | Deal Detail Page | P0 | Built (GET /api/deals/:id) | **Built and complete** (ProductDetailScreen with all deal fields) | **Complete** | Full deal detail rendered: cashback type (percentage/flat), expiry, lock period, terms, brand, category tags |
| FR-015 | Affiliate Tracking Redirect | P0 | Built (POST /api/deals/:id/click increments count) | **Built** — "Shop Now" button opens `affiliateUrl` via `Linking.openURL`, fires click tracker | **Partial** | Click count tracked; actual Admitad attribution (user-deal conversion) still requires Admitad webhook integration |
| FR-016 | Banner Management | P1 | Built (CRUD routes with admin protection) | Built (`bannersAPI` in frontend) | **Partial** | Backend CRUD exists; `bannersAPI` client exists; no screen renders banners yet; admin UI for banner management missing |

**Module 2 Assessment**: All core deal discovery flows are functional. The "Shop Now" redirect is live. Primary blocker for real usage is seeding deal data from Admitad.

---

### Module 3: Earning System (FR-017 to FR-020)

| FR ID | Feature | PRD Priority | Backend | Frontend | Status | Gap |
|---|---|---|---|---|---|---|
| FR-017 | Cashback Tracking | P0 | Model exists (Transaction with status lifecycle: pending → confirmed → processing → completed → rejected) | Missing | **Not Started** | No Admitad webhook to receive conversion callbacks; no business logic to transition cashback states |
| FR-018 | Coins System | P1 | Model exists (Wallet has `coins` field) | Wallet screen shows coins balance | **Minimal** | Data field exists and renders; no earn logic, no spend logic, no coin transaction recording |
| FR-019 | Referral System | P1 | Model exists (User has `referralCode`, `referredBy` fields; code auto-generated at signup) | ReferScreen with code display, copy/share UI | **Partial** | Frontend renders referral code and share flow; no reward triggering logic on referee's first purchase |
| FR-020 | QR Code Scanning | P2 | Missing | Missing | **Not Started** | Phase 3 per PRD |

**Module 3 Assessment**: Data models are correctly designed for the cashback lifecycle. Zero business logic connects the earning dots. This is the most critical gap for the product's core value proposition.

---

### Module 4: Wallet & Withdrawals (FR-021 to FR-024)

| FR ID | Feature | PRD Priority | Backend | Frontend | Status | Gap |
|---|---|---|---|---|---|---|
| FR-021 | Wallet Dashboard | P0 | Built (GET /api/wallet, GET /api/wallet/summary) | Built (WalletScreen with balance cards + React Query) | **Partial** | Backend returns wallet data with 4 balance types; frontend renders real data when available; no real wallet data exists (no transactions processed yet) |
| FR-022 | Transaction History | P0 | Built (GET /api/wallet/transactions with filters, pagination, summary stats) | Built (TransactionHistoryScreen, WalletScreen recent list) | **Partial** | Backend fully supports filtered/paginated history; frontend screen exists; no real transactions exist |
| FR-023 | Cashback Withdrawal | P0 | Missing | Missing | **Not Started** | No withdrawal request endpoint; no Razorpay X integration; no admin approval flow |
| FR-024 | Withdrawal Tracking | P1 | Missing | Missing | **Not Started** | Depends on FR-023 |

**Module 4 Assessment**: Read-only wallet viewing is built end-to-end. The critical money-out flow (withdrawals via Razorpay X) is completely unstarted.

---

### Module 5: In-App Store (FR-025 to FR-028)

| FR ID | Feature | PRD Priority | Backend | Frontend | Status | Gap |
|---|---|---|---|---|---|---|
| FR-025 | Product Catalog | P1 | Missing | Missing | **Not Started** | No product model, routes, or controllers |
| FR-026 | Shopping Cart | P1 | Missing | Missing | **Not Started** | — |
| FR-027 | Checkout & Payment | P1 | Missing | Missing | **Not Started** | — |
| FR-028 | Order History & Tracking | P1 | Missing | Missing | **Not Started** | Admin Orders placeholder exists in admin nav |

**Module 5 Assessment**: Entire module is unstarted. Placeholder screens exist in admin panel navigation for Orders and Inventory.

---

### Module 6: Notifications (FR-029 to FR-031)

| FR ID | Feature | PRD Priority | Backend | Frontend | Status | Gap |
|---|---|---|---|---|---|---|
| FR-029 | Push Notifications | P1 | Missing | Missing | **Not Started** | No FCM/Expo push notification integration |
| FR-030 | In-App Notification Center | P1 | Missing | Placeholder (NotificationsScreen shows empty state with tab icon) | **Minimal** | Frontend has placeholder; no backend notification model or API |
| FR-031 | Email Notifications | P2 | Missing | Missing | **Not Started** | Phase 3 per PRD |

**Module 6 Assessment**: Only a placeholder UI screen exists. No backend notification infrastructure.

---

### Module 7: Admin Panel (FR-032 to FR-040)

| FR ID | Feature | PRD Priority | Backend | Frontend | Status | Gap |
|---|---|---|---|---|---|---|
| FR-032 | Admin Dashboard | P1 | **Built** (GET /api/admin/dashboard — aggregates stats, coins economy, top deals/users) | **Built** (AdminDashboardScreen — StatCards, CoinsCard, Top Deals table, Top Users table) | **Complete** | Stats return zeros until real transactions exist |
| FR-033 | Deal Management | P1 | Built (POST/PUT/DELETE /api/deals with admin + protect middleware) | **Built** (AdminDealsScreen — full CRUD table, Add/Edit modal with all fields, cashback type picker, category dropdown, toggle active/featured, delete confirmation) | **Complete** | Full deal management is operational |
| FR-034 | Conversion Management | P0 | Missing | Placeholder screen in admin nav | **Not Started** | No Admitad webhook or conversion processing |
| FR-035 | Withdrawal Management | P0 | Missing | Placeholder screen in admin nav | **Not Started** | No withdrawal queue or approval flow |
| FR-036 | User Management | P1 | **Built** (GET /api/admin/users — paginated, searchable) | Placeholder screen in admin nav | **Partial** | Backend user list endpoint exists; no admin UI yet |
| FR-037 | Store Management | P1 | Missing | Placeholder screens (All Products, Inventory, Orders, Categories) | **Not Started** | Depends on Module 5 |
| FR-038 | QR Merchant Management | P2 | Missing | Missing | **Not Started** | Phase 3 |
| FR-039 | Banner & Category Management | P1 | Built (CRUD routes for both) | Placeholder screens in admin nav | **Partial** | Backend APIs exist; no admin UI screens built yet |
| FR-040 | Coupon Management | P2 | Missing | Placeholder screen in admin nav | **Not Started** | Phase 3 |

**Admin Navigation Architecture:**
- `RootNavigator`: role-based routing — `user.role === 'admin'` routes to `AdminNavigator`, others to `ResponsiveNavigator`
- `AdminNavigator`: responsive — mobile uses Stack, web desktop uses lazy-loaded `DesktopAdminDrawer`
- `AdminSidebar`: collapsible sidebar with expandable Products submenu, logout, admin profile badge
- All admin routes registered: Dashboard, Deals, Conversions, Withdrawals, Users, All Products, Categories, Orders, Inventory, Banners, Coupons

**Module 7 Assessment**: Admin panel has a solid foundation. Dashboard and Deals management are fully operational. Remaining screens are placeholders waiting for backend logic (conversions, withdrawals, store).

---

## 4. External Integration Status

| Service | Purpose | PRD Phase | Status | Impact |
|---|---|---|---|---|
| **MSG91** | SMS OTP delivery | Phase 1 | **Not Integrated** | CRITICAL: OTP logged to console only; blocks real signups via OTP |
| **Admitad** | Affiliate tracking & cashback | Phase 1–2 | **Not Integrated** | CRITICAL: No real deal URLs, no conversion webhooks, no cashback processing |
| **Razorpay X** | Withdrawal payouts | Phase 2 | **Not Integrated** | HIGH: Users cannot withdraw earnings |
| **Razorpay** | Store payments | Phase 3 | **Not Integrated** | Medium: Store not yet built |
| **Google OAuth** | Social login | Phase 3 | **Not Integrated** | Low: Email/password login works |
| **Expo Push / FCM** | Push notifications | Phase 2 | **Not Integrated** | Medium: App functions without push |
| **CDN / S3** | Static asset / image hosting | Phase 1 | **Not Configured** | Medium: Images use direct URLs; no upload flow |

---

## 5. Infrastructure & DevOps Gaps

| Requirement | PRD Section | Status | Gap |
|---|---|---|---|
| CI/CD Pipeline | NFR / Constraints | **Missing** | No GitHub Actions or deployment automation |
| Test Suite | NFR / Constraints | **Missing** | No unit, integration, or e2e tests |
| Database Indexing | NFR | **Partial** | Transaction and Deal models have indexes; Address and Wallet models lack full index coverage |
| Monitoring | Metrics | **Missing** | No APM or error monitoring (New Relic / Sentry) |
| Analytics | Metrics | **Missing** | No event tracking (Mixpanel / Amplitude) |
| Secret Management | Security | **Missing** | Using plain `.env` files; weak MongoDB password flagged |
| HTTPS Enforcement | Security | **Partial** | Cookies configured for `secure`; actual SSL depends on hosting (Render) |
| Developer Tooling | Developer Experience | **Added** | `gstack` installed — provides `/review`, `/cso`, `/ship`, `/investigate`, `/plan-eng-review` for AI-assisted development |

---

## 6. Features Built But Not Explicitly in PRD

| Feature | Location | Notes |
|---|---|---|
| Rate limiting (global + auth-specific) | `backend/src/app.js`, `authRoutes.js` | 5 req/min on auth, 100/min globally |
| Helmet security headers | `backend/src/app.js` | Part of security NFR |
| Mobile responsive layouts | All screens | Bottom tab navigation on mobile, permanent drawer on desktop |
| Settings screen with toggles | `SettingsScreen.tsx` | Dark theme toggle (UI only, not functional) + delete account |
| Trending brands aggregation | `dealController.js` | Aggregation pipeline for brand ranking by clicks |
| Wallet summary endpoint | `walletController.js` | Returns wallet + recent transactions in one call |
| Dual auth strategy (native vs web) | `api/client.ts`, `authMiddleware.js` | Bearer tokens + SecureStore for native; cookies for web |
| Cashback type (percentage / flat) | Deal model + AdminDealsScreen | Admin can set either % or flat ₹ amount per deal |
| Category dropdown in deal form | `AdminDealsScreen.tsx` | Fetches categories from API — admin selects by name, not ID |
| Add/Edit Address screen | `AddEditAddressScreen.tsx` | Full address form with type picker (Home/Work/Other), pincode validation, default toggle |
| Admin API wrapper standardization | `api/admin.ts` | `createDeal`, `updateDeal`, `deleteDeal` — no raw `apiClient` calls in screens |

---

## 7. Phase Readiness Assessment

### Phase 1 MVP: Authentication & Deal Discovery

**Target**: Users can sign up, log in, browse deals, and click through to merchants.

| Requirement | Ready? |
|---|---|
| Full auth system (email/password) | YES |
| OTP delivery via MSG91 | NO — OTP logged to console |
| Home screen with deals from backend | PARTIAL — API is live; requires deal data to be seeded |
| Deal detail page with "Shop Now" affiliate redirect | YES — `Linking.openURL(affiliateUrl)` + click tracking |
| Category browsing and search | PARTIAL — backend supports it; needs real data |
| Address management (view, add, edit, delete, default) | YES — fully wired |
| Wallet dashboard (view only) | PARTIAL — API + UI exist; needs real transaction data |
| Admin panel for deal management | YES — full CRUD operational |
| Role-based routing (admin vs user) | YES |
| Native Android / iOS support | YES — TurboModule crash fixed, token auth works |
| Web (Expo Web) support | YES — drawer navigation, cookie auth |

**Phase 1 Verdict**: ~65–70% complete. Blocking items for go-live:
1. MSG91 OTP integration
2. Seed real deal data (or Admitad API sync)
3. Remove console OTP logging (security)
4. Rotate weak MongoDB password (security)

---

### Phase 2: Monetization & Engagement

**Target**: Cashback earned, withdrawal requested, referral rewards, push notifications.

**Readiness**: ~8%

What exists: Wallet model, Transaction model (status lifecycle defined), referral code generation, admin dashboard aggregation queries.

What's missing: Admitad conversion webhook, cashback state machine, Razorpay X payout, referral reward trigger, push notification infrastructure.

---

### Phase 3: Scale & Ecosystem

**Target**: In-app store, QR offline merchants, Google OAuth, localization.

**Readiness**: ~2%

Only placeholder admin screens exist for store management (Orders, Inventory, All Products).

---

## 8. Priority Recommendations

### Immediate (Blocks Phase 1 Launch)

1. **Integrate MSG91 for OTP delivery** — Without this, no user can sign up or log in outside dev
2. **Remove console OTP logging** — Critical security risk
3. **Rotate weak MongoDB password** — Flagged as Critical in PRD
4. **Seed deal data** — Either manually via admin panel (now available) or via Admitad API sync

### Short-Term (Completes Phase 1)

5. **Wire HomeScreen banners** — Backend and `bannersAPI` exist; add banner carousel to HomeScreen
6. **Build Admin User Management screen** — Backend endpoint exists (`GET /api/admin/users`); replace placeholder
7. **Build Admin Banner/Category Management screens** — Backend CRUD exists for both
8. **TransactionHistoryScreen** — Wire to live `/api/wallet/transactions` (currently hardcoded)
9. **ReferScreen stats** — Currently hardcoded; add a referral stats endpoint

### Medium-Term (Phase 2 Foundation)

10. **Admitad conversion webhook** — `POST /api/webhooks/admitad` → update Transaction status → credit wallet
11. **Cashback state machine** — pending → confirmed → withdrawable (with lock period enforcement)
12. **Withdrawal request flow** — `POST /api/withdrawals` + Razorpay X payout + admin approval queue
13. **Admin Withdrawal Management screen** — Queue + approve/reject UI
14. **Referral reward logic** — Trigger reward on referee's first confirmed purchase
15. **Expo Push Notifications** — Cashback confirmed, withdrawal processed, deal expiry reminders

---

## 9. Architecture Notes

### Active Backend (Node.js Express)
Located at `backend/` — this is the active system for the cashback platform.

### Legacy/Parallel Backend (Java Spring Boot)
Documented in `Docs/ChingiRingi_API_Overview.md`. This is a separate, older system with marketplace, chat, scratch cards, and shop management features. It is not integrated with the current React Native app. Relationship to the Node.js backend should be clarified — likely a separate product or a predecessor.

### Frontend Architecture Summary
- **Framework**: React Native + Expo SDK 54, React 19.1.0, RN 0.81.5
- **State**: Zustand (auth store, UI store), React Query (server state)
- **Navigation**: React Navigation 7 — stack + bottom tabs (mobile), drawer (web desktop)
- **Auth**: Dual strategy — cookies (web) + `expo-secure-store` Bearer tokens (native)
- **API**: Axios with request/response interceptors for token management

---

## 10. File Inventory (As of April 6, 2026)

### Backend Modules (Node.js Express)
- `backend/src/modules/auth/` — Authentication (signup, login, OTP, password reset, refresh, dual cookie/token)
- `backend/src/modules/deals/` — Deal CRUD, search, click tracking, featured, trending brands
- `backend/src/modules/categories/` — Category CRUD
- `backend/src/modules/banners/` — Banner CRUD
- `backend/src/modules/wallet/` — Wallet read, transaction history, summary
- `backend/src/modules/users/` — Profile CRUD
- `backend/src/modules/addresses/` — Address CRUD + default setting
- `backend/src/modules/admin/` — Admin dashboard stats, user list, deals list
- `backend/src/modules/transactions/` — Transaction model (no dedicated routes)
- `backend/src/modules/otp/` — OTP model

### Frontend Screens (React Native / Expo)
**Auth (6 screens)**
- LoginScreen, SignupScreen, OTPVerificationScreen, ForgotPasswordScreen, ResetPasswordScreen, AuthLayout

**Dashboard (11 screens)**
- HomeScreen, WalletScreen, ProfileScreen, EditProfileScreen, SettingsScreen
- NotificationsScreen, ReferScreen, TransactionHistoryScreen
- ProductDetailScreen, MyAddressScreen, **AddEditAddressScreen** *(new)*

**Admin (11 screens)**
- **AdminDashboardScreen** *(new — full stats, coins economy, top deals/users)*
- **AdminDealsScreen** *(new — full CRUD table + Add/Edit modal)*
- Placeholder screens: Conversions, Withdrawals, Users, All Products, Categories, Orders, Inventory, Banners, Coupons

### Frontend Navigation
- `RootNavigator` — role-based routing (admin vs user)
- `AuthNavigator` — login/signup flow
- `DrawerNavigator` — responsive user navigator (mobile stack + lazy desktop drawer)
- `DesktopDrawerNavigator` — permanent sidebar drawer (web only, lazy-loaded)
- **`AdminNavigator`** *(new)* — responsive admin navigator
- **`DesktopAdminDrawer`** *(new)* — permanent admin sidebar drawer (web only, lazy-loaded)

### Frontend API Clients
- `chingiring-app/src/api/auth.ts` — Auth endpoints
- `chingiring-app/src/api/deals.ts` — Deals, categories, banners
- `chingiring-app/src/api/wallet.ts` — Wallet and transactions
- `chingiring-app/src/api/profile.ts` — Profile and addresses
- **`chingiring-app/src/api/admin.ts`** *(standardized)* — Dashboard stats, user list, deal CRUD
- `chingiring-app/src/api/client.ts` — Axios instance, dual auth interceptors, SecureStore token management

### Frontend Components
- `Sidebar` — User sidebar (desktop, collapsible)
- **`AdminSidebar`** *(new)* — Admin sidebar with expandable Products submenu
- `DealCard`, `Card`, `Button` — Reusable UI primitives
