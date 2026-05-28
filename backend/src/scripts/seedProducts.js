import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Product from '../modules/products/productModel.js';

/*
 * Seeds the Product collection with ~25 genuine Indian-market products
 * across every existing category. Uses upsert-by-name so re-running keeps
 * any hand-curated products created via the admin panel intact and just
 * refreshes the canonical entries.
 *
 * Run: npm run seed:products
 *
 * Image URLs use Unsplash public photos with a width param — replace with
 * Cloudinary assets once you have proper product photography.
 */

const img = (id) => `https://images.unsplash.com/photo-${id}?w=600&auto=format&fit=crop&q=70`;

const products = [
  // ── Fashion ─────────────────────────────────────────────────────────────
  {
    name: 'Nike Air Force 1 White Sneakers',
    description: 'Classic low-top leather sneakers with iconic Air cushioning. Versatile go-anywhere style.',
    category: 'Fashion',
    price: 8495,
    coinsPrice: 850,
    imageUrl: img('1542291026-7eec264c27ff'),
    stock: 40,
    isFeatured: true,
  },
  {
    name: "Levi's 511 Slim Fit Jeans",
    description: 'Slim-fit stretch denim in dark indigo wash. Modern below-the-waist fit.',
    category: 'Fashion',
    price: 2799,
    coinsPrice: 280,
    imageUrl: img('1542272604-787c3835535d'),
    stock: 80,
  },
  {
    name: 'H&M Cotton Crew Neck T-Shirt',
    description: 'Soft pure cotton tee in regular fit. Available in 6 colours.',
    category: 'Fashion',
    price: 699,
    coinsPrice: 70,
    imageUrl: img('1521572163474-6864f9cf17ab'),
    stock: 200,
  },
  {
    name: 'Ray-Ban Aviator Classic Sunglasses',
    description: 'Original aviator with gold metal frame and G-15 green lenses. UV400 protection.',
    category: 'Fashion',
    price: 7990,
    coinsPrice: 800,
    imageUrl: img('1572635196237-14b3f281503f'),
    stock: 25,
    isFeatured: true,
  },
  {
    name: 'Fossil Gen 6 Smartwatch',
    description: 'Wear OS smartwatch with Snapdragon 4100+, SpO2, heart-rate, AMOLED display.',
    category: 'Fashion',
    price: 22995,
    coinsPrice: 2300,
    imageUrl: img('1523275335684-37898b6baf30'),
    stock: 15,
  },

  // ── Electronics ────────────────────────────────────────────────────────
  {
    name: 'boAt Airdopes 141 Bluetooth Earbuds',
    description: '42-hour playback, ENx noise cancellation, IPX4 water resistance, dual mic.',
    category: 'Electronics',
    price: 1099,
    coinsPrice: 110,
    imageUrl: img('1605464315542-bda3e2f4e605'),
    stock: 150,
    isFeatured: true,
  },
  {
    name: 'Mi Smart Band 7',
    description: '1.62" AMOLED display, 120 workout modes, SpO2, 14-day battery.',
    category: 'Electronics',
    price: 3499,
    coinsPrice: 350,
    imageUrl: img('1544117519-31a4b719223d'),
    stock: 90,
  },
  {
    name: 'OnePlus Bullets Wireless Z2',
    description: 'Bluetooth 5.0 neckband, 30-hour playback, fast charge gives 20 hours in 10 min.',
    category: 'Electronics',
    price: 1899,
    coinsPrice: 190,
    imageUrl: img('1590658268037-6bf12165a8df'),
    stock: 110,
  },
  {
    name: 'Apple iPhone 15 (128 GB) — Blue',
    description: '6.1" Super Retina XDR display, A16 Bionic chip, 48 MP main camera, USB-C.',
    category: 'Electronics',
    price: 79900,
    coinsPrice: 7990,
    imageUrl: img('1592750475338-74b7b21085ab'),
    stock: 12,
    isFeatured: true,
  },
  {
    name: 'JBL Tune 510BT Wireless Headphones',
    description: 'Pure Bass sound, 40-hour battery, foldable, multi-point connection.',
    category: 'Electronics',
    price: 2499,
    coinsPrice: 250,
    imageUrl: img('1546435770-a3e426bf472b'),
    stock: 65,
  },
  {
    name: 'Samsung Galaxy Buds2 Pro',
    description: 'Hi-Fi 24-bit audio, intelligent ANC, 360 audio with Direct Multi-channel.',
    category: 'Electronics',
    price: 17999,
    coinsPrice: 1800,
    imageUrl: img('1606220588913-b3aacb4d2f37'),
    stock: 30,
  },

  // ── Health & Beauty ────────────────────────────────────────────────────
  {
    name: 'The Ordinary Hyaluronic Acid 2% + B5',
    description: 'Multi-depth hydration serum. 30ml. Vegan, cruelty-free.',
    category: 'Health & Beauty',
    price: 950,
    coinsPrice: 95,
    imageUrl: img('1620916566398-39f1143ab7be'),
    stock: 75,
  },
  {
    name: 'Mamaearth Onion Hair Oil with Onion & Redensyl',
    description: '150ml. Controls hairfall, promotes regrowth. Free of mineral oil & silicones.',
    category: 'Health & Beauty',
    price: 399,
    coinsPrice: 40,
    imageUrl: img('1556228720-195a672e8a03'),
    stock: 120,
    isFeatured: true,
  },
  {
    name: 'Cetaphil Gentle Skin Cleanser 250ml',
    description: 'Dermatologist-recommended non-foaming cleanser. Soap-free, fragrance-free.',
    category: 'Health & Beauty',
    price: 525,
    coinsPrice: 55,
    imageUrl: img('1556228453-efd6c1ff04f6'),
    stock: 90,
  },
  {
    name: 'Plum Green Tea Pore Cleansing Face Wash',
    description: 'Salicylic acid + green tea. 75ml. For oily / acne-prone skin.',
    category: 'Health & Beauty',
    price: 345,
    coinsPrice: 35,
    imageUrl: img('1631730486572-226d1f595b68'),
    stock: 130,
  },

  // ── Home & Living ──────────────────────────────────────────────────────
  {
    name: 'Wakefit Orthopaedic Memory Foam Pillow',
    description: 'Cervical support, breathable cover, machine washable. Pack of 1.',
    category: 'Home & Living',
    price: 999,
    coinsPrice: 100,
    imageUrl: img('1631049307264-da0ec9d70304'),
    stock: 60,
  },
  {
    name: 'Milton Thermosteel Flip Lid 1000ml',
    description: '24-hour hot / cold. Vacuum insulated stainless steel. BPA free.',
    category: 'Home & Living',
    price: 1150,
    coinsPrice: 115,
    imageUrl: img('1610631066894-62452ccb927c'),
    stock: 85,
  },
  {
    name: 'Philips Mixer Grinder HL7505/02',
    description: '600W motor, 3 stainless steel jars, leak-proof gaskets, 2-year warranty.',
    category: 'Home & Living',
    price: 2895,
    coinsPrice: 290,
    imageUrl: img('1585515320310-259814833e62'),
    stock: 40,
    isFeatured: true,
  },
  {
    name: 'Prestige Stainless Steel Pressure Cooker 5L',
    description: 'Induction & gas compatible. Outer lid, alpha base. 5-year warranty.',
    category: 'Home & Living',
    price: 1499,
    coinsPrice: 150,
    imageUrl: img('1556909114-f6e7ad7d3136'),
    stock: 50,
  },

  // ── Food & Dining ──────────────────────────────────────────────────────
  {
    name: 'Tata Sampann Unpolished Toor Dal 1kg',
    description: 'Unpolished, no preservatives, rich in protein. 100% natural.',
    category: 'Food & Dining',
    price: 185,
    coinsPrice: 20,
    imageUrl: img('1604908176997-431f1d57c5a8'),
    stock: 300,
  },
  {
    name: 'Maggi Hot & Sweet Tomato Chilli Sauce 1kg',
    description: 'The legendary squeezy bottle. Pour, dip, drizzle.',
    category: 'Food & Dining',
    price: 110,
    coinsPrice: 10,
    imageUrl: img('1607301406259-dfb186e15de8'),
    stock: 250,
  },

  // ── Groceries ──────────────────────────────────────────────────────────
  {
    name: 'Amul Butter Pasteurised 500g',
    description: 'Salted white butter. Utterly butterly delicious. Refrigerate after opening.',
    category: 'Groceries',
    price: 275,
    coinsPrice: 30,
    imageUrl: img('1589985270826-4b7bb135bc9d'),
    stock: 200,
  },
  {
    name: 'Aashirvaad Shudh Chakki Atta 5kg',
    description: '100% whole wheat atta. 0% maida. Two-step grinding.',
    category: 'Groceries',
    price: 275,
    coinsPrice: 30,
    imageUrl: img('1568901346375-23c9450c58cd'),
    stock: 180,
    isFeatured: true,
  },

  // ── Entertainment ──────────────────────────────────────────────────────
  {
    name: 'Sony PlayStation 5 DualSense Wireless Controller',
    description: 'Haptic feedback, adaptive triggers, built-in mic, USB-C charging.',
    category: 'Entertainment',
    price: 5990,
    coinsPrice: 600,
    imageUrl: img('1607853202273-797f1c22a38e'),
    stock: 35,
    isFeatured: true,
  },
  {
    name: 'Amazon Kindle Paperwhite (8GB)',
    description: '6.8" display, adjustable warm light, IPX8 waterproof, weeks of battery.',
    category: 'Entertainment',
    price: 13999,
    coinsPrice: 1400,
    imageUrl: img('1592498372314-2b3c10d472dd'),
    stock: 22,
  },
];

const seed = async () => {
  try {
    await connectDB();

    const ops = products.map((p) => ({
      updateOne: {
        filter: { name: p.name },
        update: { $set: p },
        upsert: true,
      },
    }));

    const res = await Product.bulkWrite(ops, { ordered: false });
    const upserted = res.upsertedCount ?? 0;
    const matched = res.matchedCount ?? 0;
    const modified = res.modifiedCount ?? 0;

    console.log(`Seeded ${products.length} products`);
    console.log(`  → ${upserted} newly inserted`);
    console.log(`  → ${matched} matched, ${modified} updated`);

    const total = await Product.countDocuments();
    console.log(`Total products in DB: ${total}`);

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
