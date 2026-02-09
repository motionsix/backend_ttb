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
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  // Test write permission
  const testFile = path.join(UPLOAD_DIR, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('✅ Upload directory ready:', UPLOAD_DIR);
} catch (err) {
  console.error('⚠️ Upload directory permission error:', err.message);
  console.log('📁 Upload directory path:', UPLOAD_DIR);
}

/**
 * POST /api/upload/image
 * อัพโหลดรูปถ่ายกับผีเสื้อ
 * 
 * Body: { employee_id: string, image: base64 string }
 */
router.post('/image', async (req, res) => {
  console.log(`[Upload] Request received from employee_id: ${req.body?.employee_id}`);
  console.log(`[Upload] Image size: ${req.body?.image?.length || 0} chars`);
  
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
      console.log(`[Upload] ❌ User not found: ${employee_id}`);
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้'
      });
    }
    console.log(`[Upload] ✅ User found: ${users[0].employee_firstname} ${users[0].employee_lastname}`);

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

    // Save file with error handling
    const buffer = Buffer.from(base64Data, 'base64');
    
    try {
      fs.writeFileSync(filepath, buffer);
    } catch (writeError) {
      console.error('File write error:', writeError.message);
      console.error('Filepath:', filepath);
      
      // Return error with helpful message
      return res.status(500).json({
        success: false,
        error: 'ไม่สามารถบันทึกไฟล์ได้ กรุณาติดต่อผู้ดูแลระบบ',
        details: `Permission error: ${writeError.code}`
      });
    }

    // Generate URL (relative path)
    const imageUrl = `/uploads/${filename}`;

    // Update database - บันทึก url_image และ playing_status = true
    await pool.execute(
      'UPDATE users_new SET url_image = ?, playing_status = TRUE WHERE employee_id = ?',
      [imageUrl, employee_id]
    );

    // Get updated user
    const [updatedUser] = await pool.execute(
      'SELECT * FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    console.log(`[Upload] ✅ Image saved: ${filename} for employee: ${employee_id}`);
    console.log(`[Upload] ✅ Sending success response...`);

    res.json({
      success: true,
      message: 'อัพโหลดรูปสำเร็จ',
      url_image: imageUrl,
      user: {
        id: updatedUser[0].id,
        dept_id: updatedUser[0].dept_id,
        dept_descr: updatedUser[0].dept_descr,
        employee_id: updatedUser[0].employee_id,
        employee_firstname: updatedUser[0].employee_firstname,
        employee_lastname: updatedUser[0].employee_lastname,
        employee_name: `${updatedUser[0].employee_firstname} ${updatedUser[0].employee_lastname}`,
        url_image: updatedUser[0].url_image
      }
    });

  } catch (error) {
    console.error('[Upload] ❌ Error:', error.message);
    console.error('[Upload] ❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการอัพโหลด',
      details: error.message
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
