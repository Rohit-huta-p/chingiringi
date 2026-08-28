import mongoose from 'mongoose';

const streamSchema = new mongoose.Schema(
  {
    storeId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    ownerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },

    // Daily.co room details (set when broadcaster starts the stream)
    dailyRoomName: { type: String, default: '' },
    dailyRoomUrl:  { type: String, default: '' },

    title:        { type: String, default: '' },
    // Optional category + cover thumbnail — shown on the live / Videos cards buyers browse.
    category:     { type: String, default: '' },
    thumbnail:    { type: String, default: '' },
    status:       { type: String, enum: ['idle', 'live', 'ended'], default: 'idle' },
    viewerCount:  { type: Number, default: 0, min: 0 },

    startedAt:    { type: Date },
    endedAt:      { type: Date },

    // Products featured in this stream
    products:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// Primary query: find all live streams sorted by viewer count
streamSchema.index({ status: 1, storeId: 1 });
streamSchema.index({ storeId: 1 });

const Stream = mongoose.model('Stream', streamSchema);

export default Stream;
