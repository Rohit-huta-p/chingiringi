import dotenv from 'dotenv';
dotenv.config();
import 'express-async-errors';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './modules/auth/authRoutes.js';
import dealRoutes from './modules/deals/dealRoutes.js';
import categoryRoutes from './modules/categories/categoryRoutes.js';
import bannerRoutes from './modules/banners/bannerRoutes.js';
import walletRoutes from './modules/wallet/walletRoutes.js';
import shareRoutes from './modules/shares/shareRoutes.js';
import referralRoutes from './modules/referrals/referralRoutes.js';
import profileRoutes from './modules/users/profileRoutes.js';
import addressRoutes from './modules/addresses/addressRoutes.js';
import adminRoutes from './modules/admin/adminRoutes.js';
import couponRoutes from './modules/coupons/couponRoutes.js';
import productRoutes from './modules/products/productRoutes.js';
import reviewRoutes from './modules/reviews/reviewRoutes.js';
import clickRoutes from './modules/clicks/clickRoutes.js';
import notificationRoutes from './modules/notifications/notificationRoutes.js';
import storeRoutes from './modules/stores/storeRoutes.js';
import paymentsWebhookRoutes from './modules/payments/paymentsRoutes.js';

const app = express();
app.set('trust proxy', 1); // Enable trust proxy for Render load balancer to recognize HTTPS cookies


// Security HTTP headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Razorpay webhook needs the RAW request body to verify the HMAC signature, so
// it is mounted BEFORE express.json() (which would parse & discard the bytes).
app.use('/api/webhooks/razorpay', express.raw({ type: '*/*' }), paymentsWebhookRoutes);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// Enable CORS
const allowedOrigins = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8001',
  'http://localhost:8000',
  'http://192.168.1.55:8081',
  'http://192.168.1.55:8082',
  'https://chingiringi-web-app.onrender.com',
  'https://chingiring-web-app.onrender.com',
  'https://chingiringi.com',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/products', productRoutes);
app.use('/api/products', reviewRoutes);
app.use('/api/clicks', clickRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stores', storeRoutes);

// Unhandled routes
app.all('*', notFound);

// Global error handler
app.use(errorHandler);

export default app;
