import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: 0,
    },
    coinsPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Maximum retail price — strike-through reference. When mrp > price the
    // detail page shows the strikethrough, "You save ₹X (Y%)" and an off-badge.
    // 0 = unset → detail page shows a single clean price (no fake discount).
    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Primary/cover image. Kept as the single source every card surface reads
    // (home grid, category grid, admin lists). Always mirrors images[0].
    imageUrl: {
      type: String,
      default: '',
    },
    // Optional mobile-specific cover crop. Mobile surfaces prefer this and fall
    // back to imageUrl — mirrors the banner desktop/mobile image split.
    mobileImageUrl: {
      type: String,
      default: '',
    },
    // Full image gallery (cover first). Additive — imageUrl above stays the
    // cover for backward compatibility with every surface reading .imageUrl.
    images: {
      type: [String],
      default: [],
    },
    // Mobile-specific gallery (cover first). Mobile surfaces prefer this over
    // `images`. mobileImageUrl above mirrors mobileImages[0] for back-compat.
    mobileImages: {
      type: [String],
      default: [],
    },
    // Outbound buy / affiliate link. Optional — a product with no URL is
    // display-only and its "Buy Now" shows a "coming soon" message. When set,
    // "Buy Now" logs a click (subid-rewritten, same as deals) and opens it.
    affiliateUrl: {
      type: String,
      default: '',
      trim: true,
    },
    // Merchant / store where the product is sold (e.g. "Amazon"). Shown on the
    // product detail brand card as "Available at …".
    merchant: {
      type: String,
      default: '',
      trim: true,
    },
    // Admin-set headline rating + count (e.g. the merchant's aggregate). Detail
    // surfaces prefer these over the in-app review average when set.
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ name: 'text', description: 'text', category: 'text' });

const Product = mongoose.model('Product', productSchema);

export default Product;
