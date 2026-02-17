import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root directory
const envPath = path.join(__dirname, '../../.env');
config({ path: envPath });

const isProduction = process.env.NODE_ENV === 'production';

// Debug: Log เฉพาะ dev mode (ไม่ log credentials ใน production)
if (!isProduction) {
  console.log('📁 Loading .env from:', envPath);
  console.log('🔧 DB Config:', {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || '(not set - using root)',
    database: process.env.DB_NAME || 'ttbwebar_db'
  });
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ttbwebar_db',
  waitForConnections: true,
  connectionLimit: 50,           // รองรับ 30,000 คน (50 concurrent connections + queue)
  queueLimit: 5000,              // รอคิวได้ 5,000 requests
  acquireTimeout: 30000,         // timeout 30 วินาที
  idleTimeout: 60000             // ปิด connection ที่ไม่ใช้หลัง 60 วินาที
});

// Test connection
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

export default pool;
