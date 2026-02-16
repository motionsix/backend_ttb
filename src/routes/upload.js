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

// คอลัมน์ที่ใช้จริงใน users_new (ไม่ใช้ SELECT *)
const USER_COLUMNS = `id, dept_id, dept_descr, sub_chief, employee_id, employee_firstname, employee_lastname, create_date, last_login, playing_status, url_image`;

// Helper: สร้าง user response object (consistent กับ auth.js)
function formatUser(row) {
  return {
    id: row.id,
    dept_id: row.dept_id,
    dept_descr: row.dept_descr,
    sub_chief: row.sub_chief,
    employee_id: row.employee_id,
    employee_firstname: row.employee_firstname,
    employee_lastname: row.employee_lastname,
    employee_name: `${row.employee_firstname} ${row.employee_lastname}`,
    create_date: row.create_date,
    last_login: row.last_login,
    playing_status: row.playing_status,
    url_image: row.url_image
  };
}

// Validate employee_id format (5 digits)
const EMPLOYEE_ID_REGEX = /^\d{5}$/;

// ===== ป้องกันดิสก์เต็ม =====
const MAX_FILE_SIZE = 5 * 1024 * 1024;            // จำกัดรูปละ 5MB
const MAX_UPLOADS_FOLDER_SIZE = 3 * 1024 * 1024 * 1024; // จำกัด folder uploads ทั้งหมด 3GB (รองรับ ~6,000 รูป)

// คำนวณขนาด folder uploads ทั้งหมด
function getUploadsFolderSize() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) return 0;
    const files = fs.readdirSync(UPLOAD_DIR);
    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) totalSize += stat.size;
      } catch { /* skip files that can't be read */ }
    }
    return totalSize;
  } catch {
    return 0;
  }
}

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

    // Validate employee_id format (5 digits) — consistent กับ auth.js
    if (!EMPLOYEE_ID_REGEX.test(employee_id)) {
      return res.status(400).json({
        success: false,
        error: 'รหัสพนักงานต้องเป็นตัวเลข 5 หลัก'
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาส่งรูปภาพ'
      });
    }

    // Check if user exists (ใช้ explicit columns แทน SELECT *)
    const [users] = await pool.execute(
      `SELECT ${USER_COLUMNS} FROM users_new WHERE employee_id = ?`,
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

    // ลบรูปเก่าถ้ามี (ป้องกัน disk เต็ม)
    if (users[0].url_image) {
      const oldFilePath = path.join(__dirname, '../../', users[0].url_image);
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log(`[Upload] 🗑️ Deleted old image: ${users[0].url_image}`);
        }
      } catch (delErr) {
        console.warn(`[Upload] ⚠️ Could not delete old image: ${delErr.message}`);
      }
    }

    // Decode base64 image
    // Format: data:image/png;base64,xxxxx or just base64 string
    let base64Data = image;
    let extension = 'png';

    if (image.includes('data:image')) {
      const matches = image.match(/^data:image\/([\w+]+);base64,(.+)$/);
      if (matches) {
        extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        base64Data = matches[2];
      }
    }

    // Decode base64 → buffer ก่อน เพื่อเช็คขนาด
    const buffer = Buffer.from(base64Data, 'base64');

    // ===== ป้องกันดิสก์เต็ม: เช็คขนาดไฟล์ =====
    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    if (buffer.length > MAX_FILE_SIZE) {
      console.log(`[Upload] ❌ File too large: ${fileSizeMB}MB (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`);
      return res.status(413).json({
        success: false,
        error: `ไฟล์ใหญ่เกินไป (${fileSizeMB}MB) จำกัดสูงสุด ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }

    // ===== ป้องกันดิสก์เต็ม: เช็คพื้นที่ folder =====
    const currentFolderSize = getUploadsFolderSize();
    const currentFolderSizeMB = (currentFolderSize / (1024 * 1024)).toFixed(1);
    if (currentFolderSize + buffer.length > MAX_UPLOADS_FOLDER_SIZE) {
      console.error(`[Upload] ❌ Disk limit reached: ${currentFolderSizeMB}MB / ${MAX_UPLOADS_FOLDER_SIZE / (1024 * 1024)}MB`);
      return res.status(507).json({
        success: false,
        error: 'พื้นที่เก็บรูปเต็ม กรุณาติดต่อผู้ดูแลระบบ'
      });
    }

    console.log(`[Upload] 📦 File: ${fileSizeMB}MB | Folder: ${currentFolderSizeMB}MB / ${MAX_UPLOADS_FOLDER_SIZE / (1024 * 1024)}MB`);

    // Generate filename
    const timestamp = Date.now();
    const filename = `${employee_id}_${timestamp}.${extension}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Save file with error handling
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

    // ใช้ข้อมูลเดิม + อัพเดท fields ที่เปลี่ยน (ไม่ต้อง SELECT ใหม่)
    const updatedUser = { ...users[0], url_image: imageUrl, playing_status: 1 };

    console.log(`[Upload] ✅ Image saved: ${filename} for employee: ${employee_id}`);

    res.json({
      success: true,
      message: 'อัพโหลดรูปสำเร็จ',
      url_image: imageUrl,
      user: formatUser(updatedUser)
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

    // Validate employee_id format
    if (!EMPLOYEE_ID_REGEX.test(employee_id)) {
      return res.status(400).json({
        success: false,
        error: 'รหัสพนักงานต้องเป็นตัวเลข 5 หลัก'
      });
    }

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
