import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    icon: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    // ── Deals-page curation (plan C) ──────────────────────────────────────
    // Controls whether this category appears as its own "per-category" row
    // on the user-facing Deals page. Defaults to true so existing categories
    // keep showing without admin intervention. Admin can toggle false to
    // hide a category from the deals page (it still works elsewhere).
    showOnDealsPage: {
      type: Boolean,
      default: true,
    },
    // Per-category order WITHIN the deals page (separate from the generic
    // `sortOrder` used by other surfaces, so admin can reorder the deals
    // page without disturbing nav / picker ordering).
    dealsPageSortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });
// Composite index for the deals-page query (showOnDealsPage + ordered).
categorySchema.index({ showOnDealsPage: 1, dealsPageSortOrder: 1 });

const Category = mongoose.model('Category', categorySchema);

export default Category;
