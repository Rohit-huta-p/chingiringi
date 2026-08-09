import 'dotenv/config';
import mongoose from 'mongoose';
import Video from '../modules/videos/videoModel.js';
import { videoProvider } from '../services/videoProvider.js';

export function isStuck(video, now = new Date(), thresholdMin = 15) {
  if (video.status !== 'processing') return false;
  return (now - new Date(video.createdAt)) / 60000 >= thresholdMin;
}

export async function reconcileOnce(now = new Date()) {
  const p = videoProvider();
  const candidates = await Video.find({ status: 'processing' });
  let fixed = 0;
  for (const v of candidates) {
    if (!isStuck(v, now)) continue;
    const s = await p.pollStatus(v);
    if (!s) continue;
    if (s.state === 'ready') {
      v.status = 'ready';
      v.hlsUrl = s.hlsUrl || v.hlsUrl;
      v.thumbnailUrl = s.thumbnailUrl || v.thumbnailUrl;
      v.durationSec = Math.round(s.durationSec || v.durationSec);
      if (s.assetId) v.providerAssetId = s.assetId;
      if (!v.publishedAt) v.publishedAt = new Date();
      await v.save(); fixed++;
    } else if (s.state === 'error') {
      v.status = 'error'; await v.save(); fixed++;
    }
  }
  return fixed;
}

// Run directly: `npm run cron:reconcile-videos`
if (process.argv[1] && process.argv[1].endsWith('reconcileVideos.js')) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => reconcileOnce())
    .then((n) => { console.log(`reconciled ${n} video(s)`); return mongoose.disconnect(); })
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
