import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import connectDB from './config/db.js';
import User from './modules/users/userModel.js';
import { attachStreamSocket } from './modules/streams/streamSocket.js';

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;

// ── HTTP + Socket.io ────────────────────────────────────────────────────────
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Namespace for live streams
const streamNs = io.of('/stream');

// ── Socket auth middleware ──────────────────────────────────────────────────
streamNs.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
    || socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) {
    // Allow unauthenticated connections (viewers can be guests)
    socket.data.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('_id name role').lean();
    socket.data.user = user || null;
  } catch {
    socket.data.user = null;
  }
  next();
});

// Attach all stream event handlers
attachStreamSocket(streamNs);

// ── Start server ────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  httpServer.close(() => {
    process.exit(1);
  });
});
