import mongoose from 'mongoose';

const streamSchema = new mongoose.Schema(
  {
    storeId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    ownerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },

    // Daily.co room details (set when broadcaster starts the stream)
    // Legacy Daily.co fields (superseded by Mux; kept for old rows).
    dailyRoomName: { type: String, default: '' },
    dailyRoomUrl:  { type: String, default: '' },

    // Mux Live. muxStreamId = live stream id, muxPlaybackId = public HLS playback
    // id (viewers), muxStreamKey = RTMP ingest key (broadcaster only).
    muxStreamId:   { type: String, default: '' },
    muxPlaybackId: { type: String, default: '' },
    muxStreamKey:  { type: String, default: '' },

    title:        { type: String, default: '' },
    // Optional category + cover thumbnail — shown on the live / Videos cards buyers browse.
    category:     { type: String, default: '' },
    thumbnail:    { type: String, default: '' },
    status:       { type: String, enum: ['idle', 'live', 'ended'], default: 'idle' },
    // Live gauge — +1 on join, -1 on leave/disconnect. Decays toward 0 as the
    // audience drifts out, so it is NOT a post-stream "how many watched" figure;
    // the cumulative/derived analytics below are. See streamSocket.js.
    viewerCount:  { type: Number, default: 0, min: 0 },

    // ── Past-stream audience analytics ──────────────────────────────────────
    // Populated by the socket join/leave handlers + frozen when the stream ends
    // (finalizeStreamMetrics in streamController). "Leads generated"
    // (usersContacted) is not stored — it is derived at read time in
    // getMyStreams from buyer messages inside the stream's live window.
    totalViews:   { type: Number, default: 0, min: 0 }, // monotonic tune-ins (re-joins count)
    peakViewers:  { type: Number, default: 0, min: 0 }, // highest concurrency reached
    avgViewers:   { type: Number, default: 0, min: 0 }, // time-weighted avg concurrency (final)
    // Internal accumulators for the time-weighted average = area under the
    // concurrency curve. viewerSeconds += viewerCount × seconds-since-last-change.
    viewerSeconds:      { type: Number, default: 0, min: 0 },
    lastViewerChangeAt: { type: Date },

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
