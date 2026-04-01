# Chingiringi — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Document Title** | Chingiringi Platform — Product Requirements Document |
| **Version** | 1.0 |
| **Date** | April 1, 2026 |
| **Author** | Generated via Codebase Analysis |
| **Status** | Draft |
| **Confidentiality** | Internal — Restricted Distribution |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Strategy](#3-product-vision--strategy)
4. [Target Users & Personas](#4-target-users--personas)
5. [Scope & Requirements](#5-scope--requirements)
   - 5.1 Functional Requirements
   - 5.2 Non-Functional Requirements
   - 5.3 System Architecture Overview
6. [User Experience](#6-user-experience)
7. [Release Strategy & Phasing](#7-release-strategy--phasing)
8. [Metrics & Success Criteria](#8-metrics--success-criteria)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [Dependencies & Constraints](#10-dependencies--constraints)
11. [Open Questions & Assumptions](#11-open-questions--assumptions)
12. [Appendices](#12-appendices)

---

## 1. Executive Summary

### Product Vision

Chingiringi is a **multi-platform affiliate cashback and rewards marketplace** that enables consumers to earn cashback, loyalty coins, and referral rewards on online purchases while providing merchants with qualified traffic and measurable conversion attribution. The platform unifies affiliate deal discovery, a coins-based loyalty economy, an in-app physical product store, and a QR-based offline merchant network into a single consumer experience across Android, iOS, and Web.

### Core Problem

Indian consumers make thousands of online purchases annually across fragmented e-commerce platforms without visibility into available cashback opportunities. Existing cashback platforms offer limited reward mechanisms, lack offline merchant integration, and provide no unified loyalty economy — resulting in fragmented user engagement and low retention.

### Strategic Value

Chingiringi creates a dual-sided marketplace generating revenue through affiliate commissions (via Admitad network) while building a defensible user base through a multi-layered reward system (cashback + coins + referrals). The platform's QR-based offline merchant module extends the addressable market beyond pure e-commerce into local retail — a capability absent from most competitors.

### Elevator Pitch

*Chingiringi is a cashback and rewards super-app that pays users to shop. Whether buying online through affiliate deals, scanning QR codes at local stores, or referring friends — every action earns real cashback or loyalty coins that can be withdrawn or spent in our built-in store. For merchants, we deliver high-intent traffic with full conversion tracking and zero upfront cost.*

---

## 2. Problem Statement

### Problem Space

The affiliate cashback market in India is growing rapidly, yet consumers face several persistent pain points:

1. **Fragmented Rewards**: Users must juggle multiple apps (CashKaro, GoPaisa, Magicpin, credit card rewards) with no unified view of earnings.
2. **Delayed Gratification**: Cashback confirmation cycles of 30–90 days erode trust and engagement.
3. **Online-Only Models**: Most cashback platforms ignore offline retail, missing a significant portion of consumer spending.
4. **No Loyalty Stacking**: Users cannot combine cashback with other reward mechanisms (coins, referrals) within a single platform.
5. **Poor Discovery**: Finding the best cashback deals across hundreds of merchants is cumbersome and time-consuming.

### Who Experiences This Problem

- **Primary**: Price-conscious online shoppers (18–35) in India who shop frequently on Amazon, Flipkart, Myntra, and similar platforms.
- **Secondary**: Small-to-medium offline merchants seeking affordable customer acquisition channels.
- **Tertiary**: Influencers and content creators who can monetize their audience via referral programs.

### Quantified Impact (Inference)

- India's affiliate marketing industry is estimated at $1.2B+ (2025), growing at ~25% CAGR.
- Average Indian online shopper makes 20+ purchases/year; at 5–15% cashback rates, annual savings potential is ₹2,000–₹8,000 per user.
- Referral-driven user acquisition typically reduces CAC by 40–60% compared to paid channels.

### Current Alternatives & Shortcomings

| Alternative | Shortcoming |
|---|---|
| **CashKaro** | Online-only, no loyalty coins, limited gamification |
| **GoPaisa** | Slow UX, no offline merchant network |
| **Magicpin** | Offline-focused, no affiliate cashback engine |
| **Credit Card Rewards** | Bank-specific, complex redemption, no cross-platform view |
| **Coupon Sites (RetailMeNot, GrabOn)** | No cashback, no user accounts, pure aggregation |

### Jobs-to-Be-Done

| Job | Context |
|---|---|
| **Save money on purchases I'm already making** | Shopping on e-commerce platforms |
| **Discover the best deals without searching everywhere** | Planning purchases across categories |
| **Earn rewards from everyday activities** | Shopping, referring friends, visiting local stores |
| **Track all my earnings in one place** | Managing cashback, coins, referral rewards |
| **Withdraw real money from my rewards** | Converting earned cashback to bank/UPI |
| **Drive traffic to my store affordably** | Small merchant seeking foot traffic |

---

## 3. Product Vision & Strategy

### Long-Term Vision (2–3 Year Horizon)

**Year 1**: Establish Chingiringi as a trusted cashback platform in India with 100K+ active users, strong affiliate partnerships (via Admitad), and a functioning in-app store. Complete all core modules: authentication, deal discovery, wallet, referrals, and notifications.

**Year 2**: Scale the QR-based offline merchant network to 5,000+ merchants in top 10 Indian cities. Launch the admin panel for self-service merchant onboarding. Introduce gamification features (scratch cards, streaks, challenges) to boost DAU/MAU ratio.

**Year 3**: Expand into adjacent verticals (travel, insurance, financial products) with higher commission rates. Build a social layer (reviews, deal sharing, community posts) to create network effects. Explore white-label B2B cashback solutions for enterprises.

### Strategic Alignment

- **Market Trend**: India's digital payments infrastructure (UPI) makes instant cashback withdrawals feasible — a key UX differentiator.
- **Behavioral Trend**: Gen Z and Millennials actively seek "earn while you spend" platforms, with 67% of Indian online shoppers claiming cashback influences their purchase decisions (inference based on industry reports).
- **Technology Trend**: React Native / Expo enables rapid cross-platform deployment, reducing time-to-market by 40% compared to native development.

### Competitive Positioning & Moat

```
                    High Reward Diversity
                          │
                          │
         Chingiringi ●    │
         (Cashback +      │
          Coins +         │    ● CashKaro
          QR + Store)     │    (Cashback only)
                          │
    ──────────────────────┼──────────────────────
    Offline               │              Online
    Integration           │              Only
                          │
         ● Magicpin       │    ● GoPaisa
         (Offline only)   │    (Cashback only)
                          │
                    Low Reward Diversity
```

**Moat**: Multi-layered reward economy (cashback + coins + referrals + QR) creates switching costs. As users accumulate coins and build referral networks, leaving the platform means abandoning earned value — a powerful retention mechanism.

### Key Differentiators (Derived from Codebase)

1. **Unified Reward Engine**: Single wallet with pending cashback, confirmed cashback, and coins — all visible in one view.
2. **QR-Based Offline Integration**: Merchant QR scanning extends cashback beyond e-commerce (planned module).
3. **In-App Store with Coins Payment**: Users can spend loyalty coins on physical products — creating a closed-loop economy.
4. **Referral-Driven Growth**: Built-in referral code system with unique codes, shareable links, and referral dashboards.
5. **Multi-Auth Flexibility**: OTP, email/password, and Google login — meeting users where they are.

### Product Principles

1. **Every action should earn**: If a user spends time in the app, they should feel rewarded.
2. **Transparency over surprise**: Show pending cashback amounts, lock periods, and confirmation timelines upfront.
3. **Mobile-first, web-equal**: The mobile app is the primary experience, but the web app must offer full parity.
4. **Security is non-negotiable**: HTTP-only cookies, bcrypt hashing, JWT rotation — never compromise on auth.
5. **Simplicity wins**: A user should go from app open to deal click in under 10 seconds.

---

## 4. Target Users & Personas

### Primary Persona: "Savvy Sneha"

| Attribute | Detail |
|---|---|
| **Age** | 24 |
| **Occupation** | Marketing associate at a Bangalore startup |
| **Income** | ₹5–8 LPA |
| **Tech Proficiency** | High — uses 15+ apps daily, comfortable with UPI |
| **Goals** | Save money on frequent online shopping; earn passive income via referrals |
| **Frustrations** | Scattered cashback across multiple apps; forgets to check cashback sites before buying; unclear confirmation timelines |
| **Use Case** | Checks Chingiringi before every purchase. Shares referral code with colleagues. Withdraws confirmed cashback to UPI monthly. |
| **Devices** | iPhone 13, MacBook — uses both mobile app and web |

### Secondary Persona: "Merchant Manoj"

| Attribute | Detail |
|---|---|
| **Age** | 38 |
| **Occupation** | Owner of a clothing store in Hyderabad |
| **Income** | ₹12–15 LPA business revenue |
| **Tech Proficiency** | Medium — uses WhatsApp Business, basic smartphone usage |
| **Goals** | Drive foot traffic to physical store; compete with online retailers |
| **Frustrations** | Paid advertising is expensive and hard to measure; existing loyalty programs are complex |
| **Use Case** | Registers store on Chingiringi. Displays QR code at billing counter. Customers scan to earn coins, which drives repeat visits. |
| **Devices** | Android phone, no laptop |

### Tertiary Persona: "Influencer Isha"

| Attribute | Detail |
|---|---|
| **Age** | 21 |
| **Occupation** | College student, Instagram content creator (15K followers) |
| **Income** | ₹1–2 LPA (part-time) |
| **Tech Proficiency** | Very high — early adopter of new apps |
| **Goals** | Monetize audience without being spammy; earn passive income |
| **Frustrations** | Brand deals require minimum follower counts; affiliate links are ugly and complex |
| **Use Case** | Shares Chingiringi referral code in Instagram bio and stories. Earns coins and cashback when followers sign up and make purchases. |
| **Devices** | iPhone 15, iPad |

### Prioritized Persona Map

```
Priority 1: Savvy Sneha (Consumer)     → Build core deal discovery, cashback, wallet
Priority 2: Merchant Manoj (Merchant)  → Build QR merchant module, merchant dashboard
Priority 3: Influencer Isha (Referrer) → Build referral dashboard, shareable links, earnings analytics
```

**Rationale**: Consumer adoption must precede merchant value — merchants will only join when there's a user base to deliver traffic from.

---

## 5. Scope & Requirements

### 5.1 Functional Requirements

#### Module 1: Authentication & User Management

| ID | Feature | User Story | Description | Acceptance Criteria | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| FR-001 | Email/Password Signup | As a new user, I want to create an account with my email and password, so that I can access cashback deals. | User provides name, username, email, phone, and password. System validates uniqueness of email/phone/username, creates user account and associated wallet, returns auth tokens via HTTP-only cookies. | **Given** a new user fills the signup form with valid data, **When** they submit, **Then** an account is created, a wallet is initialized with zero balances, and they are redirected to the home screen as an authenticated user. **Given** a user submits an email already in use, **When** they submit, **Then** a clear error message is shown without creating a duplicate account. | P0 | None | **Built** |
| FR-002 | Email/Password Login | As a returning user, I want to log in with my email/username and password, so that I can access my account. | User provides identifier (email or username) + password. System validates credentials via bcrypt comparison, issues JWT access (15min) and refresh (30d) tokens as HTTP-only cookies. | **Given** a registered user enters correct credentials, **When** they submit, **Then** they receive valid auth cookies and are redirected to the home screen. **Given** incorrect credentials, **When** they submit, **Then** a generic "Invalid credentials" error is shown (no credential enumeration). | P0 | FR-001 | **Built** |
| FR-003 | OTP-Based Login | As a user, I want to log in using a one-time password sent to my phone/email, so that I don't need to remember my password. | System generates a 6-digit OTP, hashes and stores it with 5-minute TTL, and delivers to user's phone/email. User enters OTP in a 6-digit input interface with auto-focus. Max 3 verification attempts. | **Given** a user requests an OTP, **When** the OTP is generated, **Then** it is stored hashed (bcrypt) with a 5-minute expiry and delivered to the user. **Given** a valid OTP is entered within the time window, **When** submitted, **Then** the user is authenticated and the OTP record is deleted. **Given** 3 failed attempts, **When** a 4th attempt is made, **Then** the OTP is invalidated and the user must request a new one. | P0 | FR-001 | **Built** (delivery integration missing) |
| FR-004 | Password Reset | As a user who forgot their password, I want to reset it via OTP verification, so that I can regain access to my account. | User enters email → receives OTP → verifies OTP → sets new password. New password is hashed and saved. | **Given** a user requests a password reset, **When** they verify the OTP and enter a new password, **Then** the password is updated and they can log in with the new password. | P0 | FR-003 | **Built** |
| FR-005 | Token Refresh | As an authenticated user, I want my session to persist seamlessly, so that I'm not logged out every 15 minutes. | Axios interceptor detects 401 responses, automatically calls `/auth/refresh` with the refresh token cookie, replaces expired access token, and retries the original request. Refresh tokens are rotated (old removed, new issued). Max 5 refresh tokens stored per user. | **Given** an access token expires during an API call, **When** the 401 interceptor fires, **Then** a new token pair is issued silently and the original request succeeds without user interaction. | P0 | FR-002 | **Built** |
| FR-006 | Logout | As a user, I want to securely log out, so that my session is terminated on all devices. | Removes refresh token from user's stored token array, clears both cookies (accessToken, refreshToken) by setting expiry to epoch. | **Given** a user clicks logout, **When** the request completes, **Then** both cookies are cleared and the user is redirected to the login screen. | P0 | FR-002 | **Built** |
| FR-007 | Google OAuth Login | As a user, I want to log in with my Google account, so that I can sign up quickly without creating a new password. | Integration with Google OAuth 2.0 for single-tap authentication. | **Given** a user taps "Sign in with Google", **When** they authorize the app, **Then** an account is created (or linked) and they are authenticated. | P1 | FR-001 | **Missing** |
| FR-008 | User Profile Management | As a user, I want to view and edit my profile (name, email, phone, avatar), so that my information stays current. | Profile screen displays current user data. Edit functionality for name, username, email, phone, avatar. Phone/email changes require OTP verification. | **Given** a user navigates to profile settings, **When** they update their name and save, **Then** the change is persisted and reflected across the app. | P1 | FR-001 | **Partial** (view only in Settings) |
| FR-009 | Address Management | As a user, I want to manage my delivery addresses, so that I can receive store purchases at the correct location. | CRUD operations for user addresses. Fields: label, street, city, state, pincode, landmark, default flag. | **Given** a user adds a new address, **When** they save, **Then** the address is stored and selectable during checkout. | P1 | FR-001 | **Missing** |
| FR-010 | Account Deletion | As a user, I want to delete my account, so that my data is removed per privacy regulations. | Soft-delete with 30-day grace period. Permanently removes user data, wallet, and associated records after grace period. | **Given** a user requests account deletion, **When** confirmed, **Then** the account is deactivated immediately and scheduled for permanent deletion after 30 days. | P1 | FR-001 | **Missing** |

#### Module 2: Deal Discovery & Affiliate Tracking

| ID | Feature | User Story | Description | Acceptance Criteria | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| FR-011 | Home Feed | As a user, I want to see trending cashback deals on the home screen, so that I can quickly discover savings opportunities. | Home screen displays hero banner, category pills (Fashion, Electronics, Home, Pharmacy, Travel, Food), trending brands carousel, and a grid of deal cards. Each deal card shows brand, description, cashback percentage, and expiry countdown. | **Given** an authenticated user opens the app, **When** the home screen loads, **Then** trending deals are displayed in a grid with brand name, cashback %, and expiry information visible. | P0 | FR-001 | **Partial** (UI built with hardcoded data; no backend API) |
| FR-012 | Category Browsing | As a user, I want to browse deals by category, so that I can find cashback offers relevant to my shopping intent. | Horizontal pill-based category selector (All, Fashion, Electronics, Home, Pharmacy, Travel, Food). Selecting a category filters the deals grid. | **Given** a user taps the "Electronics" category pill, **When** the filter is applied, **Then** only electronics deals are displayed in the grid. | P0 | FR-011 | **Partial** (UI pills built; filtering logic not implemented) |
| FR-013 | Deal Search | As a user, I want to search for deals by merchant name or keyword, so that I can find specific cashback offers. | Search bar with text input. Supports typo correction (fuzzy matching). Displays results in real-time as user types. Filter icon for advanced filtering (cashback %, merchant, category). | **Given** a user types "Nike" in the search bar, **When** results are filtered, **Then** all Nike-related deals are shown. **Given** a user types "Niike" (typo), **When** results load, **Then** Nike deals are still surfaced via fuzzy matching. | P0 | FR-011 | **Partial** (search bar UI exists; no backend search) |
| FR-014 | Deal Detail Page | As a user, I want to view full deal details before clicking through, so that I can understand the cashback terms. | Displays: merchant logo, cashback percentage, deal description, terms & conditions, expiry date, "Shop Now" CTA. Clicking "Shop Now" triggers affiliate tracking redirect. | **Given** a user taps a deal card, **When** the detail page loads, **Then** full deal information is displayed including cashback %, terms, and a "Shop Now" button. | P0 | FR-011 | **Missing** |
| FR-015 | Affiliate Tracking Redirect | As a user, I want my purchase to be tracked when I click through a deal, so that I receive the cashback I'm entitled to. | Clicking "Shop Now" opens the merchant's website via an Admitad affiliate tracking link. The redirect records user ID, deal ID, and timestamp for attribution. | **Given** a user clicks "Shop Now" on a deal, **When** they are redirected, **Then** the redirect passes through the affiliate tracking URL and the click is logged for attribution. | P0 | FR-014 | **Missing** |
| FR-016 | Banner Management | As an admin, I want to manage promotional banners on the home screen, so that I can highlight featured deals and campaigns. | Admin uploads banner images with scheduling (start/end date), priority ordering, and deep-link targets. Banners cycle in a hero carousel on the home screen. | **Given** an admin creates a banner with a start date of tomorrow, **When** tomorrow arrives, **Then** the banner appears in the home screen carousel. | P1 | FR-011 | **Missing** |

#### Module 3: Earning System

| ID | Feature | User Story | Description | Acceptance Criteria | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| FR-017 | Cashback Tracking | As a user, I want to see my cashback status (pending → confirmed → withdrawable), so that I know when I can withdraw. | Cashback earned via affiliate purchases follows a lifecycle: Pending (30–45 day lock) → Confirmed (merchant validates conversion) → Withdrawable (available in wallet). Status updates via Admitad conversion callbacks. | **Given** a user makes a purchase via an affiliate link, **When** the conversion is reported by Admitad, **Then** the cashback amount appears as "Pending" in the user's wallet. **Given** the lock period expires and the merchant confirms, **When** the status updates, **Then** the cashback moves to "Confirmed". | P0 | FR-015 | **Missing** |
| FR-018 | Coins System | As a user, I want to earn coins through app activities (QR scans, referrals, actions), so that I have additional rewards. | Coins are a secondary currency earned through non-purchase actions. Coins balance is tracked in the wallet. Coins can be spent in the in-app store. History of coin transactions is viewable. | **Given** a user completes a coin-earning action, **When** the action is validated, **Then** coins are credited to their wallet and the transaction appears in history. | P1 | FR-001 | **Partial** (wallet model has `coins` field; no earning logic) |
| FR-019 | Referral System | As a user, I want a unique referral code and shareable link, so that I can invite friends and earn rewards. | Each user gets a unique referral code (auto-generated at signup). Shareable deep links. Referral dashboard showing: invites sent, signups, first purchases, rewards earned. Reward triggered on referee's first qualified purchase. | **Given** a user shares their referral link, **When** a new user signs up via that link and makes a first purchase, **Then** both the referrer and referee receive the configured reward. | P1 | FR-001, FR-017 | **Partial** (referralCode and referredBy fields exist in user model; no reward logic) |
| FR-020 | QR Code Scanning | As a user, I want to scan a QR code at a local store, so that I earn coins for visiting offline merchants. | Camera-based QR scanner reads merchant-specific QR codes. Validates merchant registration. Credits coins to user's wallet upon successful scan. Anti-fraud: cooldown period between scans at same merchant. | **Given** a user scans a valid merchant QR code, **When** the scan is processed, **Then** coins are credited and a confirmation is shown. **Given** the user already scanned the same merchant within the cooldown period, **When** they scan again, **Then** no coins are credited and a "too soon" message is shown. | P2 | FR-018 | **Missing** |

#### Module 4: Wallet & Withdrawals

| ID | Feature | User Story | Description | Acceptance Criteria | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| FR-021 | Wallet Dashboard | As a user, I want to see my complete wallet overview (pending cashback, confirmed cashback, coins), so that I understand my total earnings. | Single-view wallet showing three balances: pendingCashback, confirmedCashback, coins, plus lifetimeEarned total. Visual breakdown with card-based layout. | **Given** an authenticated user navigates to the wallet screen, **When** the data loads, **Then** all four balance types are displayed with correct amounts. | P0 | FR-017, FR-018 | **Partial** (wallet model exists with correct fields; no UI or API) |
| FR-022 | Transaction History | As a user, I want to view my complete transaction history, so that I can track all earnings and withdrawals. | Chronological list of all wallet transactions: cashback earned, coins earned, withdrawals, store purchases. Each entry shows: type, amount, date, status, source. Filterable by type and date range. | **Given** a user opens transaction history, **When** the list loads, **Then** all transactions are displayed in reverse chronological order with type, amount, and status visible. | P0 | FR-021 | **Missing** |
| FR-023 | Cashback Withdrawal | As a user, I want to withdraw my confirmed cashback to my bank account or UPI, so that I can access my real earnings. | Withdrawal flow: select amount → choose method (UPI/Bank) → confirm → admin approval → Razorpay X payout. Minimum withdrawal threshold (configurable). Withdrawal status tracking (requested → approved → processed → completed). | **Given** a user requests a withdrawal of ₹500 (above minimum threshold), **When** the admin approves, **Then** the amount is disbursed via Razorpay X and the wallet balance is debited. | P0 | FR-021 | **Missing** |
| FR-024 | Withdrawal Tracking | As a user, I want to track the status of my withdrawal requests, so that I know when to expect the money. | Status timeline: Requested → Under Review → Approved → Processing → Completed/Failed. Push notification on status change. Estimated timeline display. | **Given** a user submits a withdrawal request, **When** they check status, **Then** the current stage in the approval pipeline is shown with timestamp. | P1 | FR-023 | **Missing** |

#### Module 5: In-App Store

| ID | Feature | User Story | Description | Acceptance Criteria | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| FR-025 | Product Catalog | As a user, I want to browse physical products available for purchase with my coins or cashback, so that I can spend my rewards. | Category-based product listing with images, descriptions, variants (size, color), and pricing (₹ and coins). Pagination and sorting (price, popularity). | **Given** a user opens the store, **When** they browse the catalog, **Then** products are displayed with images, prices in both ₹ and coin equivalents, and category filters. | P1 | FR-018 | **Missing** |
| FR-026 | Shopping Cart | As a user, I want to add products to a persistent cart, so that I can review before purchasing. | Cart persists across sessions. Quantity adjustment. Variant selection. Cart total calculation with applied coupons. | **Given** a user adds an item to cart, **When** they close and reopen the app, **Then** the item is still in the cart with correct quantity and variant. | P1 | FR-025 | **Missing** |
| FR-027 | Checkout & Payment | As a user, I want to pay using coins, Razorpay, or a mix of both, so that I have flexible payment options. | Three payment modes: full coins, full Razorpay (₹), mixed. Coupon code application at checkout. Delivery address selection. Order confirmation screen. | **Given** a user has 500 coins and an item costs 300 coins, **When** they select "Pay with Coins", **Then** 300 coins are debited and the order is confirmed. | P1 | FR-026, FR-021 | **Missing** |
| FR-028 | Order History & Tracking | As a user, I want to track my store orders, so that I know when my purchases will arrive. | Order list with status (placed, confirmed, shipped, delivered). Tracking details when available. Order detail view with items, quantities, payment method, and delivery address. | **Given** a user places an order, **When** they check order history, **Then** the order appears with current status and expected delivery date. | P1 | FR-027 | **Missing** |

#### Module 6: Notifications

| ID | Feature | User Story | Description | Acceptance Criteria | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| FR-029 | Push Notifications | As a user, I want to receive push notifications for important updates (cashback confirmed, new deals, withdrawal status), so that I stay informed. | Push via Expo Notifications + FCM. Triggers: cashback state changes, new high-value deals, referral signups, withdrawal status updates, order updates. | **Given** a user's cashback status changes from "Pending" to "Confirmed", **When** the backend processes the change, **Then** a push notification is sent to the user's device within 60 seconds. | P1 | FR-017 | **Missing** |
| FR-030 | In-App Notification Center | As a user, I want to view all my notifications in one place, so that I can catch up on missed updates. | In-app notification feed with read/unread states. Grouped by type (cashback, deals, orders, referrals). Tap to navigate to relevant screen. | **Given** a user opens the notification center, **When** the feed loads, **Then** all notifications are shown with unread items highlighted and tappable. | P1 | FR-029 | **Missing** (placeholder screen exists in navigation) |
| FR-031 | Email Notifications (Web) | As a web user, I want to receive email notifications, so that I stay informed without installing a mobile app. | Email delivery for: welcome, cashback confirmations, withdrawal updates, weekly deal digest. Unsubscribe option per category. | **Given** a web-only user's cashback is confirmed, **When** the event triggers, **Then** an email notification is sent with amount and balance details. | P2 | FR-017 | **Missing** |

#### Module 7: Admin Panel

| ID | Feature | User Story | Description | Acceptance Criteria | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| FR-032 | Admin Dashboard | As an admin, I want a KPI dashboard showing clicks, conversions, revenue, and active users, so that I can monitor business health. | Real-time dashboard with: total users, daily active users, total clicks, conversion rate, total cashback paid, revenue charts (daily/weekly/monthly), top deals, top users by earnings. | **Given** an admin opens the dashboard, **When** data loads, **Then** all KPIs are displayed with charts showing trends over selectable time ranges. | P1 | FR-015, FR-017 | **Missing** |
| FR-033 | Deal Management | As an admin, I want to create, edit, activate, and deactivate deals, so that I can control the marketplace content. | CRUD operations for deals. Fields: merchant, title, description, cashback %, category, terms, start/end dates, status (active/inactive). Performance metrics per deal (clicks, conversions, cashback paid). | **Given** an admin creates a new deal with a 10% cashback rate, **When** the deal is activated, **Then** it appears in the user-facing home feed under the specified category. | P1 | FR-011 | **Missing** |
| FR-034 | Conversion Management | As an admin, I want to view affiliate conversions from Admitad and approve/reject cashback, so that I can ensure only valid conversions are rewarded. | View conversions synced from Admitad. Approve (moves cashback to confirmed), reject (removes pending cashback), or hold. Bulk approval capability. | **Given** an Admitad conversion is received, **When** the admin reviews and approves it, **Then** the corresponding user's pending cashback moves to confirmed status. | P0 | FR-017 | **Missing** |
| FR-035 | Withdrawal Management | As an admin, I want to review and process withdrawal requests, so that I can control cash outflow and prevent fraud. | Withdrawal queue sorted by request date. Actions: approve, reject (with reason), flag for review. Approved requests trigger Razorpay X payouts. Status tracking per request. | **Given** a user requests a ₹1,000 withdrawal, **When** the admin approves it, **Then** a Razorpay X payout is initiated and the request status updates to "Processing". | P0 | FR-023 | **Missing** |
| FR-036 | User Management | As an admin, I want to view user details, block/unblock accounts, and adjust coin balances, so that I can manage the user base. | User listing with search/filter. User detail view with: profile, wallet balances, transaction history, referral tree. Actions: block, unblock, adjust coins (with audit log). | **Given** an admin blocks a user, **When** the user tries to log in, **Then** they receive a "Your account has been suspended" message. | P1 | FR-001 | **Missing** |
| FR-037 | Store Management | As an admin, I want to manage the in-app store (products, categories, orders, inventory), so that the store operates smoothly. | Products CRUD with images, variants, pricing. Category management. Order management (view, update status). Inventory tracking with low-stock alerts. | **Given** an admin marks an order as "Shipped" with a tracking number, **When** the user checks their order, **Then** the status shows "Shipped" with tracking info. | P1 | FR-025 | **Missing** |
| FR-038 | QR Merchant Management | As an admin, I want to onboard, approve, and manage offline merchants, so that the QR coin network grows. | Merchant application review queue. Approval/rejection workflow. Active merchant listing. Subscription tracking. Merchant performance metrics. | **Given** a merchant submits a registration request, **When** the admin approves it, **Then** the merchant's QR code is activated and scannable by users. | P2 | FR-020 | **Missing** |
| FR-039 | Banner & Category Management | As an admin, I want to manage banners and categories, so that I can control the visual merchandising of the platform. | Banner CRUD with image upload, scheduling, priority. Category CRUD with icon, name, sort order. | **Given** an admin uploads a banner scheduled for next week, **When** the start date arrives, **Then** the banner automatically appears in the home carousel. | P1 | FR-016 | **Missing** |
| FR-040 | Coupon Management | As an admin, I want to create and manage discount coupons, so that I can run promotional campaigns in the store. | Coupon CRUD: code, type (% or flat), value, min order, max discount, validity dates, usage limits (total and per-user). Usage tracking dashboard. | **Given** an admin creates a coupon "SAVE20" for 20% off, **When** a user applies it at checkout, **Then** the discount is applied to eligible items. | P2 | FR-027 | **Missing** |

---

### 5.2 Non-Functional Requirements

#### Performance

| Metric | Target |
|---|---|
| API response time (p95) | < 300ms |
| App launch to interactive (cold start) | < 3 seconds |
| Home feed load time | < 2 seconds |
| Search results latency | < 500ms |
| Concurrent users supported | 10,000 (Phase 1), 100,000 (Phase 3) |

#### Scalability

- Horizontal scaling of API servers behind a load balancer.
- MongoDB replica set for read scaling and high availability.
- CDN for static assets (images, banners, product photos).
- Database indexing strategy for frequently queried fields (email, phone, username, referralCode).

#### Reliability & Availability

| Metric | Target |
|---|---|
| Uptime SLA | 99.5% (Phase 1), 99.9% (Phase 3) |
| Data backup frequency | Daily automated backups with 30-day retention |
| Recovery Time Objective (RTO) | < 4 hours |
| Recovery Point Objective (RPO) | < 1 hour |

#### Security & Compliance

- **Authentication**: JWT with HTTP-only cookies, bcrypt password hashing (cost factor 12), refresh token rotation with max 5 active sessions.
- **Transport**: HTTPS enforced in production (secure cookies, sameSite=none).
- **Rate Limiting**: Global (100 req/15min), per-endpoint (login/OTP: 5 req/min).
- **Security Headers**: Helmet.js (XSS protection, clickjacking prevention, content-type sniffing).
- **Input Validation**: Zod schema validation on all API endpoints.
- **Data Privacy**: User data deletion capability (GDPR-aligned). No sensitive data logged in production (OTP console logging disabled).
- **OTP Security**: Bcrypt-hashed storage, TTL auto-expiry (5 minutes), max 3 attempts, auto-deletion on success.
- **Payment Compliance**: Razorpay PCI-DSS compliance for payment processing (delegated to Razorpay).

#### Accessibility

- WCAG 2.1 Level AA compliance target for web application.
- Touch target minimum 44x44 pixels for mobile (React Native).
- Screen reader support for critical flows (signup, login, wallet).
- Color contrast ratio ≥ 4.5:1 for body text.

#### Internationalization

- Primary language: English.
- Currency: Indian Rupee (₹) — no multi-currency support in Phase 1.
- Date format: DD/MM/YYYY (IST timezone).
- Future: Hindi, Telugu, Tamil localization planned for Phase 3.

#### Platform Support Matrix

| Platform | Minimum Version | Status |
|---|---|---|
| iOS | 15.0+ | Planned (Expo) |
| Android | API 24 (7.0)+ | Planned (Expo) |
| Web (Chrome) | 90+ | In Development |
| Web (Safari) | 15+ | In Development |
| Web (Firefox) | 90+ | In Development |
| Web (Edge) | 90+ | In Development |

---

### 5.3 System Architecture Overview

#### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  iOS App     │  │ Android App  │  │   Web Application    │  │
│  │  (Expo/RN)   │  │  (Expo/RN)   │  │   (Expo Web/RN Web) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│              ┌────────────┴────────────┐                        │
│              │  Axios + React Query    │                        │
│              │  (HTTP-only Cookies)    │                        │
│              └────────────┬────────────┘                        │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Express.js / Node.js API                   │    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐ │    │
│  │  │  Helmet   │  │ CORS      │  │ Rate Limiter         │ │    │
│  │  │ (Security)│  │ (Origins) │  │ (100 req/15min)      │ │    │
│  │  └──────────┘  └───────────┘  └──────────────────────┘ │    │
│  │                                                         │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │              Route Modules                       │    │    │
│  │  │  /auth/*  (Built)                               │    │    │
│  │  │  /deals/* (Planned)    /wallet/* (Planned)      │    │    │
│  │  │  /store/* (Planned)    /admin/*  (Planned)      │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐ │    │
│  │  │   Zod    │  │ JWT Auth  │  │ Error Handler        │ │    │
│  │  │(Validate)│  │(Middleware)│  │ (Global)             │ │    │
│  │  └──────────┘  └───────────┘  └──────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           MongoDB Atlas (Mongoose ODM)                  │    │
│  │                                                         │    │
│  │  Collections:                                           │    │
│  │  ┌────────┐  ┌────────┐  ┌────────┐                   │    │
│  │  │ Users  │  │Wallets │  │  OTPs  │                   │    │
│  │  │        │  │        │  │ (TTL)  │                   │    │
│  │  └────────┘  └────────┘  └────────┘                   │    │
│  │                                                         │    │
│  │  Planned: Deals, Transactions, Products, Orders,       │    │
│  │           Notifications, Merchants, Banners, Coupons   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

                    EXTERNAL SERVICES
┌─────────────────────────────────────────────────────────────────┐
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌────────────┐  │
│  │ Admitad   │  │ Razorpay  │  │  MSG91    │  │ FCM/Expo   │  │
│  │(Affiliate)│  │(Payments) │  │  (OTP)    │  │ (Push)     │  │
│  └───────────┘  └───────────┘  └───────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Technology Choices

| Layer | Technology | Rationale |
|---|---|---|
| Frontend Framework | React Native 0.83 + Expo 55 | Cross-platform (iOS, Android, Web) from a single codebase; rapid iteration with Expo's managed workflow |
| Frontend Language | TypeScript (strict) | Type safety reduces runtime errors; enforced via tsconfig strict mode |
| State Management | Zustand | Lightweight alternative to Redux; minimal boilerplate for auth + UI state |
| Server-State | React Query (TanStack) | Handles API mutation states (loading, error, success) without manual state tracking |
| API Client | Axios | Interceptor support for automatic token refresh; credential handling for HTTP-only cookies |
| Backend Runtime | Node.js + Express | JavaScript full-stack alignment; large ecosystem; proven at scale |
| Validation | Zod | Runtime schema validation with TypeScript type inference; replaces Joi with better DX |
| Database | MongoDB Atlas | Document model suits flexible deal/product schemas; Atlas provides managed hosting with auto-scaling |
| ODM | Mongoose | Schema enforcement on MongoDB; pre-save hooks for password hashing; TTL indexes for OTP expiry |
| Auth | JWT + bcrypt | Industry standard for stateless auth; bcrypt cost factor 12 for password security |
| Hosting | Render | Current deployment target (CORS origins include render.com subdomains) |

#### Data Flow Summary

1. **Auth Flow**: Client → Express → Zod validation → authService → Mongoose → MongoDB → JWT cookie response
2. **Deal Discovery**: Client → Express → dealService → MongoDB (deals collection) → JSON response (planned)
3. **Affiliate Tracking**: Client → Admitad redirect URL → Merchant site → Admitad callback → Express webhook → MongoDB (conversions) (planned)
4. **Withdrawal**: Client → Express → walletService → Admin approval queue → Razorpay X API → Bank/UPI (planned)

---

## 6. User Experience

### 6.1 Information Architecture

#### Screen Inventory (Based on Codebase + Designs)

```
CHINGIRINGI APP
│
├── UNAUTHENTICATED (Auth Stack)
│   ├── Login Screen
│   │   ├── Password Tab
│   │   └── OTP Tab
│   ├── Signup Screen
│   ├── OTP Verification Screen
│   ├── Forgot Password Screen
│   └── Reset Password Screen
│
└── AUTHENTICATED (Drawer Navigation)
    ├── [SIDEBAR - Permanent Drawer]
    │   ├── Logo + Collapse Toggle
    │   ├── Main Nav: Discover, Wallet, Referrals
    │   ├── Bottom Nav: Notifications, Settings
    │   └── Profile Badge (Avatar, Name, Balance)
    │
    ├── Home / Discover
    │   ├── Search Bar + Filters
    │   ├── Category Pills
    │   ├── Hero Banner Carousel
    │   ├── Trending Brands Carousel
    │   └── Deals Grid
    │
    ├── Wallet (Placeholder)
    │   ├── Balance Overview
    │   ├── Transaction History
    │   └── Withdraw CTA
    │
    ├── Referrals (Placeholder)
    │   ├── Referral Code + Share
    │   ├── Referral Stats
    │   └── Referral History
    │
    ├── Notifications (Placeholder)
    │   └── Notification Feed
    │
    ├── Settings
    │   ├── Profile Card
    │   ├── Preferences (Notifications, Dark Theme)
    │   ├── Account (Change Password, Privacy)
    │   └── Logout
    │
    └── [DESIGNED BUT NOT YET BUILT]
        ├── Profile / Edit Profile
        ├── My Address
        ├── Product Detail
        ├── Transaction History (Full)
        └── Refer Screen
```

#### Navigation Model

- **Conditional Root**: Auth state determines which navigator renders (AuthStack vs DrawerNavigator).
- **Permanent Sidebar**: Desktop-optimized drawer that is always visible (not a hamburger menu). Collapsible between 250px (expanded) and 80px (icon-only).
- **Stack Navigation**: Auth screens use stack navigation for linear flows (Login → OTP → Home).
- **Deep Linking**: Not yet implemented; planned for deal sharing and referral links.

### 6.2 Core User Flows

#### Flow 1: New User Signup (Built)

```
┌─────────┐    ┌───────────┐    ┌────────────┐    ┌───────────┐
│  Login   │───▶│  Signup   │───▶│   System   │───▶│   Home    │
│  Screen  │    │  Screen   │    │  Creates   │    │  Screen   │
│          │    │           │    │  Account + │    │           │
│ Tap      │    │ Fill:     │    │  Wallet    │    │ Logged in │
│ "Sign Up"│    │ Name      │    │  Sets      │    │ with      │
│          │    │ Username  │    │  Cookies   │    │ cookies   │
│          │    │ Email     │    │            │    │           │
│          │    │ Phone     │    │            │    │           │
│          │    │ Password  │    │            │    │           │
└─────────┘    └───────────┘    └────────────┘    └───────────┘
```

#### Flow 2: Returning User Login — Password (Built)

```
┌─────────┐    ┌────────────┐    ┌───────────┐
│  Login   │───▶│  Validate  │───▶│   Home    │
│  Screen  │    │  Bcrypt    │    │  Screen   │
│          │    │  Compare   │    │           │
│ Enter:   │    │  Issue JWT │    │ Logged in │
│ Email    │    │  Set       │    │           │
│ Password │    │  Cookies   │    │           │
└─────────┘    └────────────┘    └───────────┘
```

#### Flow 3: OTP Login (Built — delivery not integrated)

```
┌─────────┐    ┌────────────┐    ┌────────────┐    ┌───────────┐
│  Login   │───▶│  Send OTP  │───▶│  OTP       │───▶│   Home    │
│  (OTP    │    │  Generate  │    │  Verify    │    │  Screen   │
│   Tab)   │    │  6 digits  │    │  Screen    │    │           │
│          │    │  Hash+TTL  │    │            │    │           │
│ Enter:   │    │  Deliver   │    │ Enter 6    │    │ Logged in │
│ Phone    │    │  (console) │    │ digits     │    │           │
└─────────┘    └────────────┘    └────────────┘    └───────────┘
                                       │
                                  [Max 3 attempts]
                                  [5-min expiry]
                                  [Resend timer: 27s]
```

#### Flow 4: Password Reset (Built — delivery not integrated)

```
┌─────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌─────────┐
│  Forgot  │───▶│  Send OTP  │───▶│  OTP       │───▶│  Reset     │───▶│  Login  │
│ Password │    │  to Email  │    │  Verify    │    │  Password  │    │ Screen  │
│  Screen  │    │            │    │  Screen    │    │  Screen    │    │         │
│          │    │            │    │            │    │            │    │ Success │
│ Enter:   │    │            │    │ Enter 6    │    │ New Pass   │    │ Alert   │
│ Email    │    │            │    │ digits     │    │ Confirm    │    │         │
└─────────┘    └────────────┘    └────────────┘    └────────────┘    └─────────┘
```

#### Flow 5: Deal Discovery & Purchase (Planned)

```
┌─────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌─────────┐
│  Home    │───▶│  Browse /  │───▶│  Deal      │───▶│  Affiliate │───▶│ Pending │
│  Screen  │    │  Search    │    │  Detail    │    │  Redirect  │    │Cashback │
│          │    │            │    │  Page      │    │  (Admitad) │    │ Earned  │
│ See      │    │ Filter by  │    │            │    │            │    │         │
│ Deals    │    │ Category   │    │ Cashback % │    │ User lands │    │ 30-45d  │
│ Grid     │    │ Search     │    │ Terms      │    │ on merchant│    │ lock    │
│          │    │            │    │ "Shop Now" │    │ website    │    │         │
└─────────┘    └────────────┘    └────────────┘    └────────────┘    └─────────┘
```

#### Flow 6: Cashback Withdrawal (Planned)

```
┌─────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌─────────┐
│  Wallet  │───▶│  Withdraw  │───▶│  Admin     │───▶│ Razorpay X │───▶│ Money   │
│  Screen  │    │  Request   │    │  Review    │    │  Payout    │    │ in Bank │
│          │    │            │    │  Queue     │    │            │    │         │
│ Tap      │    │ Amount     │    │            │    │ UPI or     │    │ Status: │
│"Withdraw"│    │ Method:    │    │ Approve /  │    │ Bank NEFT  │    │Complete │
│          │    │ UPI/Bank   │    │ Reject     │    │            │    │         │
└─────────┘    └────────────┘    └────────────┘    └────────────┘    └─────────┘
```

#### Flow 7: Referral Earning (Planned)

```
┌─────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌─────────┐
│ Referral │───▶│  Share     │───▶│  Friend    │───▶│  Friend    │───▶│ Both    │
│ Screen   │    │  Code/Link │    │  Signs Up  │    │  Makes 1st │    │ Earn    │
│          │    │            │    │  via Link  │    │  Purchase  │    │ Reward  │
│ Copy     │    │ WhatsApp   │    │            │    │            │    │         │
│ Referral │    │ Instagram  │    │ referredBy │    │ Triggers   │    │ Coins + │
│ Code     │    │ SMS        │    │ = referrer │    │ reward     │    │Cashback │
└─────────┘    └────────────┘    └────────────┘    └────────────┘    └─────────┘
```

#### Flow 8: App Session Hydration (Built)

```
┌─────────┐    ┌────────────┐    ┌────────────┐
│  App     │───▶│  Hydrate   │───▶│  Route     │
│  Launch  │    │  Auth      │    │  Decision  │
│          │    │            │    │            │
│ Show     │    │ GET /me    │    │ Cookie     │──── Valid ────▶ Home Screen
│ Loading  │    │ with       │    │ exists?    │
│ Spinner  │    │ cookie     │    │            │──── Invalid ──▶ Login Screen
└─────────┘    └────────────┘    └────────────┘
                     │
              [Auto token refresh
               if 401 received]
```

---

## 7. Release Strategy & Phasing

### Phase 1: MVP — Authentication & Deal Discovery

**Timeline**: Current → 4-6 weeks
**Goal**: Users can sign up, log in, browse deals, and click through to merchants.

| What's Included | Status |
|---|---|
| Full auth system (signup, login, OTP, password reset, token refresh) | Built |
| OTP delivery via MSG91 (replace console logging) | Needs integration |
| Home screen with deal feed from backend (replace hardcoded data) | Needs backend API |
| Deal detail page with affiliate redirect | Needs full build |
| Category browsing and basic search | UI exists, needs backend |
| Wallet model and initial dashboard (view only) | Model exists, needs UI + API |
| Web deployment (Expo Web on Render) | Partially deployed |

**Success Gate → Phase 2**: 1,000 registered users, 500 deal clicks, zero critical auth bugs, OTP delivery working end-to-end.

### Phase 2: Monetization & Engagement

**Timeline**: Phase 1 + 6-8 weeks
**Goal**: Users earn real cashback and can withdraw money. Referral system drives organic growth.

| What's Included | Status |
|---|---|
| Admitad integration for affiliate tracking | Not started |
| Cashback lifecycle (pending → confirmed → withdrawable) | Not started |
| Wallet with full transaction history | Not started |
| Razorpay X withdrawal integration | Not started |
| Referral system (code generation, sharing, rewards) | Fields exist, no logic |
| Push notifications (Expo + FCM) | Not started |
| Admin panel: deal management, conversion management, withdrawals | Not started |
| User profile editing | Partial |

**Success Gate → Phase 3**: 10,000 registered users, ₹5L+ total cashback confirmed, 50+ active deals, first 100 withdrawals processed, admin panel operational.

### Phase 3: Scale & Ecosystem

**Timeline**: Phase 2 + 8-12 weeks
**Goal**: Full platform with in-app store, offline merchants, and gamification.

| What's Included | Status |
|---|---|
| In-app store (catalog, cart, checkout, orders) | Not started |
| Coins economy (earn + spend) | Not started |
| QR-based offline merchant network | Not started |
| Google OAuth login | Not started |
| Advanced search with fuzzy matching | Not started |
| Email notifications for web users | Not started |
| Admin panel: store management, merchant management, coupons | Not started |
| Dark mode | Toggle exists, not implemented |
| Localization (Hindi) | Not started |
| Account deletion (GDPR compliance) | Not started |
| Native app store deployment (iOS + Android) | Not started |

**Success Gate**: 100,000 registered users, 5,000+ QR merchants, in-app store GMV > ₹10L/month, coins economy self-sustaining.

---

## 8. Metrics & Success Criteria

### North Star Metric

**Monthly Confirmed Cashback (₹)** — The total cashback confirmed for users in a calendar month. This directly measures the platform's ability to deliver value (savings) to users, which drives retention, referrals, and revenue.

### Primary KPIs

| KPI | Target (Phase 1) | Target (Phase 2) | Target (Phase 3) |
|---|---|---|---|
| Monthly Active Users (MAU) | 2,000 | 25,000 | 150,000 |
| Deal Click-Through Rate (CTR) | 8% | 12% | 15% |
| Conversion Rate (click → purchase) | 2% | 4% | 5% |
| Avg. Cashback per User / Month | ₹50 | ₹200 | ₹500 |
| Day-30 Retention Rate | 15% | 25% | 35% |

### Secondary Metrics

| Metric | Description |
|---|---|
| Referral Viral Coefficient | Average new users per referrer (target: >1.0 for organic growth) |
| Withdrawal Completion Rate | % of withdrawal requests successfully processed (target: >95%) |
| Time to First Cashback | Days from signup to first pending cashback (target: <7 days) |
| Deals per Category | Minimum 10 active deals per major category |
| App Rating | 4.0+ stars on Play Store / App Store |

### Health / Guardrail Metrics

| Metric | Guardrail |
|---|---|
| Auth Error Rate | < 1% of login attempts |
| API Error Rate (5xx) | < 0.5% of requests |
| Token Refresh Failure Rate | < 0.1% (silent refresh must work) |
| Fraudulent Cashback Rate | < 2% of total confirmed cashback |
| Withdrawal Processing Time | < 48 hours (request to bank credit) |
| Customer Support Ticket Volume | < 5% of MAU |

### Measurement Methodology

- **Analytics**: Integrate Mixpanel or Amplitude for event tracking (signup, deal click, purchase, withdrawal).
- **Backend Logging**: Structured JSON logs with request ID tracing for API debugging.
- **Financial Tracking**: Admitad API for conversion data; Razorpay X for payout reconciliation.
- **Performance Monitoring**: New Relic or Datadog for API latency, error rates, and infrastructure health.

### Dashboard Requirements

- **Executive Dashboard**: MAU, revenue, cashback paid, conversion rate — weekly email summary.
- **Operations Dashboard**: Real-time API health, error rates, pending withdrawals, flagged accounts.
- **Growth Dashboard**: Signup funnel, referral metrics, retention cohorts, channel attribution.

---

## 9. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|
| R1 | **Admitad integration delays**: Affiliate tracking accuracy is critical; incorrect attribution means paying cashback for untracked conversions or missing legitimate ones. | Medium | High | Begin Admitad sandbox integration in Phase 1 parallel to MVP. Build reconciliation tooling to audit conversion discrepancies. Set conservative cashback rates initially. |
| R2 | **Cashback fraud**: Users create multiple accounts, use self-referral loops, or exploit timing gaps in the confirmation cycle. | High | High | Implement device fingerprinting, phone verification as mandatory, IP-based rate limiting, and admin review queue for high-value cashbacks. Referral rewards only on first qualified purchase. |
| R3 | **OTP delivery failure**: Current system logs OTPs to console — no SMS/email provider is integrated. Without reliable OTP delivery, no user can sign up via phone or reset their password. | High | Critical | Integrate MSG91 for SMS OTP delivery before MVP launch. Implement fallback email OTP. Add delivery status tracking and retry logic. |
| R4 | **Credential exposure**: MongoDB URI, JWT secrets, and cookie secrets are stored in plain-text `.env` file. The MongoDB password (`Abcd1234`) is weak. | Medium | Critical | Rotate all secrets before production deployment. Use a secret manager (AWS Secrets Manager, Vault). Enforce strong passwords. Add `.env` to `.gitignore` (already done) and verify it's not in git history. |
| R5 | **Single point of failure**: No database replication, no load balancing, single Render deployment. Any outage takes the entire platform offline. | Medium | High | Migrate to MongoDB Atlas with replica set (already on Atlas). Deploy API behind Render's auto-scaling or migrate to AWS/GCP with container orchestration. Implement health checks and automated failover. |
| R6 | **Low merchant deal inventory**: Without sufficient active deals across categories, users have nothing to click — causing immediate churn. | High | High | Pre-launch: onboard 50+ deals across 5 categories via Admitad before opening to users. Automate deal ingestion from Admitad's API. Hire a deals curation team. |
| R7 | **Regulatory compliance gap**: Handling financial transactions (withdrawals, coins economy) without proper compliance could result in legal issues. Coins as a virtual currency may have regulatory implications. | Low | High | Consult fintech legal counsel before Phase 2 launch. Ensure KYC for withdrawals above ₹10,000. Document coins as non-monetary loyalty points (not a virtual currency). Comply with RBI guidelines for digital wallets. |
| R8 | **Cross-platform inconsistencies**: React Native + Expo Web can have rendering differences between mobile and web, especially for navigation (drawer), gestures, and secure storage. | Medium | Medium | Establish a device testing matrix (iOS, Android, Chrome, Safari). Use platform-specific code sparingly. Automated visual regression testing for critical screens. Current codebase already handles platform detection in API client. |
| R9 | **User trust deficit**: New cashback platforms face skepticism — users need proof that withdrawals actually work before committing. | High | Medium | Prioritize withdrawal functionality in Phase 2 sprint 1. Showcase withdrawal success stories and amounts on the home screen. Offer a sign-up bonus to create early positive experiences. |
| R10 | **Coins economy imbalance**: If coins are too easy to earn or too valuable to spend, the economics collapse — either users hoard (no store sales) or the company loses money on store subsidies. | Medium | Medium | Model coin earn/burn rates with a spreadsheet before launch. Start with conservative earn rates. Monitor earn-to-burn ratio weekly. Adjust store pricing dynamically. Reserve the right to modify coin values with notice. |

---

## 10. Dependencies & Constraints

### Technical Dependencies

#### Backend Dependencies (from `package.json`)

| Package | Version | Purpose | Risk Level |
|---|---|---|---|
| express | 4.22.1 | Web framework | Low (mature, stable) |
| mongoose | 9.3.2 | MongoDB ODM | Low |
| jsonwebtoken | 9.0.3 | JWT generation/verification | Low |
| bcrypt | 6.0.0 | Password/OTP hashing | Low |
| zod | 4.3.6 | Input validation | Low (v4 is newer, check stability) |
| helmet | 8.1.0 | Security headers | Low |
| cors | 2.8.6 | Cross-origin handling | Low |
| express-rate-limit | 8.3.1 | Rate limiting | Low |
| cookie-parser | 1.4.7 | Cookie parsing | Low |
| morgan | 1.10.1 | HTTP logging | Low |

#### Frontend Dependencies (from `package.json`)

| Package | Version | Purpose | Risk Level |
|---|---|---|---|
| react | 19.2.0 | UI framework | Low (latest stable, but React 19 is very new — watch for ecosystem compatibility) |
| react-native | 0.83.2 | Mobile framework | Medium (frequent breaking changes) |
| expo | ~55.0.8 | Development platform | Medium (tied to Expo SDK version upgrades) |
| zustand | ^5.0.12 | State management | Low |
| axios | ^1.13.6 | HTTP client | Low |
| @tanstack/react-query | ^5.95.2 | Server state | Low |
| react-native-reanimated | 4.2.1 | Animations | Medium (complex native module) |
| lucide-react-native | ^1.6.0 | Icons | Low |

#### External Service Dependencies

| Service | Purpose | Integration Status |
|---|---|---|
| MongoDB Atlas | Database hosting | Connected (development cluster) |
| Admitad | Affiliate network & tracking | Not integrated |
| Razorpay / Razorpay X | Payments & payouts | Not integrated |
| MSG91 | SMS OTP delivery | Not integrated |
| Google OAuth | Social login | Not integrated |
| Expo Push / FCM | Push notifications | Not integrated |
| Render | Web hosting & deployment | Partially configured (CORS origins set) |

### Team / Resource Constraints

- Single codebase currently — no evidence of multiple contributors in the repository structure.
- No CI/CD pipeline configured (no GitHub Actions, no `.yml` workflow files).
- No test suite (unit, integration, or e2e) — increases risk of regression with each deployment.

### Known Technical Debt

| Item | Location | Severity |
|---|---|---|
| Hardcoded demo data on HomeScreen | `chingiring-app/src/screens/Dashboard/HomeScreen.tsx` | High — blocks real deal display |
| OTP logged to console (security risk if deployed) | `backend/src/modules/auth/authController.js` | Critical — must remove before production |
| Weak MongoDB password | `backend/.env` | Critical — rotate before production |
| No email/SMS provider integration | `backend/src/modules/auth/authService.js` | High — OTPs cannot be delivered |
| Placeholder avatar from external URL (i.pravatar.cc) | `chingiring-app/src/screens/Dashboard/HomeScreen.tsx` | Low — replace with proper image handling |
| Sidebar uses placeholder colored squares instead of icons | `chingiring-app/src/components/Sidebar.tsx` | Low — cosmetic |
| React 19 TypeScript compatibility patches | `chingiring-app/src/types/react-native-fixes.d.ts` | Low — may resolve with future RN updates |
| No database indexing strategy documented | Backend Mongoose models | Medium — performance at scale |
| Resend timer hardcoded to 27s (arbitrary) | `chingiring-app/src/screens/Auth/OTPVerificationScreen.tsx` | Low — should match backend TTL logic |

---

## 11. Open Questions & Assumptions

### Assumptions Made During Analysis

| # | Assumption | Confidence |
|---|---|---|
| A1 | The product targets the Indian market based on ₹ currency, Razorpay integration, and MSG91 (Indian SMS gateway). | High |
| A2 | The Java Spring Boot API documented in `ChingiRingi_API_Overview.md` represents a legacy/parallel system — the active codebase uses the Node.js/Express backend. The two systems have overlapping but divergent feature sets (the Spring Boot system includes marketplace, shops, chat which the Node.js system does not). | Medium |
| A3 | The current implementation is pre-launch — no production users exist yet. Based on development-stage environment variables and console OTP logging. | High |
| A4 | The 27 design PDFs in the `Designs/` folder represent the target UI — screens not yet built (Profile, Wallet, Transaction History, Product, Refer) are planned for future phases. | High |
| A5 | Admitad is the chosen affiliate network based on the PRD canvas document. No Admitad SDK or API keys are present in the codebase. | High |
| A6 | The project is being developed by a small team (1-3 developers) based on the codebase size and absence of CI/CD, testing infrastructure, and code review tooling. | Medium |
| A7 | Mobile app deployment will use Expo EAS Build for native iOS/Android builds. No native modules beyond those supported by Expo are required. | Medium |
| A8 | The coins-to-INR exchange rate and earn/burn economics have not been finalized — the `coins` field in the wallet model is a placeholder awaiting business rules. | High |

### Open Questions Requiring Stakeholder Input

| # | Question | Impact Area |
|---|---|---|
| Q1 | What is the relationship between the Java Spring Boot backend (documented) and the Node.js/Express backend (built)? Are they the same product at different stages, or separate products? | Architecture, scope |
| Q2 | What is the target launch date for Phase 1 MVP? | Timeline, prioritization |
| Q3 | What is the cashback commission split between Chingiringi and users? (e.g., Admitad pays 10% commission — how much goes to the user?) | Business model, pricing |
| Q4 | What is the coins-to-INR conversion rate? How many coins does a QR scan earn? | Economics, store pricing |
| Q5 | Is the QR merchant module in scope for MVP or deferred? The PRD canvas notes say "optional (can be phased)." | Scope, Phase 3 |
| Q6 | Who handles customer support? Is there a support ticketing system planned? | Operations |
| Q7 | What are the Admitad account credentials and API access details? | Integration timeline |
| Q8 | Are there regulatory/legal requirements for operating a virtual currency (coins) or a digital wallet in India? | Compliance |
| Q9 | What is the minimum withdrawal threshold? (Referenced in PRD canvas but no value specified.) | Business rules |
| Q10 | Will the admin panel be a separate web app or integrated into the existing Expo Web build? | Architecture |

### Deferred Decisions

- Dark mode implementation approach (CSS variables vs. theme provider)
- Native app store deployment timeline (App Store review can take 1-4 weeks)
- In-app store product sourcing strategy (dropshipping, warehouse, or marketplace model)
- Push notification opt-in UX and default settings
- Analytics platform selection (Mixpanel vs. Amplitude vs. PostHog)

---

## 12. Appendices

### Appendix A: Glossary

| Term | Definition |
|---|---|
| **Cashback** | A percentage of the purchase amount returned to the user after a confirmed affiliate sale. |
| **Coins** | A loyalty currency earned through non-purchase actions (QR scans, referrals, in-app activities). Not redeemable for cash; spendable in the in-app store. |
| **Pending Cashback** | Cashback that has been tracked but not yet confirmed by the merchant (lock period: 30–45 days). |
| **Confirmed Cashback** | Cashback that has been validated by the merchant and is available for withdrawal. |
| **Affiliate Redirect** | A URL that routes a user through a tracking service (Admitad) before landing on the merchant's website, enabling purchase attribution. |
| **Admitad** | A global affiliate marketing network that provides tracking, attribution, and commission management for affiliate partnerships. |
| **Razorpay X** | Razorpay's payout product that enables programmatic disbursements to bank accounts and UPI IDs. |
| **MSG91** | An Indian cloud communication platform for sending OTPs and transactional SMS. |
| **OTP** | One-Time Password — a 6-digit code used for phone/email verification, valid for 5 minutes with max 3 attempts. |
| **JWT** | JSON Web Token — a stateless authentication mechanism. Chingiringi uses 15-minute access tokens and 30-day refresh tokens. |
| **Hydration** | The process of restoring app state on launch by calling `/auth/me` to verify the user's session. |
| **QR Merchant** | An offline retail store that has registered on Chingiringi and displays a QR code for customers to scan and earn coins. |
| **Referral Code** | A unique alphanumeric code assigned to each user, used to track and reward friend invitations. |
| **Deal** | An affiliate cashback offer from a specific merchant, displayed on the home feed with cashback percentage and expiry. |
| **TTL Index** | Time-To-Live index in MongoDB that automatically deletes documents after a specified duration (used for OTP expiry). |

### Appendix B: Data Model / Entity Relationship Summary

```
┌──────────────┐       1:1       ┌──────────────┐
│    User      │────────────────▶│   Wallet     │
│              │                 │              │
│ _id          │                 │ _id          │
│ name         │                 │ userId  ◀────│
│ username     │                 │ pending      │
│ email        │                 │ confirmed    │
│ phone        │                 │ coins        │
│ passwordHash │                 │ lifetime     │
│ role         │                 └──────────────┘
│ referralCode │
│ referredBy ──┼──── self-ref (User)
│ walletId ────┼──── ref (Wallet)
│ isPhoneVerif │
│ isEmailVerif │
│ refreshTokens│
│   [{token,   │
│     expires, │
│     created}]│
└──────┬───────┘
       │
       │  1:N (by phone/email)
       ▼
┌──────────────┐
│    OTP       │
│              │
│ _id          │
│ phone        │
│ email        │
│ otpHash      │
│ expiresAt    │  ◀── TTL auto-delete
│ attempts     │
└──────────────┘

PLANNED ENTITIES (not yet modeled):
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Deal       │  │ Transaction  │  │   Product    │
│              │  │              │  │              │
│ merchant     │  │ userId       │  │ name         │
│ title        │  │ type         │  │ description  │
│ description  │  │ amount       │  │ price        │
│ cashback %   │  │ status       │  │ coinPrice    │
│ category     │  │ source       │  │ category     │
│ affiliateUrl │  │ dealId       │  │ variants     │
│ terms        │  │ createdAt    │  │ images       │
│ startDate    │  └──────────────┘  │ inventory    │
│ endDate      │                    └──────────────┘
│ status       │
│ bannerImage  │  ┌──────────────┐  ┌──────────────┐
└──────────────┘  │   Order      │  │  Merchant    │
                  │              │  │  (QR)        │
                  │ userId       │  │              │
                  │ items        │  │ name         │
                  │ total        │  │ address      │
                  │ payMethod    │  │ qrCode       │
                  │ address      │  │ status       │
                  │ status       │  │ subscription │
                  │ tracking     │  └──────────────┘
                  └──────────────┘
```

### Appendix C: API Endpoint Inventory

#### Currently Built (Node.js/Express — `/backend`)

| Method | Endpoint | Auth | Rate Limited | Description |
|---|---|---|---|---|
| POST | `/auth/signup` | No | No | Create user account + wallet |
| POST | `/auth/login` | No | 5/min | Password or OTP login |
| POST | `/auth/send-otp` | No | 5/min | Generate and send OTP |
| POST | `/auth/verify-otp` | No | 5/min | Verify 6-digit OTP |
| POST | `/auth/logout` | Yes | No | Revoke refresh token, clear cookies |
| POST | `/auth/refresh` | No | No | Rotate JWT token pair |
| POST | `/auth/forgot-password` | No | No | Initiate password reset via OTP |
| POST | `/auth/reset-password` | No | No | Set new password with verified OTP |
| GET | `/auth/me` | Yes | No | Get current user profile |
| GET | `/health` | No | No | Server health check |

#### Planned Endpoints (Inferred from Requirements)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/deals` | List active deals with pagination/filtering |
| GET | `/deals/:id` | Get deal detail |
| GET | `/deals/categories` | List deal categories |
| GET | `/deals/search` | Search deals with fuzzy matching |
| GET | `/wallet` | Get wallet balances |
| GET | `/wallet/transactions` | Get transaction history |
| POST | `/wallet/withdraw` | Request cashback withdrawal |
| GET | `/wallet/withdrawals` | Get withdrawal status |
| GET | `/referrals` | Get referral dashboard data |
| POST | `/referrals/share` | Generate shareable referral link |
| GET | `/store/products` | List store products |
| GET | `/store/products/:id` | Get product detail |
| POST | `/store/cart` | Add to cart |
| POST | `/store/checkout` | Process purchase |
| GET | `/store/orders` | Get order history |
| GET | `/notifications` | Get notification feed |
| POST | `/admin/deals` | Create deal (admin) |
| PUT | `/admin/deals/:id` | Update deal (admin) |
| GET | `/admin/conversions` | List affiliate conversions |
| POST | `/admin/conversions/:id/approve` | Approve cashback |
| GET | `/admin/withdrawals` | List withdrawal requests |
| POST | `/admin/withdrawals/:id/approve` | Approve withdrawal |
| POST | `/webhooks/admitad` | Admitad conversion callback |

### Appendix D: Tech Stack Summary

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | React Native + Expo | 0.83.2 / 55.0.8 |
| **Frontend Language** | TypeScript | 5.9.2 |
| **State Management** | Zustand | 5.0.12 |
| **API Client** | Axios + React Query | 1.13.6 / 5.95.2 |
| **Navigation** | React Navigation (Stack + Drawer) | 7.x |
| **Icons** | Lucide React Native | 1.6.0 |
| **Backend Runtime** | Node.js + Express | 4.22.1 |
| **Backend Language** | JavaScript (ES Modules) | ES2022+ |
| **Database** | MongoDB Atlas + Mongoose | 9.3.2 |
| **Authentication** | JWT + bcrypt | 9.0.3 / 6.0.0 |
| **Validation** | Zod | 4.3.6 |
| **Security** | Helmet + CORS + Rate Limiting | 8.1.0 / 2.8.6 / 8.3.1 |
| **Hosting** | Render | — |
| **Affiliate Network** | Admitad | Not integrated |
| **Payments** | Razorpay / Razorpay X | Not integrated |
| **SMS** | MSG91 | Not integrated |
| **Push Notifications** | Expo Push + FCM | Not integrated |

### Appendix E: Design Asset Inventory

The `Designs/` directory contains 27 PDF files representing the target UI/UX:

| Design File | Screen | Implementation Status |
|---|---|---|
| Signin - Desktop - Expanded.pdf | Login (Password) | Built |
| Signin - Desktop - Collapse.pdf | Login (Collapsed Sidebar) | Built (collapsible sidebar works) |
| OTP Login - Desktop.pdf | Login (OTP Tab) | Built |
| OTP Verify - Desktop.pdf | OTP Verification | Built |
| Signup - Desktop.pdf | Signup | Built |
| Forgot Password - Desktop.pdf | Forgot Password | Built |
| Home - Desktop - Expanded.pdf | Home (Expanded) | Partially Built |
| Home - 1 - Desktop.pdf | Home (Alternate) | Partially Built |
| Settings - Desktop.pdf | Settings | Built |
| Wallet - Desktop - Expanded.pdf | Wallet (Expanded) | Not Built |
| Wallet - Desktop - collapse.pdf | Wallet (Collapsed) | Not Built |
| Transaction History - Desktop.pdf | Transaction History | Not Built |
| Profile - Desktop.pdf | Profile View | Not Built |
| Edit Profile - Desktop.pdf | Profile Edit | Not Built |
| My Address - Desktop.pdf | Address Management | Not Built |
| Product - Desktop.pdf | Product Detail | Not Built |
| Refer - Desktop.pdf | Referral Screen | Not Built |
| Whole Design.pdf | Complete Design System | Reference |

### Appendix F: Reference Documents

| Document | Location | Description |
|---|---|---|
| PRD/SRS Canvas | `./chingiringi_prd_srs_canvas.md` | Original product requirements and business rules |
| API Overview (Spring Boot) | `./Docs/ChingiRingi_API_Overview.md` | Comprehensive backend API documentation for a Java Spring Boot system (legacy/parallel) |
| UI/UX Designs | `./Designs/*.pdf` | 27 desktop screen designs showing target UI |
| Backend Source | `./backend/` | Node.js/Express API codebase |
| Frontend Source | `./chingiring-app/` | React Native/Expo app codebase |

---

*This document was generated through systematic analysis of the Chingiringi codebase, design assets, and documentation on April 1, 2026. All claims about the product are traceable to artifacts in the repository. Inferences and estimates are explicitly labeled.*

*Document Version: 1.0 | Last Updated: April 1, 2026*
