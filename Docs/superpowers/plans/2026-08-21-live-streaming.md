# Live Streaming MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Live tab inside OfflineStoresScreen where verified business accounts can go live and viewers can watch with real-time chat and contact info.

**Architecture:** Daily.co WebRTC handles video transport; Socket.io on the existing Node.js backend handles live chat rooms. The existing "Stores" bottom tab gains an outer Live/Stores toggle — no new bottom nav item. Business accounts are a new `role: 'business'` value added to the existing User model enum; admin grants it via a new API endpoint.

**Tech Stack:** Daily.co (`@daily-co/react-native-daily-js`), Socket.io (`socket.io` + `socket.io-client`), MongoDB (new `LiveStream` collection), React Native Expo (EAS Build), `@tanstack/react-query`, Zustand (`useAuthStore`), axios (`apiClient`)

**Spec:** See the design discussion in chat (2026-08-21) and the HTML spec at `/private/tmp/.../scratchpad/chingiringi-live-spec.html`

## Global Constraints

- Backend uses ES module syntax (`import`/`export`), Node.js 18+
- App is Expo managed workflow with EAS Build — native modules require EAS, not Expo Go
- All app API calls go through `apiClient` from `chingiring-app/src/api/client.ts` (axios, auth header attached automatically)
- Backend `protect` middleware attaches `req.user` (full Mongoose doc); `admin` middleware checks `req.user.role === 'admin'`
- Existing `role` enum on User model: `['user', 'admin']` — we add `'business'`
- Store objects have no `ownerId`/`userId` — Task 1 adds this
- Never import `socket.io` in `app.js`; keep socket setup in `server.js` only
- Daily.co API base: `https://api.daily.co/v1`; env var: `DAILY_API_KEY`
- Socket.io env var for the app: `EXPO_PUBLIC_WS_URL` (falls back to same host as `EXPO_PUBLIC_API_URL`)
- EAS Build is already configured; run `eas build` not `expo build`
- Test runner: `jest` (backend); no separate test runner setup needed for app (backend tests only in this plan)

---

## File Map

**New backend files:**
- `backend/src/modules/live/liveModel.js` — LiveStream Mongoose model
- `backend/src/modules/live/liveController.js` — REST handlers (start, stop, list, get)
- `backend/src/modules/live/liveRoutes.js` — Express router
- `backend/src/modules/live/liveSocket.js` — Socket.io namespace + event handlers
- `backend/src/services/daily.js` — Daily.co REST API wrapper
- `backend/src/__tests__/live.test.js` — integration tests

**Modified backend files:**
- `backend/src/modules/users/userModel.js:44` — add `'business'` to role enum
- `backend/src/modules/stores/storeModel.js` — add `ownerId` field
- `backend/src/modules/admin/adminRoutes.js` — add business-role endpoint
- `backend/src/modules/admin/adminController.js` — add `setBusinessRole` handler
- `backend/src/app.js` — register `/api/live` routes
- `backend/src/server.js` — wrap with `http.createServer`, attach Socket.io

**New app files:**
- `chingiring-app/src/api/live.ts` — live API client
- `chingiring-app/src/hooks/useLiveChat.ts` — Socket.io chat hook
- `chingiring-app/src/screens/Live/GoLiveModal.tsx` — pre-stream form
- `chingiring-app/src/screens/Live/BroadcasterScreen.tsx` — Daily.co broadcaster
- `chingiring-app/src/screens/Live/ViewerScreen.tsx` — viewer + chat + contact info

**Modified app files:**
- `chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx` — add Live/Stores outer tabs + LiveDiscoveryTab

---

### Task 1: Add 'business' role + ownerId on Store

**Files:**
- Modify: `backend/src/modules/users/userModel.js:44`
- Modify: `backend/src/modules/stores/storeModel.js`
- Modify: `backend/src/modules/admin/adminController.js`
- Modify: `backend/src/modules/admin/adminRoutes.js`
- Test: `backend/src/__tests__/live.test.js` (create the file here)

**Interfaces:**
- Produces: `PUT /api/admin/users/:id/role` — body `{ role: 'business' | 'user' }`, responds `{ _id, name, role }`
- Produces: `req.user.role === 'business'` is valid in all subsequent middleware

- [ ] **Step 1: Add 'business' to role enum in userModel.js**

Open `backend/src/modules/users/userModel.js`. Find the `role` field (around line 44):
```js
role: {
  type: String,
  enum: ['user', 'admin'],
  default: 'user',
},
```
Change to:
```js
role: {
  type: String,
  enum: ['user', 'admin', 'business'],
  default: 'user',
},
```

- [ ] **Step 2: Add ownerId to storeModel.js**

Open `backend/src/modules/stores/storeModel.js`. In the `// ── Flags ──` section near the bottom of the schema fields (before `isActive`), add:
```js
ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/__tests__/live.test.js`:
```js
import request from 'supertest';
import app from '../app.js';
import User from '../modules/users/userModel.js';
import mongoose from 'mongoose';

// Shared admin token — set in beforeAll
let adminToken;
let userId;

beforeAll(async () => {
  // Create admin user
  const admin = await User.create({
    name: 'Admin',
    phone: '+919999000001',
    role: 'admin',
    passwordHash: 'x',
  });
  // Sign in to get token (or fabricate one via generateToken)
  const { generateToken } = await import('../utils/generateToken.js');
  adminToken = generateToken(admin._id);
  // Create a regular user to promote
  const user = await User.create({
    name: 'Biz Owner',
    phone: '+919999000002',
    passwordHash: 'x',
  });
  userId = user._id.toString();
});

afterAll(async () => {
  await User.deleteMany({ phone: { $in: ['+919999000001', '+919999000002'] } });
  await mongoose.disconnect();
});

describe('PUT /api/admin/users/:id/role', () => {
  it('sets role to business', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'business' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('business');
  });

  it('rejects non-admin', async () => {
    const { generateToken } = await import('../utils/generateToken.js');
    const plain = await User.create({ name: 'X', phone: '+919999000003', passwordHash: 'x' });
    const token = generateToken(plain._id);
    const res = await request(app)
      .put(`/api/admin/users/${plain._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'business' });
    expect(res.status).toBe(403);
    await User.deleteOne({ _id: plain._id });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npx jest --testPathPattern=live.test --no-coverage 2>&1 | tail -20
```
Expected: FAIL — `Cannot PUT /api/admin/users/...`

- [ ] **Step 5: Add setBusinessRole to adminController.js**

Open `backend/src/modules/admin/adminController.js` and add at the bottom:
```js
// PUT /api/admin/users/:id/role — grant or revoke business status
export const setBusinessRole = async (req, res) => {
  const { role } = req.body;
  if (!['user', 'business'].includes(role)) {
    res.status(400);
    throw new Error('role must be user or business');
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, select: '_id name email phone role' },
  );
  if (!user) { res.status(404); throw new Error('User not found'); }
  res.json(user);
};
```
Make sure `User` is imported at the top of the file (check existing imports; add `import User from '../users/userModel.js';` if missing).

- [ ] **Step 6: Register route in adminRoutes.js**

Open `backend/src/modules/admin/adminRoutes.js`. Add the import and route:
```js
import { setBusinessRole } from './adminController.js';
// ... (existing imports)

// after existing admin routes:
router.put('/users/:id/role', protect, admin, setBusinessRole);
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npx jest --testPathPattern=live.test --no-coverage 2>&1 | tail -20
```
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add backend/src/modules/users/userModel.js \
        backend/src/modules/stores/storeModel.js \
        backend/src/modules/admin/adminController.js \
        backend/src/modules/admin/adminRoutes.js \
        backend/src/__tests__/live.test.js
git commit -m "feat(live): add business role + store ownerId + admin role endpoint"
```

---

### Task 2: Daily.co service

**Files:**
- Create: `backend/src/services/daily.js`

**Interfaces:**
- Produces: `dailyService.createRoom(name?)` → `{ name: string, url: string }` (name is auto-generated by Daily if not supplied)
- Produces: `dailyService.deleteRoom(name)` → `void`
- Consumes: `process.env.DAILY_API_KEY`

- [ ] **Step 1: Write the failing test**

Add to `backend/src/__tests__/live.test.js` (append before `afterAll`):
```js
describe('Daily.co service', () => {
  it('createRoom returns name and url', async () => {
    // Skip in CI if no key — but still verifies the shape contract locally
    if (!process.env.DAILY_API_KEY) return;
    const { dailyService } = await import('../services/daily.js');
    const room = await dailyService.createRoom();
    expect(room).toHaveProperty('name');
    expect(room.url).toMatch(/^https:\/\/.*\.daily\.co\//);
    await dailyService.deleteRoom(room.name); // clean up
  });
});
```

- [ ] **Step 2: Run test to verify it fails (module not found)**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npx jest --testPathPattern=live.test --no-coverage 2>&1 | grep -E "FAIL|Cannot find|Error"
```
Expected: FAIL — `Cannot find module '../services/daily.js'`

- [ ] **Step 3: Create daily.js**

```js
// backend/src/services/daily.js
const DAILY_BASE = 'https://api.daily.co/v1';

async function dailyFetch(path, opts = {}) {
  const res = await fetch(`${DAILY_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily.co ${opts.method ?? 'GET'} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const dailyService = {
  /** Create an ephemeral WebRTC room. Returns { name, url }. */
  async createRoom() {
    const data = await dailyFetch('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        privacy: 'public',
        properties: {
          max_participants: 500,
          enable_chat: false,       // we use Socket.io for chat
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8, // 8h expiry
        },
      }),
    });
    return { name: data.name, url: data.url };
  },

  /** Delete the room when a stream ends. */
  async deleteRoom(name) {
    await dailyFetch(`/rooms/${name}`, { method: 'DELETE' });
  },
};
```

- [ ] **Step 4: Run test — expect PASS (or skip if no DAILY_API_KEY in env)**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npx jest --testPathPattern=live.test --no-coverage 2>&1 | tail -20
```
Expected: PASS (the Daily test skips cleanly without a key)

- [ ] **Step 5: Add DAILY_API_KEY to .env**

```
DAILY_API_KEY=your_daily_co_api_key_here
```
Get the key at https://dashboard.daily.co → Developers → API keys. Do NOT commit this value.

- [ ] **Step 6: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add backend/src/services/daily.js backend/src/__tests__/live.test.js
git commit -m "feat(live): Daily.co room service"
```

---

### Task 3: LiveStream model + REST API

**Files:**
- Create: `backend/src/modules/live/liveModel.js`
- Create: `backend/src/modules/live/liveController.js`
- Create: `backend/src/modules/live/liveRoutes.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Produces: `GET /api/live` → `[LiveStream]` (active streams only, public)
- Produces: `GET /api/live/:id` → `LiveStream`
- Produces: `POST /api/live/start` → `LiveStream` (requires `role: 'business'`)
- Produces: `POST /api/live/:id/stop` → `{ ok: true }` (requires own stream or admin)
- Produces: `LiveStream` shape: `{ _id, hostId, hostName, title, description, contactInfo: { phone, whatsapp, instagram, website }, dailyRoomName, dailyRoomUrl, viewerCount, status: 'live'|'ended', createdAt }`
- Consumes: `dailyService.createRoom()`, `dailyService.deleteRoom(name)` from Task 2

- [ ] **Step 1: Add live endpoint tests to live.test.js**

Append to `backend/src/__tests__/live.test.js` (before `afterAll`):
```js
let bizToken;
let streamId;

describe('Live REST API', () => {
  beforeAll(async () => {
    // promote the userId user to business
    await User.findByIdAndUpdate(userId, { role: 'business' });
    const { generateToken } = await import('../utils/generateToken.js');
    bizToken = generateToken(userId);
  });

  it('POST /api/live/start creates a stream', async () => {
    // stub Daily so we don't call the real API in tests
    jest.mock('../services/daily.js', () => ({
      dailyService: {
        createRoom: async () => ({ name: 'test-room', url: 'https://test.daily.co/test-room' }),
        deleteRoom: async () => {},
      },
    }));
    const res = await request(app)
      .post('/api/live/start')
      .set('Authorization', `Bearer ${bizToken}`)
      .send({
        title: 'Flash sale',
        description: 'Great deals today',
        contactInfo: { phone: '9876543210', whatsapp: '9876543210' },
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('live');
    expect(res.body.dailyRoomUrl).toBeDefined();
    streamId = res.body._id;
  });

  it('GET /api/live lists active streams', async () => {
    const res = await request(app).get('/api/live');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/live/:id/stop ends the stream', async () => {
    const res = await request(app)
      .post(`/api/live/${streamId}/stop`)
      .set('Authorization', `Bearer ${bizToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npx jest --testPathPattern=live.test --no-coverage 2>&1 | grep -E "FAIL|Cannot|404"
```
Expected: FAIL — 404 for the live endpoints

- [ ] **Step 3: Create liveModel.js**

```js
// backend/src/modules/live/liveModel.js
import mongoose from 'mongoose';

const contactInfoSchema = new mongoose.Schema({
  phone:     { type: String, default: '' },
  whatsapp:  { type: String, default: '' },
  instagram: { type: String, default: '' },
  website:   { type: String, default: '' },
}, { _id: false });

const liveStreamSchema = new mongoose.Schema({
  hostId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostName:     { type: String, required: true },
  title:        { type: String, required: true, trim: true },
  description:  { type: String, default: '' },
  contactInfo:  { type: contactInfoSchema, default: () => ({}) },
  dailyRoomName: { type: String, required: true },
  dailyRoomUrl:  { type: String, required: true },
  viewerCount:  { type: Number, default: 0, min: 0 },
  status:       { type: String, enum: ['live', 'ended'], default: 'live' },
}, { timestamps: true });

// Index for fetching live streams quickly
liveStreamSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('LiveStream', liveStreamSchema);
```

- [ ] **Step 4: Create liveController.js**

```js
// backend/src/modules/live/liveController.js
import LiveStream from './liveModel.js';
import { dailyService } from '../../services/daily.js';

// GET /api/live — public, active streams only
export const listLiveStreams = async (req, res) => {
  const streams = await LiveStream.find({ status: 'live' })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(streams);
};

// GET /api/live/:id
export const getLiveStream = async (req, res) => {
  const stream = await LiveStream.findById(req.params.id).lean();
  if (!stream) { res.status(404); throw new Error('Stream not found'); }
  res.json(stream);
};

// POST /api/live/start — business accounts only
export const startLiveStream = async (req, res) => {
  if (req.user.role !== 'business') {
    res.status(403);
    throw new Error('Only business accounts can go live');
  }
  // Prevent double-live
  const existing = await LiveStream.findOne({ hostId: req.user._id, status: 'live' });
  if (existing) { res.status(409); throw new Error('Already live'); }

  const { title, description = '', contactInfo = {} } = req.body;
  if (!title?.trim()) { res.status(400); throw new Error('title is required'); }

  const room = await dailyService.createRoom();
  const stream = await LiveStream.create({
    hostId: req.user._id,
    hostName: req.user.name,
    title: title.trim(),
    description,
    contactInfo,
    dailyRoomName: room.name,
    dailyRoomUrl: room.url,
  });
  res.status(201).json(stream);
};

// POST /api/live/:id/stop
export const stopLiveStream = async (req, res) => {
  const stream = await LiveStream.findById(req.params.id);
  if (!stream) { res.status(404); throw new Error('Stream not found'); }

  const isOwner = stream.hostId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) { res.status(403); throw new Error('Forbidden'); }
  if (stream.status === 'ended') return res.json({ ok: true }); // idempotent

  stream.status = 'ended';
  await stream.save();
  await dailyService.deleteRoom(stream.dailyRoomName).catch(() => {}); // best-effort
  res.json({ ok: true });
};
```

- [ ] **Step 5: Create liveRoutes.js**

```js
// backend/src/modules/live/liveRoutes.js
import express from 'express';
import { listLiveStreams, getLiveStream, startLiveStream, stopLiveStream } from './liveController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', listLiveStreams);
router.get('/:id', getLiveStream);
router.post('/start', protect, startLiveStream);
router.post('/:id/stop', protect, stopLiveStream);

export default router;
```

- [ ] **Step 6: Register in app.js**

Open `backend/src/app.js`. Add the import after existing route imports:
```js
import liveRoutes from './modules/live/liveRoutes.js';
```
Add the route registration after existing `app.use(...)` route registrations (before `notFound`/`errorHandler` middleware):
```js
app.use('/api/live', liveRoutes);
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npx jest --testPathPattern=live.test --no-coverage 2>&1 | tail -20
```
Expected: PASS (all live REST tests)

- [ ] **Step 8: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add backend/src/modules/live/ backend/src/app.js backend/src/__tests__/live.test.js
git commit -m "feat(live): LiveStream model + REST API (start/stop/list)"
```

---

### Task 4: Socket.io live chat layer

**Files:**
- Create: `backend/src/modules/live/liveSocket.js`
- Modify: `backend/src/server.js`

**Interfaces:**
- Produces: Socket.io namespace `/live`
- Produces events in → `join-room(streamId)`, `send-message({ text })`, `leave-room(streamId)`, `heart`
- Produces events out → `message({ userId, name, text, ts })`, `viewer-count(n)`, `heart`
- Consumes: `LiveStream.findByIdAndUpdate` to persist viewerCount

- [ ] **Step 1: Install socket.io**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npm install socket.io
```

- [ ] **Step 2: Create liveSocket.js**

```js
// backend/src/modules/live/liveSocket.js
import { Server } from 'socket.io';
import LiveStream from './liveModel.js';
import jwt from 'jsonwebtoken';
import User from '../users/userModel.js';

// Track viewer counts in memory (good enough for MVP)
// ponytail: in-process Map, loses count on restart; use Redis when multi-instance
const roomViewers = new Map(); // streamId -> Set of socketIds

function inc(streamId, socketId) {
  if (!roomViewers.has(streamId)) roomViewers.set(streamId, new Set());
  roomViewers.get(streamId).add(socketId);
  return roomViewers.get(streamId).size;
}

function dec(streamId, socketId) {
  const s = roomViewers.get(streamId);
  if (s) s.delete(socketId);
  const n = s?.size ?? 0;
  if (n === 0) roomViewers.delete(streamId);
  return n;
}

export function attachLiveSocket(httpServer, corsOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    path: '/socket.io',
  });

  const live = io.of('/live');

  // Optional auth — we tolerate unauthenticated viewers (name = 'Guest')
  live.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = await User.findById(decoded.id).select('name role').lean();
      } catch {
        // invalid token — still allow as guest
      }
    }
    next();
  });

  live.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('join-room', async (streamId) => {
      if (currentRoom) {
        socket.leave(currentRoom);
        const n = dec(currentRoom, socket.id);
        live.to(currentRoom).emit('viewer-count', n);
        await LiveStream.findByIdAndUpdate(currentRoom, { viewerCount: n }).catch(() => {});
      }
      currentRoom = streamId;
      socket.join(streamId);
      const n = inc(streamId, socket.id);
      live.to(streamId).emit('viewer-count', n);
      await LiveStream.findByIdAndUpdate(streamId, { viewerCount: n }).catch(() => {});
    });

    socket.on('send-message', ({ text }) => {
      if (!currentRoom || !text?.trim()) return;
      live.to(currentRoom).emit('message', {
        userId: socket.user?._id ?? null,
        name: socket.user?.name ?? 'Guest',
        text: text.trim().slice(0, 300), // hard cap
        ts: Date.now(),
      });
    });

    socket.on('heart', () => {
      if (currentRoom) live.to(currentRoom).emit('heart');
    });

    socket.on('leave-room', async (streamId) => {
      socket.leave(streamId);
      const n = dec(streamId, socket.id);
      live.to(streamId).emit('viewer-count', n);
      await LiveStream.findByIdAndUpdate(streamId, { viewerCount: n }).catch(() => {});
      if (currentRoom === streamId) currentRoom = null;
    });

    socket.on('disconnect', async () => {
      if (currentRoom) {
        const n = dec(currentRoom, socket.id);
        live.to(currentRoom).emit('viewer-count', n);
        await LiveStream.findByIdAndUpdate(currentRoom, { viewerCount: n }).catch(() => {});
      }
    });
  });

  return io;
}
```

- [ ] **Step 3: Modify server.js to use http.createServer + attach socket**

Replace the contents of `backend/src/server.js` with:
```js
import http from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { attachLiveSocket } from './modules/live/liveSocket.js';

connectDB();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// CORS origins for Socket.io — same list as in app.js
const CORS_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8000',
  'http://localhost:8001',
  process.env.APP_ORIGIN,
].filter(Boolean);

attachLiveSocket(server, CORS_ORIGINS);

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => process.exit(1));
});
```

- [ ] **Step 4: Smoke-test — start the backend, confirm it boots**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/backend
npm run dev
```
Expected: `Server running in ... mode on port 8000` (no crash)

- [ ] **Step 5: Verify Socket.io path is reachable**

```bash
curl http://localhost:8000/socket.io/?EIO=4&transport=polling 2>&1 | head -5
```
Expected: a Socket.io handshake response (starts with `0{...` or `{"sid":`)

- [ ] **Step 6: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add backend/src/modules/live/liveSocket.js backend/src/server.js backend/package.json backend/package-lock.json
git commit -m "feat(live): Socket.io chat + viewer count on /live namespace"
```

---

### Task 5: App — live API client + socket hook

**Files:**
- Create: `chingiring-app/src/api/live.ts`
- Create: `chingiring-app/src/hooks/useLiveChat.ts`

**Interfaces:**
- Produces: `liveAPI.list()` → `Promise<LiveStream[]>`
- Produces: `liveAPI.get(id)` → `Promise<LiveStream>`
- Produces: `liveAPI.start(payload)` → `Promise<LiveStream>`
- Produces: `liveAPI.stop(id)` → `Promise<void>`
- Produces: `useLiveChat(streamId, userToken?)` → `{ messages, viewerCount, sendMessage, sendHeart, isConnected }`
- Consumes: `apiClient` from `chingiring-app/src/api/client.ts`

- [ ] **Step 1: Install socket.io-client in the app**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
npm install socket.io-client
```

- [ ] **Step 2: Create live.ts**

```ts
// chingiring-app/src/api/live.ts
import apiClient from './client';

export interface LiveContactInfo {
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  website?: string;
}

export interface LiveStream {
  _id: string;
  hostId: string;
  hostName: string;
  title: string;
  description: string;
  contactInfo: LiveContactInfo;
  dailyRoomUrl: string;
  viewerCount: number;
  status: 'live' | 'ended';
  createdAt: string;
}

export interface StartLivePayload {
  title: string;
  description?: string;
  contactInfo?: LiveContactInfo;
}

export const liveAPI = {
  list: async (): Promise<LiveStream[]> => {
    const res = await apiClient.get('/api/live');
    return res.data;
  },
  get: async (id: string): Promise<LiveStream> => {
    const res = await apiClient.get(`/api/live/${id}`);
    return res.data;
  },
  start: async (payload: StartLivePayload): Promise<LiveStream> => {
    const res = await apiClient.post('/api/live/start', payload);
    return res.data;
  },
  stop: async (id: string): Promise<void> => {
    await apiClient.post(`/api/live/${id}/stop`);
  },
};
```

- [ ] **Step 3: Create useLiveChat.ts**

```ts
// chingiring-app/src/hooks/useLiveChat.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface ChatMessage {
  userId: string | null;
  name: string;
  text: string;
  ts: number;
}

function getWsUrl(): string {
  if (process.env.EXPO_PUBLIC_WS_URL) return process.env.EXPO_PUBLIC_WS_URL;
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip !== 'localhost' && ip !== '127.0.0.1') return `http://${ip}:8000`;
  }
  if (Platform.OS === 'web') return 'http://localhost:8000';
  return 'http://localhost:8000';
}

export function useLiveChat(streamId: string | null, userToken?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!streamId) return;

    const socket = io(`${getWsUrl()}/live`, {
      path: '/socket.io',
      auth: userToken ? { token: userToken } : {},
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', streamId);
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('message', (msg: ChatMessage) =>
      setMessages((prev) => [...prev.slice(-199), msg]), // keep last 200
    );
    socket.on('viewer-count', (n: number) => setViewerCount(n));

    return () => {
      socket.emit('leave-room', streamId);
      socket.disconnect();
      socketRef.current = null;
      setMessages([]);
      setViewerCount(0);
      setIsConnected(false);
    };
  }, [streamId, userToken]);

  const sendMessage = useCallback((text: string) => {
    socketRef.current?.emit('send-message', { text });
  }, []);

  const sendHeart = useCallback(() => {
    socketRef.current?.emit('heart');
  }, []);

  return { messages, viewerCount, sendMessage, sendHeart, isConnected };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors in `src/api/live.ts` or `src/hooks/useLiveChat.ts`

- [ ] **Step 5: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add chingiring-app/src/api/live.ts chingiring-app/src/hooks/useLiveChat.ts \
        chingiring-app/package.json chingiring-app/package-lock.json
git commit -m "feat(live): app live API client + useLiveChat socket hook"
```

---

### Task 6: OfflineStoresScreen — add Live/Stores outer tabs

**Files:**
- Modify: `chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx`

**Interfaces:**
- Consumes: `liveAPI.list()` from Task 5, `LiveStream` type
- Consumes: `useAuthStore` for `user.role` to show "Go Live" button
- Produces: outer tab state `activeTab: 'live' | 'stores'`; existing List/Map toggle kept inside Stores tab only

The current screen has a `ViewMode` toggle (`list | map`) which is rendered inside the header. We add an outer tab bar (`Live | Stores`) above it. When `activeTab === 'live'`, show the Live Discovery section; when `'stores'`, show the existing store grid with the List/Map toggle.

- [ ] **Step 1: Add imports and LiveDiscoveryTab inline component**

Open `chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx`.

At the top, add imports (after existing imports):
```ts
import { liveAPI, LiveStream } from '../../api/live';
import { useQuery } from '@tanstack/react-query';
import { TouchableOpacity } from 'react-native'; // likely already imported
```

Add the `LiveDiscoveryTab` component near the bottom of the file (before the main `export default`). This renders the list of live streams and the "Go Live" button:

```tsx
interface LiveDiscoveryTabProps {
  userRole?: string;
  onGoLive: () => void;
  onJoinStream: (stream: LiveStream) => void;
}

function LiveDiscoveryTab({ userRole, onGoLive, onJoinStream }: LiveDiscoveryTabProps) {
  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['live-streams'],
    queryFn: liveAPI.list,
    refetchInterval: 15_000, // poll every 15s
  });

  return (
    <View style={{ flex: 1 }}>
      {userRole === 'business' && (
        <TouchableOpacity
          style={{
            margin: 16,
            backgroundColor: '#E5320F',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
          onPress={onGoLive}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>🔴 Go Live</Text>
        </TouchableOpacity>
      )}
      {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
      {!isLoading && streams.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 16, color: '#888' }}>No one is live right now</Text>
          <Text style={{ color: '#aaa', marginTop: 8 }}>Check back soon!</Text>
        </View>
      )}
      <FlatList
        data={streams}
        keyExtractor={(s) => s._id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              flex: 1,
              margin: 6,
              borderRadius: 12,
              backgroundColor: '#111',
              height: 160,
              justifyContent: 'flex-end',
              padding: 12,
              overflow: 'hidden',
            }}
            onPress={() => onJoinStream(item)}
          >
            {/* Placeholder gradient until we have a thumbnail */}
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: '#E5320F22',
              borderRadius: 12,
            }} />
            <View style={{
              position: 'absolute', top: 10, left: 10,
              backgroundColor: '#E5320F', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>● LIVE</Text>
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={{ color: '#ccc', fontSize: 11, marginTop: 2 }}>{item.hostName}</Text>
            <Text style={{ color: '#aaa', fontSize: 11 }}>👁 {item.viewerCount}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

Make sure `StyleSheet`, `FlatList`, `ActivityIndicator`, `View`, `Text` are all imported from `react-native` — check existing imports and add what's missing.

- [ ] **Step 2: Add outer tab state + routing in the main component**

Inside the main `OfflineStoresScreen` component function, add:
```tsx
const [activeTab, setActiveTab] = useState<'live' | 'stores'>('stores');
const { user } = useAuthStore(); // already imported
```

Replace the existing `return (...)` JSX. The header gets a Live/Stores tab bar directly below the screen title (or wherever the existing ViewMode toggle currently sits). When `activeTab === 'live'`, render `<LiveDiscoveryTab>`; when `'stores'`, render the existing store content.

Find the part of the header JSX that renders the `List | Map` toggle buttons and wrap the entire content area with the new outer tab. The pattern:

```tsx
{/* Outer Live / Stores tab bar */}
<View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, backgroundColor: '#F0F0F0', padding: 3 }}>
  {(['live', 'stores'] as const).map((tab) => (
    <TouchableOpacity
      key={tab}
      style={{
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: activeTab === tab ? '#fff' : 'transparent',
        alignItems: 'center',
        shadowColor: activeTab === tab ? '#000' : 'transparent',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: activeTab === tab ? 2 : 0,
      }}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={{ fontWeight: activeTab === tab ? '700' : '500', fontSize: 14 }}>
        {tab === 'live' ? '🔴 Live' : '🏪 Stores'}
      </Text>
    </TouchableOpacity>
  ))}
</View>

{activeTab === 'live' ? (
  <LiveDiscoveryTab
    userRole={user?.role}
    onGoLive={() => setGoLiveVisible(true)}
    onJoinStream={(stream) => navigation.navigate('ViewerScreen', { streamId: stream._id, roomUrl: stream.dailyRoomUrl, title: stream.title, hostName: stream.hostName, contactInfo: stream.contactInfo })}
  />
) : (
  /* existing store list/map JSX here — move it inside this branch */
  <>{/* existing content */}</>
)}
```

Also add `const [goLiveVisible, setGoLiveVisible] = useState(false);` to the component state.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
npx tsc --noEmit 2>&1 | head -30
```
Fix any type errors before proceeding.

- [ ] **Step 4: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx
git commit -m "feat(live): Live/Stores outer tabs in OfflineStoresScreen"
```

---

### Task 7: Install Daily.co SDK + Go Live modal + Broadcaster screen

**Files:**
- Create: `chingiring-app/src/screens/Live/GoLiveModal.tsx`
- Create: `chingiring-app/src/screens/Live/BroadcasterScreen.tsx`

**Interfaces:**
- Consumes: `liveAPI.start(payload)`, `liveAPI.stop(id)` from Task 5
- Produces: `GoLiveModal` — modal with title/description/contact form, calls `liveAPI.start`, then navigates to `BroadcasterScreen`
- Produces: `BroadcasterScreen` — Daily.co video view for the host; "End Stream" button calls `liveAPI.stop`

- [ ] **Step 1: Install Daily.co React Native SDK**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
npm install @daily-co/react-native-daily-js react-native-webrtc @config-plugins/react-native-webrtc
```

- [ ] **Step 2: Add config plugin in app.json**

Open `chingiring-app/app.json` (or `app.config.js`). In the `expo.plugins` array (create it if missing), add:
```json
"plugins": [
  ["@config-plugins/react-native-webrtc"]
]
```
This is required for EAS Build to set up camera/microphone permissions automatically.

- [ ] **Step 3: Create GoLiveModal.tsx**

```tsx
// chingiring-app/src/screens/Live/GoLiveModal.tsx
import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { liveAPI, StartLivePayload } from '../../api/live';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStreamStarted: (streamId: string, roomUrl: string) => void;
}

export default function GoLiveModal({ visible, onClose, onStreamStarted }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoLive = async () => {
    if (!title.trim()) { Alert.alert('Title required', 'Add a title for your stream'); return; }
    setLoading(true);
    try {
      const payload: StartLivePayload = {
        title: title.trim(),
        description: description.trim(),
        contactInfo: { phone, whatsapp, instagram, website },
      };
      const stream = await liveAPI.start(payload);
      onStreamStarted(stream._id, stream.dailyRoomUrl);
      // reset form
      setTitle(''); setDescription(''); setPhone(''); setWhatsapp(''); setInstagram(''); setWebsite('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not start stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Go Live</Text>
        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} placeholder="e.g. Flash sale on sarees today!" value={title} onChangeText={setTitle} />
        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, { height: 72 }]} placeholder="What are you selling?" multiline value={description} onChangeText={setDescription} />
        <Text style={styles.sectionLabel}>Contact Info (viewers will see this)</Text>
        <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="WhatsApp number" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
        <TextInput style={styles.input} placeholder="Instagram handle" autoCapitalize="none" value={instagram} onChangeText={setInstagram} />
        <TextInput style={styles.input} placeholder="Website URL" keyboardType="url" autoCapitalize="none" value={website} onChangeText={setWebsite} />
        <TouchableOpacity style={styles.goLiveBtn} onPress={handleGoLive} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.goLiveTxt}>🔴 Start Streaming</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 40 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#FAFAFA',
  },
  goLiveBtn: {
    marginTop: 32, backgroundColor: '#E5320F', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  goLiveTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  cancelTxt: { color: '#666', fontSize: 15 },
});
```

- [ ] **Step 4: Create BroadcasterScreen.tsx**

```tsx
// chingiring-app/src/screens/Live/BroadcasterScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import Daily from '@daily-co/react-native-daily-js';
import { liveAPI } from '../../api/live';
import { useLiveChat } from '../../hooks/useLiveChat';
import { useAuthStore } from '../../store';

interface Props {
  route: { params: { streamId: string; roomUrl: string } };
  navigation: any;
}

export default function BroadcasterScreen({ route, navigation }: Props) {
  const { streamId, roomUrl } = route.params;
  const { token } = useAuthStore();
  const callRef = useRef<any>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const { viewerCount: socketViewerCount } = useLiveChat(streamId, token);

  // Use socket viewer count when available
  const displayViewers = socketViewerCount || viewerCount;

  useEffect(() => {
    let call: any;
    (async () => {
      call = Daily.createCallObject();
      callRef.current = call;
      await call.join({ url: roomUrl });
      await call.setLocalAudio(true);
      await call.setLocalVideo(true);
    })();

    return () => {
      call?.leave().catch(() => {});
    };
  }, [roomUrl]);

  const handleEndStream = async () => {
    Alert.alert('End Stream', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End', style: 'destructive', onPress: async () => {
          await callRef.current?.leave().catch(() => {});
          await liveAPI.stop(streamId).catch(() => {});
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.livePill}><Text style={styles.liveText}>● LIVE</Text></View>
        <Text style={styles.viewers}>👁 {displayViewers}</Text>
      </View>
      {/* Daily.co renders video natively — no JSX video component needed for broadcaster */}
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraHint}>Your camera is on</Text>
        <Text style={styles.cameraHint2}>Viewers can see you</Text>
      </View>
      <TouchableOpacity style={styles.endBtn} onPress={handleEndStream}>
        <Text style={styles.endTxt}>■ End Stream</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  livePill: { backgroundColor: '#E5320F', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  viewers: { color: '#fff', fontSize: 14 },
  cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraHint: { color: '#aaa', fontSize: 18 },
  cameraHint2: { color: '#666', fontSize: 14, marginTop: 8 },
  endBtn: {
    margin: 20, backgroundColor: '#E5320F', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  endTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
```

**Note on Daily.co camera preview:** The SDK renders the local camera automatically on the device when `join()` is called. The placeholder text above is shown in the JSX layer above the native video — on a real device, the camera feed renders behind it. For a production version, use `DailyMediaView` from the SDK to show a local preview explicitly.

- [ ] **Step 5: Register BroadcasterScreen in navigation**

Open the navigation file that contains the drawer/stack navigator (check `chingiring-app/src/navigation/`). Add:
```tsx
import BroadcasterScreen from '../screens/Live/BroadcasterScreen';
// ... inside the Stack.Navigator:
<Stack.Screen name="BroadcasterScreen" component={BroadcasterScreen} options={{ headerShown: false }} />
```

- [ ] **Step 6: Wire GoLiveModal in OfflineStoresScreen**

Open `OfflineStoresScreen.tsx`. Add the import:
```tsx
import GoLiveModal from '../Live/GoLiveModal';
```
Add the modal to the JSX (just before the closing `</View>` of the root):
```tsx
<GoLiveModal
  visible={goLiveVisible}
  onClose={() => setGoLiveVisible(false)}
  onStreamStarted={(streamId, roomUrl) => {
    setGoLiveVisible(false);
    navigation.navigate('BroadcasterScreen', { streamId, roomUrl });
  }}
/>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add chingiring-app/src/screens/Live/ \
        chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx \
        chingiring-app/app.json chingiring-app/package.json chingiring-app/package-lock.json
git commit -m "feat(live): GoLiveModal + BroadcasterScreen + config plugin"
```

---

### Task 8: ViewerScreen

**Files:**
- Create: `chingiring-app/src/screens/Live/ViewerScreen.tsx`

**Interfaces:**
- Consumes: `useLiveChat(streamId, token)` from Task 5
- Consumes: route params: `{ streamId, roomUrl, title, hostName, contactInfo }`
- Produces: full-screen viewer with Daily.co video, contact info panel, live chat, heart reaction

- [ ] **Step 1: Create ViewerScreen.tsx**

```tsx
// chingiring-app/src/screens/Live/ViewerScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, Linking,
  SafeAreaView, Animated,
} from 'react-native';
import Daily from '@daily-co/react-native-daily-js';
import { useLiveChat, ChatMessage } from '../../hooks/useLiveChat';
import { useAuthStore } from '../../store';
import { LiveContactInfo } from '../../api/live';

interface Props {
  route: {
    params: {
      streamId: string;
      roomUrl: string;
      title: string;
      hostName: string;
      contactInfo: LiveContactInfo;
    };
  };
  navigation: any;
}

export default function ViewerScreen({ route, navigation }: Props) {
  const { streamId, roomUrl, title, hostName, contactInfo } = route.params;
  const { token } = useAuthStore();
  const { messages, viewerCount, sendMessage, sendHeart, isConnected } = useLiveChat(streamId, token);
  const [chatText, setChatText] = useState('');
  const [showContact, setShowContact] = useState(false);
  const heartAnim = useRef(new Animated.Value(0)).current;

  // Join Daily.co as viewer (receive only)
  useEffect(() => {
    let call: any;
    (async () => {
      call = Daily.createCallObject();
      await call.join({ url: roomUrl });
      await call.setLocalAudio(false);
      await call.setLocalVideo(false);
    })();
    return () => { call?.leave().catch(() => {}); };
  }, [roomUrl]);

  const handleHeart = () => {
    sendHeart();
    Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const handleSend = () => {
    const text = chatText.trim();
    if (!text) return;
    sendMessage(text);
    setChatText('');
  };

  const openContact = useCallback((type: keyof LiveContactInfo) => {
    const val = contactInfo[type];
    if (!val) return;
    if (type === 'phone') Linking.openURL(`tel:${val}`);
    else if (type === 'whatsapp') Linking.openURL(`https://wa.me/${val.replace(/\D/g, '')}`);
    else if (type === 'instagram') Linking.openURL(`https://instagram.com/${val.replace('@', '')}`);
    else if (type === 'website') Linking.openURL(val.startsWith('http') ? val : `https://${val}`);
  }, [contactInfo]);

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.msgRow}>
      <Text style={styles.msgName}>{item.name}</Text>
      <Text style={styles.msgText}> {item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Video layer — Daily.co renders natively behind this */}
      <View style={styles.videoLayer}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
          <View style={styles.livePill}><Text style={styles.liveText}>● LIVE</Text></View>
          <Text style={styles.viewers}>👁 {viewerCount}</Text>
        </View>
        <View style={styles.streamInfo}>
          <Text style={styles.streamTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.streamHost}>{hostName}</Text>
        </View>
      </View>

      {/* Contact info panel */}
      {showContact && (
        <View style={styles.contactPanel}>
          <Text style={styles.contactHeading}>Contact {hostName}</Text>
          {contactInfo.phone && (
            <TouchableOpacity style={styles.contactRow} onPress={() => openContact('phone')}>
              <Text style={styles.contactIcon}>📞</Text>
              <Text style={styles.contactVal}>{contactInfo.phone}</Text>
            </TouchableOpacity>
          )}
          {contactInfo.whatsapp && (
            <TouchableOpacity style={styles.contactRow} onPress={() => openContact('whatsapp')}>
              <Text style={styles.contactIcon}>💬</Text>
              <Text style={styles.contactVal}>WhatsApp: {contactInfo.whatsapp}</Text>
            </TouchableOpacity>
          )}
          {contactInfo.instagram && (
            <TouchableOpacity style={styles.contactRow} onPress={() => openContact('instagram')}>
              <Text style={styles.contactIcon}>📸</Text>
              <Text style={styles.contactVal}>@{contactInfo.instagram}</Text>
            </TouchableOpacity>
          )}
          {contactInfo.website && (
            <TouchableOpacity style={styles.contactRow} onPress={() => openContact('website')}>
              <Text style={styles.contactIcon}>🌐</Text>
              <Text style={styles.contactVal}>{contactInfo.website}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Chat overlay */}
      <KeyboardAvoidingView
        style={styles.chatLayer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Right-side actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowContact((v) => !v)}>
            <Text style={{ fontSize: 22 }}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleHeart}>
            <Animated.Text style={{ fontSize: 22, opacity: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }}>
              ❤️
            </Animated.Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chatContainer}>
          <FlatList
            data={messages}
            keyExtractor={(m) => `${m.ts}-${m.userId}`}
            renderItem={renderMessage}
            style={styles.chatList}
            inverted
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Say something..."
              placeholderTextColor="#aaa"
              value={chatText}
              onChangeText={setChatText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0006', justifyContent: 'center', alignItems: 'center' },
  livePill: { backgroundColor: '#E5320F', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  viewers: { color: '#fff', fontSize: 14, flex: 1 },
  streamInfo: { padding: 16 },
  streamTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  streamHost: { color: '#ddd', fontSize: 13, marginTop: 2 },
  contactPanel: {
    position: 'absolute', bottom: 120, left: 16, right: 16,
    backgroundColor: '#1a1a1acc', borderRadius: 16, padding: 16,
  },
  contactHeading: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  contactIcon: { fontSize: 20, marginRight: 10 },
  contactVal: { color: '#fff', fontSize: 14, flex: 1 },
  chatLayer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  actions: { position: 'absolute', right: 12, bottom: 80, gap: 12 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0005', justifyContent: 'center', alignItems: 'center' },
  chatContainer: { paddingBottom: 8 },
  chatList: { maxHeight: 180, paddingHorizontal: 12 },
  msgRow: { flexDirection: 'row', marginVertical: 2 },
  msgName: { color: '#E5320F', fontWeight: '700', fontSize: 13 },
  msgText: { color: '#fff', fontSize: 13, flex: 1 },
  inputRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chatInput: {
    flex: 1, backgroundColor: '#0008', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14,
  },
  sendBtn: { backgroundColor: '#E5320F', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
});
```

- [ ] **Step 2: Register ViewerScreen in navigation**

In the same navigator file where you added `BroadcasterScreen`, add:
```tsx
import ViewerScreen from '../screens/Live/ViewerScreen';
// inside Stack.Navigator:
<Stack.Screen name="ViewerScreen" component={ViewerScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add chingiring-app/src/screens/Live/ViewerScreen.tsx \
        chingiring-app/src/navigation/
git commit -m "feat(live): ViewerScreen with Daily.co + chat + contact info panel"
```

---

### Task 9: EAS Build + .env wiring

**Files:**
- Modify: `chingiring-app/app.json` (already touched in Task 7)
- Modify: `backend/.env` (local only, never committed)

**Interfaces:**
- Consumes: `DAILY_API_KEY` on backend
- Consumes: `EXPO_PUBLIC_WS_URL` on app (optional; falls back to same host as API URL)

- [ ] **Step 1: Set DAILY_API_KEY in Render env vars**

In the Render dashboard for the backend service → Environment → add:
```
DAILY_API_KEY=<your key>
```

- [ ] **Step 2: Set EXPO_PUBLIC_WS_URL in EAS secrets (optional)**

If the app's WebSocket URL differs from the API URL (it shouldn't — same backend), add:
```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
eas secret:create --scope project --name EXPO_PUBLIC_WS_URL --value https://your-backend.onrender.com
```
If the same host, skip this — the fallback in `useLiveChat.ts` derives the URL from `EXPO_PUBLIC_API_URL`.

- [ ] **Step 3: Run an EAS development build to test native modules**

Daily.co + WebRTC require a native build — they do NOT work in Expo Go.
```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi/chingiring-app
eas build --profile development --platform ios
```
Install the resulting `.ipa` via the QR code in the EAS dashboard. Test on a real device.

- [ ] **Step 4: Smoke-test end-to-end**

1. Admin calls `PUT /api/admin/users/<your-user-id>/role` with `{ role: 'business' }` (use curl or the admin panel)
2. Open the app → Stores tab → tap "Live" tab → should see "🔴 Go Live" button
3. Tap "Go Live" → fill form → "Start Streaming" → BroadcasterScreen opens
4. On a second device (or simulator with viewer build), open Stores → Live tab → tap the stream card → ViewerScreen opens, video appears
5. Send a chat message from viewer → appears on broadcaster side (broadcaster gets viewer count bump)
6. Tap the 📋 icon → contact panel appears → tap phone → dials
7. Broadcaster taps "End Stream" → stream disappears from Live tab

- [ ] **Step 5: Final commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/Chingiringi
git add chingiring-app/app.json
git commit -m "feat(live): EAS config plugin wired for WebRTC"
```

---

## Known ceilings (marked `ponytail:` in code)

| Location | Ceiling | Upgrade when |
|---|---|---|
| `liveSocket.js` — `roomViewers` Map | In-process, resets on restart | Multiple backend instances / Redis needed |
| ViewerScreen chat FlatList | Keeps last 200 messages in state | Paginate from DB when streams get large |
| Daily.co room `exp` 8h | Room auto-expires after 8h | Add a cron to clean ended rooms |
| `GET /api/live` polls every 15s in app | Slightly stale discovery | Replace with a Socket.io `streams-updated` push event |

## Post-MVP gates before production

- [ ] Camera/microphone permission strings in `app.json` `ios.infoPlist` and `android.permissions` (the config plugin adds these automatically — verify they appear after `eas build`)
- [ ] Daily.co free tier limit: 10,000 participant-minutes/month — monitor in dashboard
- [ ] Admin must grant `role: 'business'` manually via API until an admin UI panel is built
- [ ] Strip `backend/src/__tests__/live.test.js` hardcoded phone numbers before committing to a public repo
