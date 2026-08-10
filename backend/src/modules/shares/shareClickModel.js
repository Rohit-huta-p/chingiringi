import mongoose from 'mongoose';

// One row per inbound open of a /s/... share link. Audit trail + abuse review;
// `confirmed`/`reason` record what evaluateShareConfirm decided for this open.
const shareClickSchema = new mongoose.Schema(
  {
    shareEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShareEvent', index: true },
    sharerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    itemType:     { type: String },
    itemId:       { type: mongoose.Schema.Types.ObjectId },
    visitorIp:    { type: String },
    visitorUa:    { type: String },
    confirmed:    { type: Boolean, default: false },
    reason:       { type: String },
  },
  { timestamps: true },
);

const ShareClick = mongoose.model('ShareClick', shareClickSchema);
export default ShareClick;
