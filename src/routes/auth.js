import { Router } from 'express';
import pool from '../config/database.js';

const router = Router();

// คอลัมน์ที่ใช้จริงใน users_new (ไม่ใช้ SELECT *)
const USER_COLUMNS = `id, dept_id, dept_descr, sub_chief, employee_id, employee_firstname, employee_lastname, create_date, last_login, playing_status, url_image`;

// Helper: สร้าง user response object
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

/**
 * POST /api/auth/login
 * Login สำหรับ Unity WebGL - ใช้แค่รหัสพนักงานเท่านั้น
 * 
 * Body: { employee_id: string }
 * 
 * Flow:
 * 1. Validate employee_id (5 หลัก)
 * 2. เช็คว่า employee_id มีอยู่ใน users_data หรือไม่
 * 3. ถ้ามี → เช็คใน users_new
 * 4. ถ้ายังไม่มีใน users_new → สร้างใหม่ (auto-populate จาก users_data)
 * 5. อัพเดท last_login
 */
router.post('/login', async (req, res) => {
  try {
    const { employee_id } = req.body;

    // Validate input
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกรหัสพนักงาน'
      });
    }

    // Validate employee_id format (5 digits)
    const employeeIdRegex = /^\d{5}$/;
    if (!employeeIdRegex.test(employee_id)) {
      return res.status(400).json({
        success: false,
        error: 'รหัสพนักงานต้องเป็นตัวเลข 5 หลัก'
      });
    }

    // Step 1: Check if employee_id exists in users_data and get employee info
    const [usersData] = await pool.execute(
      `SELECT employee_id, dept_id, dept_descr, sub_chief, employee_firstname, employee_lastname 
       FROM users_data WHERE employee_id = ?`,
      [employee_id]
    );

    if (usersData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบรหัสพนักงานในระบบ'
      });
    }

    const employeeData = usersData[0];

    // Step 2: Check if user already exists in users_new
    const [existingUser] = await pool.execute(
      `SELECT ${USER_COLUMNS} FROM users_new WHERE employee_id = ?`,
      [employee_id]
    );

    let user;
    let isNewUser = false;

    if (existingUser.length === 0) {
      // Step 3: Create new user in users_new (auto-populate from users_data)
      const [result] = await pool.execute(
        `INSERT INTO users_new (dept_id, dept_descr, sub_chief, employee_id, employee_firstname, employee_lastname, create_date, last_login, playing_status) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), FALSE)`,
        [
          employeeData.dept_id,
          employeeData.dept_descr,
          employeeData.sub_chief,
          employee_id,
          employeeData.employee_firstname,
          employeeData.employee_lastname
        ]
      );

      // Get the newly created user
      const [newUser] = await pool.execute(
        `SELECT ${USER_COLUMNS} FROM users_new WHERE id = ?`,
        [result.insertId]
      );

      user = newUser[0];
      isNewUser = true;
    } else {
      // Step 4: Update last_login for existing user
      await pool.execute(
        'UPDATE users_new SET last_login = NOW() WHERE employee_id = ?',
        [employee_id]
      );

      // ใช้ข้อมูลที่ SELECT มาแล้ว อัพเดทแค่ last_login
      user = { ...existingUser[0], last_login: new Date() };
    }

    // Return success response
    res.json({
      success: true,
      message: isNewUser ? 'ลงทะเบียนสำเร็จ' : 'เข้าสู่ระบบสำเร็จ',
      isNewUser,
      user: formatUser(user)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

/**
 * GET /api/auth/check/:employee_id
 * เช็คสถานะ user
 */
router.get('/check/:employee_id', async (req, res) => {
  try {
    const { employee_id } = req.params;

    // Validate employee_id format
    const employeeIdRegex = /^\d{5}$/;
    if (!employeeIdRegex.test(employee_id)) {
      return res.status(400).json({
        success: false,
        error: 'รหัสพนักงานต้องเป็นตัวเลข 5 หลัก'
      });
    }

    // Check in users_data
    const [usersData] = await pool.execute(
      'SELECT employee_id FROM users_data WHERE employee_id = ?',
      [employee_id]
    );

    if (usersData.length === 0) {
      return res.json({
        success: true,
        exists_in_system: false,
        registered: false
      });
    }

    // Check in users_new
    const [usersNew] = await pool.execute(
      `SELECT ${USER_COLUMNS} FROM users_new WHERE employee_id = ?`,
      [employee_id]
    );

    res.json({
      success: true,
      exists_in_system: true,
      registered: usersNew.length > 0,
      user: usersNew.length > 0 ? formatUser(usersNew[0]) : null
    });

  } catch (error) {
    console.error('Check user error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

/**
 * POST /api/auth/playing-status
 * อัพเดท playing_status เมื่อเล่นเกมเสร็จ
 * 
 * Body: { employee_id: string, playing_status: boolean }
 */
router.post('/playing-status', async (req, res) => {
  try {
    const { employee_id, playing_status } = req.body;

    // Validate input
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาระบุรหัสพนักงาน'
      });
    }

    if (typeof playing_status !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'กรุณาระบุ playing_status (true/false)'
      });
    }

    // Check if user exists
    const [users] = await pool.execute(
      `SELECT playing_status FROM users_new WHERE employee_id = ?`,
      [employee_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้'
      });
    }

    // Check if already played (can't change back to false)
    if (users[0].playing_status && !playing_status) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถเปลี่ยนสถานะกลับเป็น false ได้'
      });
    }

    // Update playing_status
    await pool.execute(
      'UPDATE users_new SET playing_status = ? WHERE employee_id = ?',
      [playing_status, employee_id]
    );

    // Get updated user
    const [updatedUser] = await pool.execute(
      `SELECT ${USER_COLUMNS} FROM users_new WHERE employee_id = ?`,
      [employee_id]
    );

    res.json({
      success: true,
      message: 'อัพเดทสถานะสำเร็จ',
      user: formatUser(updatedUser[0])
    });

  } catch (error) {
    console.error('Update playing status error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

/**
 * POST /api/auth/mark-played
 * บันทึกว่าเล่นแล้ว (shortcut สำหรับ set playing_status = true)
 * 
 * Body: { employee_id: string }
 */
router.post('/mark-played', async (req, res) => {
  try {
    const { employee_id } = req.body;

    // Validate input
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาระบุรหัสพนักงาน'
      });
    }

    // Check if user exists
    const [users] = await pool.execute(
      `SELECT ${USER_COLUMNS} FROM users_new WHERE employee_id = ?`,
      [employee_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้'
      });
    }

    // Check if already played
    if (users[0].playing_status) {
      return res.status(400).json({
        success: false,
        error: 'ผู้ใช้เล่นไปแล้ว',
        already_played: true,
        user: formatUser(users[0])
      });
    }

    // Update playing_status to true
    await pool.execute(
      'UPDATE users_new SET playing_status = TRUE WHERE employee_id = ?',
      [employee_id]
    );

    // ใช้ข้อมูลเดิม แค่อัพเดท playing_status (ไม่ต้อง SELECT ใหม่)
    const updatedUser = { ...users[0], playing_status: 1 };

    res.json({
      success: true,
      message: 'บันทึกสถานะเล่นแล้วสำเร็จ',
      user: formatUser(updatedUser)
    });

  } catch (error) {
    console.error('Mark played error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

export default router;
