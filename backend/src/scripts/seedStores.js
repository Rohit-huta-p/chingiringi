import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Store from '../modules/stores/storeModel.js';

const stores = [
  { name: 'Croma Electronics', shortName: 'Croma', category: 'Electronics', description: 'Electronics megastore', address: 'Shop No. 12, Orion Mall, Rajajinagar', area: 'Rajajinagar', openTime: '10:30', closeTime: '22:00', userDiscountPercent: 8, platformCommissionPercent: 5, rating: 4.4, reviewsCount: 211 },
  { name: 'Apollo Pharmacy', shortName: 'Apollo', category: 'Health', description: '24x7 pharmacy', address: 'Near Manhi Hall, Hebbal, Bengaluru', area: 'Hebbal', openTime: '08:30', closeTime: '22:30', userDiscountPercent: 5, platformCommissionPercent: 4, rating: 4.2, reviewsCount: 87 },
  { name: 'Lifestyle Mega Store', shortName: 'Lifestyle', category: 'Fashion', description: 'Fashion & lifestyle', address: 'Ground Floor, Phoenix MarketCity, Whitefield', area: 'Whitefield', openTime: '10:00', closeTime: '22:00', userDiscountPercent: 8, platformCommissionPercent: 6, isFeatured: true, rating: 4.6, reviewsCount: 1240 },
  { name: "Nature's Basket", shortName: "Nat's Basket", category: 'Grocery', description: 'Gourmet grocery', address: '101 Koramangala Road, 5th Block, Bengaluru', area: 'Koramangala', openTime: '08:00', closeTime: '22:00', userDiscountPercent: 6, platformCommissionPercent: 4, rating: 4.7, reviewsCount: 342 },
  { name: 'Nike Factory Store', shortName: 'Nike', category: 'Sports', description: 'Sportswear & shoes', address: 'Block 1, Forum Shantiniketan Mall, Marathahalli', area: 'Marathahalli', openTime: '11:00', closeTime: '21:30', userDiscountPercent: 7, platformCommissionPercent: 5, isActive: false, rating: 4.0, reviewsCount: 263 },
  { name: 'Nykaa Beauty Studio', shortName: 'Nykaa', category: 'Beauty', description: 'Beauty & cosmetics', address: '46 Bangalore Habitat, Residency Rd, Richmond Town', area: 'Richmond Town', openTime: '10:30', closeTime: '21:00', userDiscountPercent: 9, platformCommissionPercent: 6, rating: 4.3, reviewsCount: 198 },
  { name: 'Tanishq Jewellers', shortName: 'Tanishq', category: 'Jewellery', description: 'Fine jewellery', address: '40, Main Road, Sadashiv Nagar, Bengaluru', area: 'Sadashiv Nagar', openTime: '10:00', closeTime: '20:00', userDiscountPercent: 2, platformCommissionPercent: 3, rating: 4.8, reviewsCount: 891 },
  { name: 'Third Wave Coffee', shortName: 'Third Wave', category: 'Food & Cafe', description: 'Specialty coffee', address: '12, Indiranagar 100ft Road, Bengaluru', area: 'Indiranagar', openTime: '07:30', closeTime: '23:00', userDiscountPercent: 5, platformCommissionPercent: 4, rating: 4.5, reviewsCount: 670 },
];

const seed = async () => {
  try {
    await connectDB();
    await Store.deleteMany({});
    // insertMany bypasses the pre('save') hook, so set the slug here.
    const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const docs = stores.map((s) => ({ ...s, slug: slugify(s.name) }));
    const created = await Store.insertMany(docs);
    console.log(`Seeded ${created.length} stores`);
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seed();
