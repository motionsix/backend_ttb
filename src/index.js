import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import importRoutes from './routes/import.js';
import { testConnection } from './config/database.js';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiter - ป้องกัน spam
// ⚠️ งาน event 3,000 คน share WiFi เดียวกัน = IP เดียวกัน
// คนละ ~4 requests (login, check, upload, result) × 3,000 = 12,000 requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 นาที
  max: 15000,                 // 15,000 requests ต่อ window ต่อ IP (รองรับ 3,000+ คน share WiFi)
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload Limiter - สำหรับ upload
// งาน event: 3,000 คนอาจ share IP เดียวกัน → ต้องรองรับ 3,000+ uploads ต่อ window
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,                  // 5,000 uploads ต่อ 15 นาที ต่อ IP (รองรับ retake ด้วย)
  message: { success: false, error: 'Upload limit exceeded, please try again later.' },
});

// Middleware
app.use(compression());       // บีบอัด response ให้เร็วขึ้น
app.use(cors());
app.use(limiter);             // Rate limiting
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files - serve uploaded images (cache 1 วัน)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Routes
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);  // จำกัด upload
app.use('/api/import', importRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  try {
    await testConnection();
  } catch (error) {
    console.error('Database connection error:', error.message);
  }
});

