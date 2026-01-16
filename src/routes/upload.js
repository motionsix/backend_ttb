import { Router } from 'express';
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload directory
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Create upload directory if not exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/upload/image
 * อัพโหลดรูปถ่ายกับผีเสื้อ
 * 
 * Body: { employee_id: string, image: base64 string }
 */
router.post('/image', async (req, res) => {
  try {
    const { employee_id, image } = req.body;

    // Validate input
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาระบุรหัสพนักงาน'
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาส่งรูปภาพ'
      });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT * FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้'
      });
    }

    // Decode base64 image
    // Format: data:image/png;base64,xxxxx or just base64 string
    let base64Data = image;
    let extension = 'png';

    if (image.includes('data:image')) {
      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        extension = matches[1];
        base64Data = matches[2];
      }
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = `${employee_id}_${timestamp}.${extension}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Save file
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);

    // Generate URL (relative path)
    const imageUrl = `/uploads/${filename}`;

    // Update database
    await pool.execute(
      'UPDATE users_new SET url_image = ? WHERE employee_id = ?',
      [imageUrl, employee_id]
    );

    // Get updated user
    const [updatedUser] = await pool.execute(
      'SELECT * FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    console.log(`[Upload] Image saved: ${filename} for employee: ${employee_id}`);

    res.json({
      success: true,
      message: 'อัพโหลดรูปสำเร็จ',
      url_image: imageUrl,
      user: {
        id: updatedUser[0].id,
        employee_id: updatedUser[0].employee_id,
        name: updatedUser[0].name_employee,
        url_image: updatedUser[0].url_image
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการอัพโหลด'
    });
  }
});

/**
 * GET /api/upload/image/:employee_id
 * ดึงรูปของ user
 */
router.get('/image/:employee_id', async (req, res) => {
  try {
    const { employee_id } = req.params;

    const [users] = await pool.execute(
      'SELECT url_image FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้'
      });
    }

    res.json({
      success: true,
      url_image: users[0].url_image
    });

  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด'
    });
  }
});

export default router;
