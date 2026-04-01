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

const app = express();
app.set('trust proxy', 1); // Enable trust proxy for Render load balancer to recognize HTTPS cookies


// Security HTTP headers
app.use(helmet());

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:8081', 
    'http://192.168.1.90:8081', 
    'https://chingiringi-web-app.onrender.com',
    'https://chingiring-web-app.onrender.com', // Added possible variant
    'https://chingiringi.com' // Future domain
  ],
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

// Routes will be mounted here
app.use('/auth', authRoutes);

// Unhandled routes
app.all('*', notFound);

// Global error handler
app.use(errorHandler);

export default app;
