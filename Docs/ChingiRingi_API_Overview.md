# Chingi Ringi Backend - Complete System Documentation

## Executive Summary

Chingi Ringi is a comprehensive multi-feature marketplace and community platform built with Java Spring Boot. The application supports user authentication, classified marketplaces for buying/selling items, business affiliate networks for content creators, shop management with earnings tracking, and a rewards/loyalty system with scratch cards and coupons.

---

## System Architecture Overview

### Core Modules

The backend is organized into 7 major functional domains:

1. **User Management** - Authentication, profiles, and user operations
2. **Marketplace (eComm)** - Buying/selling physical items and properties 
3. **Business Affiliates** - Social content, posts, reviews, and community engagement
4. **Shop Management** - Vendor registration, shop profiles, and KYC verification
5. **Payment & Rewards** - Wallet management, scratch cards, coupons, and earnings
6. **Admin Management** - Site-wide administration and content moderation
7. **Chat & Communication** - Direct messaging between marketplace participants

---

## USER MANAGEMENT & AUTHENTICATION

### Purpose
Handles user registration, login, profile management, and account security with OTP-based verification.

### API Endpoints

#### Registration & Authentication (Open - No Login Required)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/open/user/register` | POST | Register a new user with phone, email, password, and profile info |
| `/open/validate/otp/registration` | POST | Validate OTP to confirm phone number during registration |
| `/open/user/login` | POST | Login user with phone number and password |
| `/open/validate/otp/login` | POST | Validate OTP for login verification (combined with registration) |
| `/open/admin/login` | POST | Admin-specific login endpoint |
| `/open/send/otp/forgot-password` | POST | Request OTP reset for forgotten password |
| `/open/validate/otp/forgot-password` | POST | Verify OTP and reset password |
| `/open/change-password` | POST | Change password after verification |

#### Profile Management (Secured - Login Required)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/update/profile` | POST | Update user profile (name, email, bio, pincode, profile picture) |
| `/secured/update/password` | POST | Update password for logged-in user with old password verification |
| `/secured/send/otp/update-phone` | POST | Request OTP to change phone number |
| `/secured/validate/otp/update-phone` | POST | Verify OTP and change phone number |
| `/secured/get-user` | POST | Get self profile or visit another user's profile |
| `/secured/get-self` | POST | Get current user's complete profile |
| `/secured/user/logout` | POST | Logout user and clear device tokens |

#### User Management (Admin Only)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/user/get` | POST | List all users with search and sort options |
| `/admin/user/deactivate` | POST | Deactivate/suspend a user account |
| `/admin/user/delete` | POST | Permanently delete a user account |

### Database Models

**UserInfo** - Core user account with authentication
- User ID, phone number, encrypted password
- Email, name, location, pincode
- Profile picture, bio
- Account status (active/deleted)
- Device info for notifications

**UserDeviceToken** - Push notification management
- Device ID and FCM token for push notifications
- Device type and login tracking

**UserActivity** - User engagement tracking
- Posts created, items listed
- Interactions: likes, bookmarks, shares
- Activity timestamps

---

## MARKETPLACE (Buy/Sell Items & Properties)

### Purpose
A classified marketplace where users can list, browse, search, and interact with items for sale. Supports regular items, real estate properties, and special offers. Includes wishlisting, reviews, and reporting features.

### API Endpoints

#### Item Management (User Operations)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/market/create-item` | POST | Create a new item listing with details, images, and optional housing info |
| `/secured/market/edit-item` | POST | Update item details, price, condition, description |
| `/secured/market/delete-item` | POST | Remove item listing from marketplace |
| `/secured/market/item/add-video` | POST | Add video link to item listing |
| `/secured/market/item/delete-video` | POST | Remove video from item |
| `/secured/market/get-self` | POST | Get all items listed by current user |

#### Item Discovery & Browsing
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/market/get-categories` | GET | Get all product categories and subcategories |
| `/secured/market/get-trending` | POST | Get trending/popular items based on views |
| `/secured/market/get-home-items` | POST | Get items near user's location for homepage |
| `/secured/market/get-all-items` | POST | Get all items with pagination |
| `/secured/market/get-category-items` | POST | Filter items by category with search, price, condition, date filters |
| `/secured/market/get-item` | POST | Get detailed information about specific item |

#### Item Interactions
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/market/wishlist-item` | POST | Add item to wishlist for later viewing |
| `/secured/market/get-wishlisted` | POST | Get all items user has wishlisted |
| `/secured/market/like-item` | POST | Like/favorite an item |
| `/secured/market/share-item` | POST | Share item (triggers reward points) |

#### Item Reviews & Feedback
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/market/item/add-review` | POST | Write review/rating for item |
| `/secured/market/item/get-reviews` | POST | Get all reviews for an item |
| `/secured/market/item/delete-review` | POST | Delete own review |
| `/secured/market/item/review/add-reply` | POST | Reply to someone's review |
| `/secured/market/item/review/get-replies` | POST | Get all replies to a review |
| `/secured/market/item/review/delete-reply` | POST | Delete reply to review |

#### Reporting & Admin Moderation
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/market/report-item` | POST | Report inappropriate/fraudulent item |
| `/admin/market/get-reported-items` | POST | View all reported items (Admin) |
| `/admin/market/get-item-reports` | POST | Get specific reports for an item (Admin) |
| `/admin/market/delete-report` | POST | Delete/dismiss report (Admin) |

### Item Chat/Direct Messaging
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/market/chat/start-chat` | POST | Initiate conversation with item seller |
| `/secured/market/chat/get-chats` | POST | Get list of active conversations |
| `/secured/market/chat/send-message` | POST | Send message in conversation |
| `/secured/market/chat/get-messages` | POST | Get message history for chat |
| `/secured/market/chat/delete-message` | POST | Delete message from conversation |

### Database Models

**ItemInfo** - Core item listing
- Title, description, price, condition
- Category and subcategory
- Images, videos, thumbnail
- Location, pincode, contact info
- Buyer/seller details

**ItemDetails** - Item-specific attributes
- Color, variants, quantity

**ItemHouseInfo** - Real estate specific details
- Property type, bedrooms, area
- Furniture, amenities, listing type

**ItemWishlist** - User's saved items

**ItemReport** - Flagged inappropriate content

**ItemReview & ItemReviewReply** - Community feedback

---

## BUSINESS AFFILIATES (Social Content & Community)

### Purpose
A content creation platform where users (affiliates) can share posts with images, tag them for discovery, and engage through likes, comments, and reviews. Includes influencer features like referral banners and content monetization.

### API Endpoints

#### Post Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/affiliates/create-post` | POST | Create new post with description, images, location tags |
| `/secured/affiliates/edit-post` | POST | Update post content and tags |
| `/secured/affiliates/delete-post` | POST | Remove post from platform |
| `/secured/affiliates/post/add-image` | POST | Add additional image to post |
| `/secured/affiliates/post/delete-image` | POST | Remove image from post |

#### Post Discovery & Browsing
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/affiliates/get-posts` | POST | Get posts feed with shop filtering |
| `/secured/affiliates/get-self` | POST | Get all posts created by current user |
| `/secured/affiliates/get-bookmarked` | POST | Get user's saved/bookmarked posts |
| `/secured/affiliates/get-liked` | POST | Get posts the user has liked |
| `/secured/affiliates/get-commented` | POST | Get posts user has commented on |

#### Post Interactions
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/affiliates/like-post` | POST | Like/upvote a post |
| `/secured/affiliates/bookmark-post` | POST | Save post for later viewing |
| `/secured/affiliates/post/add-review` | POST | Write comment/review on post |
| `/secured/affiliates/post/get-reviews` | POST | Get all comments on a post |
| `/secured/affiliates/post/delete-review` | POST | Delete own comment |
| `/secured/affiliates/post/review/add-reply` | POST | Reply to a comment |
| `/secured/affiliates/post/review/get-replies` | POST | Get replies to a comment |
| `/secured/affiliates/post/review/delete-reply` | POST | Delete reply to comment |

#### Tags & Discovery
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/affiliates/get-tags` | GET | Get trending tags for content discovery |
| `/secured/affiliates/search-tags` | POST | Search for tags by keyword |

#### Post Management (Admin)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/affiliates/post/get-reported` | POST | View reported posts (Admin) |
| `/admin/affiliates/post/get-reports` | POST | Get report details for a post (Admin) |
| `/admin/affiliates/post/delete-report` | POST | Dismiss report (Admin) |

#### Content Reporting
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/affiliates/report-post` | POST | Report inappropriate post content |

#### Activities & Analytics
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/affiliates/get/user-activities` | POST | Get user's activity history |

#### Monetization Features
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/affiliates/get-banners` | POST | Get promotional banners for content |
| `/admin/affiliates/add-banner` | POST | Create banner for promotion (Admin) |
| `/admin/affiliates/edit-banner` | POST | Update banner (Admin) |
| `/admin/affiliates/delete-banner` | POST | Remove banner (Admin) |

### Database Models

**BAPostInfo** - Business Affiliate Post
- Title, description, location
- Associated shop/merchant
- Creation and update timestamps

**BAPostImage** - Post media
- Image links for each post

**BAPostInteraction** - User engagement
- Likes, bookmarks, shares tracking

**BAPostReview & BAPReviewReply** - Comments and replies

**BAPostReport** - Content moderation

**TagInfo & BAPostTagMapping** - Post categorization

**BannerInfo** - Digital advertising content

---

## SHOP MANAGEMENT

### Purpose
Allows vendors to register their shops/businesses, manage business profile, create KYC verification records, and track earnings. Shops can issue coupons and monitor customer purchases.

### API Endpoints

#### Shop Registration & Profile
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/shop/register` | POST | Register new shop with business details |
| `/secured/shop/update-info` | POST | Update shop name, contact, address, description, images |
| `/secured/shop/get-shop` | POST | Get shop profile information |

#### Shop Administration (Admin)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/shop/get-requests` | POST | View pending shop registration requests |
| `/admin/shop/interact-request` | POST | Approve or reject shop registration |
| `/admin/shop/get` | POST | List all shops with search/sort |
| `/admin/shop/delete` | POST | Deactivate shop account |
| `/admin/shop/deactivate` | POST | Temporarily disable shop |

#### Coupon Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/shop/coupon/add` | POST | Create discount coupon with validity period |
| `/secured/shop/coupon/get` | POST | Get all coupons issued by shop |
| `/secured/shop/coupon/delete` | POST | Remove coupon |

### Database Models

**ShopInfo** - Shop profile
- Shop name, contact number, address
- Website, images
- Description

**ShopKycDetail** - Verification documents
- KYC status and documents

**ShopCouponInfo** - Discount codes
- Coupon details, usage count, validity

---

## PAYMENT, REWARDS & LOYALTY SYSTEM

### Purpose
Manages user earnings, wallet transactions, reward distribution through scratch cards, coupon redemption, and referral rewards. Tracks user spending and shop earnings for financial management.

### API Endpoints

#### Scratch Cards (Gamified Rewards)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/pay/get-scratch-cards` | POST | Get available scratch cards for user to open |
| `/secured/pay/scratch-card` | POST | Open/scratch a card to reveal reward (coins or coupon) |

#### Coupon Redemption
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/pay/get-coupons` | POST | Get available coupons user can use |
| `/secured/pay/redeem-coupon` | POST | Use coupon to get discount on purchase |
| `/secured/pay/redeem-coins` | POST | Spend wallet coins at a shop |

#### Earnings & Spending Tracking
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/pay/get-user-earning` | POST | View user's earnings history and logs |
| `/secured/pay/get-user-spending` | POST | View user's spending/transaction history |
| `/secured/pay/shop/get-shop-earning` | POST | Get shop's earnings and transaction logs |

#### Content Monetization
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/secured/pay/share-post` | POST | Share affiliate post (earns reward points) |

### Database Models

**UserEarningsLog** - Income tracking
- Earnings source, amount, timestamp
- Item info associated with earning

**UserScratchCards** - Reward state
- Scratch card assignment to user
- Open/closed status, reward details

**ShopCouponInfo** - Discount inventory
- Per-shop coupon data

**UserRedeemInfo** - Redemption history
- Coupons used, coins spent

---

## ADMIN DASHBOARD & MODERATION

### Purpose
Provides administrators with tools to moderate content, manage users, handle shop registrations, and oversee reported items and posts.

### Key Admin Operations

**User Management**
- List and search users
- Deactivate/suspend problematic users
- Delete accounts

**Shop Management**
- Review shop registration requests
- Approve/reject new shops
- Manage shop status

**Content Moderation**
- View reported items and posts
- Review report reasons
- Delete inappropriate content

**Analytics Access**
- View all users, shops, items
- Filter and search capabilities
- Report generation

---

## TECHNICAL COMPONENTS & ARCHITECTURE

### Controller Layer (Request Handlers)

Controllers are organized by domain and permission level:

```
UserOpenController         → Public auth & registration (no login needed)
UserSecuredController      → User account operations (requires login)
UserAdminController        → User management (admin only)
UserChatController         → Messaging operations
UserS3FileSystemController → File upload handling

ItemsSecuredController     → Marketplace item operations
ItemsAdminController       → Item moderation

BASecuredController        → Business affiliate operations
BAAdminController          → Post moderation

ShopSecuredController      → Shop operations
ShopAdminController        → Shop registration & management

PayController              → Payment & rewards
PayAdminController         → Payment administration
CouponsController          → Coupon management
```

### Service Layer (Business Logic)

Services contain the core business logic and database operations:

```
UserService                → Authentication, profiles, password reset
ItemService                → CRUD for marketplace items
BusinessAffiliateService   → Posts, reviews, tags
ShopService                → Shop registration, profiles
PaymentService             → Earnings, wallets, transactions
CouponService              → Coupon management
NotificationService        → Push notifications, alerts
```

### Data Layer (Database Models)

```
User Domain:
├── UserInfo (user accounts)
├── UserDeviceToken (device registration)
└── UserActivity (engagement tracking)

Marketplace Domain:
├── ItemInfo (listings)
├── ItemDetails (attributes)
├── ItemHouseInfo (real estate)
├── ItemWishlist (saved items)
├── ItemReport (flagged content)
├── ItemReview (ratings & comments)
└── ItemReviewReply (comment threads)

Business Affiliate Domain:
├── BAPostInfo (posts)
├── BAPostImage (media)
├── BAPostInteraction (engagement)
├── BAPostReview (comments)
├── BAPReviewReply (reply threads)
├── BAPostReport (flagged posts)
├── TagInfo (content tags)
└── BannerInfo (promotional banners)

Shop Domain:
├── ShopInfo (shop profiles)
├── ShopKycDetail (verification)
└── ShopCouponInfo (discount codes)

Payment Domain:
├── UserEarningsLog (income tracking)
├── UserScratchCards (rewards)
└── UserRedeemInfo (redemption history)
```

### Authentication & Security

**JWT-Based Authorization**
- Each API request (except `/open/*`) requires Bearer token
- Token contains: phone number, user role, expiration
- Roles: 0 (admin), 1 (regular user)

**OTP Verification**
- Phone-based OTP for registration and login
- OTP sent via SMS
- Test account: 0000000000 (always works for testing)

**User Roles**
- **Admin**: Full system access, moderation capabilities
- **User**: Limited to own data and user-facing features

---

## KEY FEATURES & CAPABILITIES

### 1. Dual Marketplace
- **Item Marketplace**: Buy/sell used items with detailed listings
- **Real Estate**: Special handling for property listings with amenities, bedrooms, area details

### 2. Community Engagement
- Social post creation and sharing
- Comment threads with nested replies
- Engagement metrics (likes, bookmarks, shares)

### 3. Vendor Management
- Shop registration and approval workflow
- Business profile management
- KYC verification support

### 4. Gamified Rewards
- Scratch cards with randomized rewards
- Referral programs with earning tracking
- Coupon distribution system

### 5. Direct Communication
- In-app messaging between buyers and sellers
- Real-time chat for item inquiries

### 6. Content Moderation
- User reporting for inappropriate content
- Admin review and action workflows
- Content removal system

---

## IMPLEMENTATION STATUS

### Fully Implemented & Working ✅
- User authentication with OTP verification
- Item listing and search functionality
- User profiles and updates
- Shop registration and management
- Business affiliate content posting
- Comment systems with nested replies
- Scratch card system
- Coupon redemption
- Earnings tracking
- Direct messaging between users
- Admin moderation tools
- Chat functionality
- Tag-based content discovery
- User activity tracking

### Recently Updated (2023)
- Added thumbnail support for items
- Item video uploads (instead of images)
- Notification improvements
- Scratch card reward logic updates
- Spending/earning history refinements

---

## DATABASE STRUCTURE SUMMARY

The system uses a relational database (appears to be MySQL/MariaDB) with normalized tables for:
- User accounts and authentication
- Marketplace items with images/videos
- User interactions (likes, bookmarks, wishlist)
- Comments and reviews with threaded replies
- Shop and vendor information
- Earnings and spending logs
- Scratch card inventory
- Coupon distribution

---

## CONCLUSION

Chingi Ringi is a **comprehensive, feature-rich, multi-domain platform** that combines classifieds marketplace functionality with social community features and a built-in rewards system. The architecture is well-organized with clear separation of concerns across controllers, services, and data models. All major features are implemented and actively used, with recent improvements continuing to enhance the user experience.