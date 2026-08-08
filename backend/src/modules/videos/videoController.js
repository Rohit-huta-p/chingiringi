import { z } from 'zod';
import mongoose from 'mongoose';
import Video from './videoModel.js';
import { createDirectUpload } from '../../services/cloudflareStream.js';

// @desc  Mint a Cloudflare direct-upload URL   @route POST /api/videos/upload-url  @access admin
export const createUploadUrl = async (req, res) => {
  const { storeId } = req.body;
  if (!mongoose.isValidObjectId(storeId)) {
    res.status(400);
    throw new Error('A valid storeId is required');
  }
  const { uid, uploadURL } = await createDirectUpload({
    maxDurationSeconds: 120,
    meta: { storeId: String(storeId), createdBy: String(req.user._id) },
  });
  res.status(201).json({ status: 'success', data: { streamUid: uid, uploadURL } });
};

const createSchema = z.object({
  streamUid: z.string().min(1),
  storeId: z.string().refine(mongoose.isValidObjectId, 'invalid storeId'),
  caption: z.string().max(300).optional().default(''),
  hashtags: z.array(z.string()).optional().default([]),
  taggedProducts: z.array(z.string().refine(mongoose.isValidObjectId, 'bad id')).optional().default([]),
  cta: z.object({
    type: z.enum(['shop', 'store', 'none']).default('shop'),
    productId: z.string().refine(mongoose.isValidObjectId, 'bad id').optional(),
    url: z.string().optional().default(''),
  }).optional(),
});

// @desc  Create video metadata after the client uploads  @route POST /api/videos  @access admin
export const createVideo = async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const d = parsed.data;
  const video = await Video.create({
    store: d.storeId,
    createdByAdmin: req.user._id,
    streamUid: d.streamUid,
    caption: d.caption,
    hashtags: d.hashtags,
    taggedProducts: d.taggedProducts,
    cta: d.cta || { type: 'shop' },
    status: 'processing',
  });
  res.status(201).json({ status: 'success', data: { video } });
};
