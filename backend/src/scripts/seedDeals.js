import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Category from '../modules/categories/categoryModel.js';
import Deal from '../modules/deals/dealModel.js';
import Banner from '../modules/banners/bannerModel.js';

const categories = [
  { name: 'Fashion', slug: 'fashion', icon: 'shirt', sortOrder: 1 },
  { name: 'Electronics', slug: 'electronics', icon: 'smartphone', sortOrder: 2 },
  { name: 'Food & Dining', slug: 'food-dining', icon: 'utensils', sortOrder: 3 },
  { name: 'Health & Beauty', slug: 'health-beauty', icon: 'heart', sortOrder: 4 },
  { name: 'Home & Living', slug: 'home-living', icon: 'home', sortOrder: 5 },
  { name: 'Travel', slug: 'travel', icon: 'plane', sortOrder: 6 },
  { name: 'Groceries', slug: 'groceries', icon: 'shopping-cart', sortOrder: 7 },
  { name: 'Entertainment', slug: 'entertainment', icon: 'tv', sortOrder: 8 },
];

const seedDB = async () => {
  try {
    await connectDB();

    // Clear existing data
    await Category.deleteMany({});
    await Deal.deleteMany({});
    await Banner.deleteMany({});

    // Seed categories
    const createdCategories = await Category.insertMany(categories);
    console.log(`Seeded ${createdCategories.length} categories`);

    const catMap = {};
    createdCategories.forEach((c) => (catMap[c.slug] = c._id));

    // Seed deals
    const now = new Date();
    const inDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

    const deals = [
      {
        title: 'Flat 20% Cashback on Fashion',
        description: 'Shop the latest trends and get 20% cashback on all orders above ₹999.',
        brand: 'Myntra',
        category: catMap['fashion'],
        cashbackPercent: 20,
        affiliateUrl: 'https://www.myntra.com',
        lockPeriodDays: 30,
        expiresAt: inDays(15),
        tags: ['fashion', 'trending'],
        isFeatured: true,
        termsAndConditions: 'Valid on orders above ₹999. Cashback will be credited after the return period.',
      },
      {
        title: 'Up to 12% Cashback on Electronics',
        description: 'Get cashback on mobiles, laptops, and accessories.',
        brand: 'Amazon',
        category: catMap['electronics'],
        cashbackPercent: 12,
        affiliateUrl: 'https://www.amazon.in',
        lockPeriodDays: 45,
        expiresAt: inDays(30),
        tags: ['electronics', 'mobiles'],
        isFeatured: true,
        termsAndConditions: 'Applicable on select products. Excludes Amazon devices.',
      },
      {
        title: '50% Off on First Order',
        description: 'Order food online and get 50% off up to ₹100 on your first order.',
        brand: 'Swiggy',
        category: catMap['food-dining'],
        cashbackPercent: 5,
        flatCashback: 100,
        cashbackType: 'flat',
        affiliateUrl: 'https://www.swiggy.com',
        lockPeriodDays: 7,
        expiresAt: inDays(7),
        tags: ['food', 'first-order'],
        isFeatured: false,
        termsAndConditions: 'Valid for new users only. Minimum order ₹149.',
      },
      {
        title: 'Mega Beauty Sale - 8% Back',
        description: 'Skincare, makeup and more with guaranteed cashback.',
        brand: 'Nykaa',
        category: catMap['health-beauty'],
        cashbackPercent: 8,
        affiliateUrl: 'https://www.nykaa.com',
        lockPeriodDays: 30,
        expiresAt: inDays(5),
        tags: ['beauty', 'skincare'],
        isFeatured: false,
        termsAndConditions: 'Valid on all products except luxury brands.',
      },
      {
        title: '10% Cashback on Campus Wear',
        description: 'Trendy campus fashion with extra cashback via ChingiRingi.',
        brand: 'Campus Sutra',
        category: catMap['fashion'],
        cashbackPercent: 10,
        affiliateUrl: 'https://www.campussutra.com',
        lockPeriodDays: 21,
        expiresAt: inDays(20),
        tags: ['fashion', 'campus'],
        isFeatured: false,
        termsAndConditions: 'Cashback applicable on full-price items only.',
      },
      {
        title: '15% Back on Audio Gear',
        description: 'Earbuds, headphones, speakers and more at best prices.',
        brand: 'boAt',
        category: catMap['electronics'],
        cashbackPercent: 15,
        affiliateUrl: 'https://www.boat-lifestyle.com',
        lockPeriodDays: 30,
        expiresAt: inDays(10),
        tags: ['electronics', 'audio'],
        isFeatured: true,
        termsAndConditions: 'Applicable on orders above ₹499.',
      },
      {
        title: 'Furniture & Decor - 6% Back',
        description: 'Upgrade your home with premium furniture and earn cashback.',
        brand: 'Pepperfry',
        category: catMap['home-living'],
        cashbackPercent: 6,
        affiliateUrl: 'https://www.pepperfry.com',
        lockPeriodDays: 60,
        expiresAt: inDays(25),
        tags: ['home', 'furniture'],
        isFeatured: false,
        termsAndConditions: 'Valid on orders above ₹2999. Excludes sale items.',
      },
      {
        title: 'Health Essentials - 7% Back',
        description: 'Medicines, wellness products and healthcare with cashback.',
        brand: 'PharmEasy',
        category: catMap['health-beauty'],
        cashbackPercent: 7,
        affiliateUrl: 'https://www.pharmeasy.in',
        lockPeriodDays: 14,
        expiresAt: inDays(12),
        tags: ['health', 'medicines'],
        isFeatured: false,
        termsAndConditions: 'Cashback on prepaid orders only.',
      },
    ];

    const createdDeals = await Deal.insertMany(deals);
    console.log(`Seeded ${createdDeals.length} deals`);

    // Seed banners
    const banners = [
      {
        title: 'Up to 20% cashback on fashion brands',
        subtitle: 'EARN WHILE YOU SHOP',
        position: 'hero',
        linkType: 'category',
        linkValue: 'fashion',
        sortOrder: 1,
        expiresAt: inDays(30),
      },
      {
        title: 'Electronics Sale - Up to 12% Back',
        subtitle: 'LIMITED TIME OFFER',
        position: 'hero',
        linkType: 'category',
        linkValue: 'electronics',
        sortOrder: 2,
        expiresAt: inDays(15),
      },
      {
        title: 'LIVE DEALS',
        subtitle: '500+ active deals',
        position: 'sidebar',
        linkType: 'url',
        linkValue: '/deals',
        sortOrder: 1,
      },
    ];

    const createdBanners = await Banner.insertMany(banners);
    console.log(`Seeded ${createdBanners.length} banners`);

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seedDB();
