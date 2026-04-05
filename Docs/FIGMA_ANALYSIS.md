# Figma Design Analysis — ChingiRingi

> **Status**: Figma MCP tools could not be accessed during initial analysis. The Dev Mode MCP Server needs to be enabled in the Figma desktop app.
>
> **To enable**: Figma desktop app → Menu → Preferences → "Enable Dev Mode MCP Server" → Restart Claude Desktop.
>
> **Last Updated**: April 6, 2026

---

## Built Screens Inventory

### Auth Screens (6 screens)
| Screen | File | API Wired? | Notes |
|--------|------|------------|-------|
| Login | `LoginScreen.tsx` | Yes | Username/password + OTP tab, error UI |
| Signup | `SignupScreen.tsx` | Yes | Error UI, success redirect |
| Forgot Password | `ForgotPasswordScreen.tsx` | Yes | Email OTP flow, error/success UI |
| Reset Password | `ResetPasswordScreen.tsx` | Yes | Token-based reset |
| OTP Verification | `OTPVerificationScreen.tsx` | Yes | 6-digit OTP input |
| Auth Layout (shared) | `AuthLayout.tsx` | — | Shared wrapper |

---

### Dashboard Screens (11 screens)
| Screen | File | API Wired? | Notes |
|--------|------|------------|-------|
| Home | `HomeScreen.tsx` | Yes | Deals, categories, trending brands from API; fallback data when empty |
| Wallet | `WalletScreen.tsx` | Yes | Balance cards, recent transactions from API |
| Refer & Earn | `ReferScreen.tsx` | Partial | Referral code from user store; "friends joined" / "earned" stats are hardcoded |
| Notifications | `NotificationsScreen.tsx` | No | Empty state placeholder; no backend API yet |
| Settings | `SettingsScreen.tsx` | Partial | Delete account wired; dark mode toggle is UI-only |
| Profile | `ProfileScreen.tsx` | Yes | Fetches from `/api/profile` |
| Edit Profile | `EditProfileScreen.tsx` | Yes | GET + PUT `/api/profile` |
| My Address | `MyAddressScreen.tsx` | Yes | Full CRUD; edit + delete + set default |
| **Add / Edit Address** | `AddEditAddressScreen.tsx` | **Yes** | **New** — full form with type picker, pincode validation, default toggle |
| Transaction History | `TransactionHistoryScreen.tsx` | Partial | Screen exists but uses hardcoded data; needs wiring to `/api/wallet/transactions` |
| Product Detail | `ProductDetailScreen.tsx` | Yes | Full deal detail; "Shop Now" opens `affiliateUrl` via `Linking.openURL` + click tracking |

---

### Admin Screens (11 screens)
| Screen | File | API Wired? | Notes |
|--------|------|------------|-------|
| **Admin Dashboard** | `AdminDashboardScreen.tsx` | **Yes** | Stats cards, coins economy, top deals table, top users table — from `/api/admin/dashboard` |
| **Admin Deals** | `AdminDealsScreen.tsx` | **Yes** | Full CRUD — list table, Add/Edit modal (cashback type picker, category dropdown), toggle active, delete |
| Admin Conversions | Placeholder | No | Awaiting Admitad webhook integration |
| Admin Withdrawals | Placeholder | No | Awaiting Razorpay X integration |
| Admin Users | Placeholder | No | Backend endpoint exists (`GET /api/admin/users`); UI not built yet |
| Admin All Products | Placeholder | No | Awaiting Module 5 (In-App Store) |
| Admin Categories | Placeholder | No | Backend CRUD exists; UI not built |
| Admin Orders | Placeholder | No | Awaiting Module 5 |
| Admin Inventory | Placeholder | No | Awaiting Module 5 |
| Admin Banners | Placeholder | No | Backend CRUD exists; UI not built |
| Admin Coupons | Placeholder | No | Phase 3 |

---

## Known Issues

### 1. ~~ProductDetail Navigation Not Wired~~ — RESOLVED
"Shop Now" button now opens `deal.affiliateUrl` using `Linking.openURL()` and fires `POST /api/deals/:id/click` for tracking.

### 2. Sidebar Wallet Balance Hardcoded
`Sidebar.tsx` shows a static "₹1250" — should pull from wallet API or Zustand store.

### 3. ReferScreen Stats Hardcoded
"12 Friends joined" and "₹600 earned" are static strings. A referral stats endpoint needs to be built.

### 4. TransactionHistory Screen Hardcoded
Uses mock transaction data. Needs to be wired to `GET /api/wallet/transactions`.

### 5. NotificationsScreen is Placeholder
Only shows empty state. No notification backend exists yet — planned for Phase 2.

### 6. Deal Cards → ProductDetail Navigation
Deal cards on HomeScreen navigate to ProductDetailScreen passing the `deal` object as a route param — this works, but navigation from search results and category filter results should also be verified.

---

## Awaiting Figma Comparison

Once Figma MCP is enabled, the following can be analyzed:
- Pixel-level comparison of each screen against Figma frames
- Missing UI elements (icons, badges, avatars)
- Color/spacing/typography accuracy vs design tokens
- Admin screens vs Figma admin panel designs
- Mobile vs desktop layout fidelity (Android layout alignment was flagged as a pending task)
- Navigation flow correctness end-to-end
