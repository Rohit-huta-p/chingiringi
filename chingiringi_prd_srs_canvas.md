# Chingiringi — Product Requirements Document (PRD) / SRS

## 1. Product Overview
Chingiringi is a multi-platform affiliate cashback and rewards marketplace combining:
- Affiliate cashback engine
- Coins-based loyalty system
- In-app physical product store
- QR-based offline merchant network

Users earn cashback and coins via purchases, referrals, and QR scans. Merchants gain qualified traffic and measurable conversions.

---

## 2. Platforms
- Android App
- iOS App
- Web Application
- Admin Panel

---

## 3. Core Modules

### 3.1 Authentication
- OTP login (MSG91)
- Email/password login
- Google login
- JWT session + refresh tokens
- Auto-login

---

### 3.2 Deal Discovery
- Home feed with banners
- Category-based browsing
- Filters (category, cashback %, merchant)
- Search with typo correction
- Deal detail page
- Affiliate tracking redirect

---

### 3.3 Earning System
#### Cashback
- Pending (30–45 days lock)
- Confirmed
- Withdrawable

#### Coins
- Earn via QR scans, referrals, actions
- Balance + history

#### Referral System
- Unique referral code
- Shareable links
- Referral dashboard
- Rewards on first purchase

---

### 3.4 Wallet & Withdrawals
- Wallet balances:
  - Pending cashback
  - Confirmed cashback
  - Coins
- Transaction history
- Withdrawal via Razorpay X (UPI + Bank)
- Minimum withdrawal threshold
- Withdrawal tracking

---

### 3.5 In-App Store
#### Catalog
- Categories
- Product listing
- Product details with variants

#### Purchase Flow
- Cart (persistent)
- Checkout
- Coupon codes
- Payment options:
  - Coins
  - Razorpay
  - Mixed

#### Orders
- Order history
- Order tracking

---

### 3.6 Notifications
- Push (Expo + FCM)
- In-app notifications
- Email (web)

Triggers:
- Cashback updates
- Deals
- Withdrawals
- Orders
- Referrals

---

### 3.7 User Profile
- Profile management
- Addresses
- Wallet & transactions
- Referral dashboard
- Logout / delete account

---

## 4. Web Application
Mirrors mobile functionality:
- Authentication (cookies)
- Deal browsing
- Wallet & withdrawals
- Store & checkout
- Profile & settings
- Email notifications

---

## 5. Admin Panel

### 5.1 Dashboard
- KPIs (clicks, conversions, revenue, users)
- Revenue charts
- Top deals & users

### 5.2 Deal Management
- Create/edit deals
- Activate/deactivate
- Performance tracking

### 5.3 Conversion Management
- View conversions (Admitad)
- Approve/reject cashback
- Bulk approval

### 5.4 Withdrawal Management
- Request queue
- Razorpay payouts
- Status tracking

### 5.5 User Management
- User listing & details
- Block/unblock
- Manual coin adjustments

### 5.6 Store Management
- Products CRUD
- Categories
- Orders
- Inventory

### 5.7 QR Merchant Management
- Merchant onboarding
- Approval/rejection
- Subscription tracking

### 5.8 Banner & Categories
- Banner upload & scheduling
- Category management

### 5.9 Coupons
- Create/edit coupons
- Usage tracking

---

## 6. Payments & Integrations
- Razorpay / Razorpay X
- Admitad (affiliate tracking)
- MSG91 (OTP)
- Google Login
- Expo + FCM (push notifications)

---

## 7. Non-Functional Requirements
- Scalable architecture
- Secure authentication (JWT)
- High availability
- Data consistency in wallet
- Fraud prevention (cashback validation)

---

## 8. Business Rules
- Cashback lock period: 30–45 days
- Withdrawal requires admin approval
- Minimum withdrawal threshold configurable
- Coins usable for store purchases

---

## 9. Ownership & Compliance
- Full source code ownership to client
- No developer lock-in
- Full admin + infra access
- NDA compliance

---

## 10. Payment Terms (Project)
- 30% advance
- 40% beta completion
- 30% final delivery

---

## 11. Deliverables
- Mobile apps (Android + iOS)
- Web app
- Admin panel
- Source code (GitHub)
- Documentation
- Credentials

---

## 12. Notes
- QR merchant module optional (can be phased)
- Coins economy must be balanced
- Affiliate tracking reliability is critical

---

(Source: Uploaded document) fileciteturn0file0

