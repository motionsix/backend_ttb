import { Router } from 'express';
import pool from '../config/database.js';

const router = Router();

/**
 * POST /api/auth/login
 * Login สำหรับ Unity WebGL
 * 
 * Body: { name: string, employee_id: string }
 * 
 * Flow:
 * 1. Validate employee_id (5 หลัก)
 * 2. เช็คว่า employee_id มีอยู่ใน users_data หรือไม่
 * 3. ถ้ามี → เช็คใน users_new
 * 4. ถ้ายังไม่มีใน users_new → สร้างใหม่
 * 5. อัพเดท last_login
 */
router.post('/login', async (req, res) => {
  try {
    const { name, employee_id } = req.body;

    // Validate input
    if (!name || !employee_id) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกชื่อและรหัสพนักงาน'
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

    // Step 1: Check if employee_id exists in users_data
    const [usersData] = await pool.execute(
      'SELECT id, employee_id FROM users_data WHERE employee_id = ?',
      [employee_id]
    );

    if (usersData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบรหัสพนักงานในระบบ'
      });
    }

    // Step 2: Check if user already exists in users_new
    const [existingUser] = await pool.execute(
      'SELECT * FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    let user;
    let isNewUser = false;

    if (existingUser.length === 0) {
      // Step 3: Create new user in users_new
      const [result] = await pool.execute(
        `INSERT INTO users_new (employee_id, name_employee, create_date, last_login, playing_status, reward_status) 
         VALUES (?, ?, NOW(), NOW(), FALSE, NULL)`,
        [employee_id, name.trim()]
      );

      // Get the newly created user
      const [newUser] = await pool.execute(
        'SELECT * FROM users_new WHERE id = ?',
        [result.insertId]
      );

      user = newUser[0];
      isNewUser = true;
    } else {
      // Step 3.5: เช็คว่าชื่อตรงกับที่ลงทะเบียนไว้หรือไม่
      const registeredName = existingUser[0].name_employee;
      const inputName = name.trim();

      if (registeredName.toLowerCase() !== inputName.toLowerCase()) {
        return res.status(401).json({
          success: false,
          error: 'ชื่อไม่ตรงกับที่ลงทะเบียนไว้',
          hint: 'กรุณากรอกชื่อให้ตรงกับที่ลงทะเบียนครั้งแรก'
        });
      }

      // Step 4: Update last_login for existing user
      await pool.execute(
        'UPDATE users_new SET last_login = NOW() WHERE employee_id = ?',
        [employee_id]
      );

      // Get updated user
      const [updatedUser] = await pool.execute(
        'SELECT * FROM users_new WHERE employee_id = ?',
        [employee_id]
      );

      user = updatedUser[0];
    }

    // Return success response
    res.json({
      success: true,
      message: isNewUser ? 'ลงทะเบียนสำเร็จ' : 'เข้าสู่ระบบสำเร็จ',
      isNewUser,
      user: {
        id: user.id,
        employee_id: user.employee_id,
        name: user.name_employee,
        create_date: user.create_date,
        last_login: user.last_login,
        playing_status: user.playing_status,
        reward_status: user.reward_status
      }
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
      'SELECT * FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    res.json({
      success: true,
      exists_in_system: true,
      registered: usersNew.length > 0,
      user: usersNew.length > 0 ? {
        id: usersNew[0].id,
        employee_id: usersNew[0].employee_id,
        name: usersNew[0].name_employee,
        playing_status: usersNew[0].playing_status,
        reward_status: usersNew[0].reward_status
      } : null
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
 * POST /api/auth/spin-reward
 * สุ่มรางวัล - เมื่อ user กดปุ่มสุ่ม
 * 
 * Flow:
 * 1. เช็คว่า user เล่นแล้วหรือยัง (playing_status)
 * 2. ถ้าเล่นแล้ว → ไม่ให้สุ่มซ้ำ
 * 3. ถ้ายังไม่เล่น → สุ่มรางวัล
 * 4. ถ้าได้รางวัลใหญ่ → ลด rewards_cont
 * 5. บันทึก playing_status = true และ reward_status
 */
router.post('/spin-reward', async (req, res) => {
  try {
    const { employee_id } = req.body;

    // Validate input
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาระบุรหัสพนักงาน'
      });
    }

    // Step 1: Check if user exists and hasn't played yet
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

    const user = users[0];

    // Step 2: Check if already played
    if (user.playing_status) {
      return res.status(400).json({
        success: false,
        error: 'คุณได้เล่นไปแล้ว',
        alreadyPlayed: true,
        reward_status: user.reward_status ? JSON.parse(user.reward_status) : null
      });
    }

    // Step 3: Get current rewards count
    const [rewards] = await pool.execute(
      'SELECT * FROM rewards WHERE id = 1'
    );

    let rewardsCount = 0;
    if (rewards.length > 0) {
      rewardsCount = rewards[0].rewards_cont;
    }

    // Step 4: Random spin logic
    // ถ้ายังมีรางวัลใหญ่เหลือ → มีโอกาสได้
    // ถ้าไม่มีรางวัลใหญ่เหลือ → ได้แค่รางวัลปลอบใจ
    let wonBigPrize = false;
    let winChance = 0.1; // 10% chance to win big prize (ปรับได้)

    if (rewardsCount > 0) {
      // สุ่มว่าได้รางวัลใหญ่หรือไม่
      const randomValue = Math.random();
      wonBigPrize = randomValue < winChance;
    }

    // Step 5: If won big prize, decrement rewards_cont
    if (wonBigPrize) {
      await pool.execute(
        'UPDATE rewards SET rewards_cont = rewards_cont - 1 WHERE id = 1 AND rewards_cont > 0'
      );
    }

    // Step 6: Create reward status object
    const rewardStatus = {
      won_big_prize: wonBigPrize,
      prize_type: wonBigPrize ? 'big' : 'consolation',
      spin_date: new Date().toISOString()
    };

    // Step 7: Update user - set playing_status = true and save reward_status
    await pool.execute(
      'UPDATE users_new SET playing_status = TRUE, reward_status = ? WHERE employee_id = ?',
      [JSON.stringify(rewardStatus), employee_id]
    );

    // Step 8: Get updated user
    const [updatedUser] = await pool.execute(
      'SELECT * FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    // Step 9: Get updated rewards count
    const [updatedRewards] = await pool.execute(
      'SELECT rewards_cont FROM rewards WHERE id = 1'
    );

    res.json({
      success: true,
      message: wonBigPrize ? '🎉 ยินดีด้วย! คุณได้รางวัลใหญ่!' : '🎁 คุณได้รางวัลปลอบใจ',
      won_big_prize: wonBigPrize,
      reward_status: rewardStatus,
      remaining_big_prizes: updatedRewards.length > 0 ? updatedRewards[0].rewards_cont : 0,
      user: {
        id: updatedUser[0].id,
        employee_id: updatedUser[0].employee_id,
        name: updatedUser[0].name_employee,
        playing_status: updatedUser[0].playing_status,
        reward_status: rewardStatus
      }
    });

  } catch (error) {
    console.error('Spin reward error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

/**
 * GET /api/auth/rewards-count
 * ดูจำนวนรางวัลใหญ่ที่เหลือ
 */
router.get('/rewards-count', async (req, res) => {
  try {
    const [rewards] = await pool.execute(
      'SELECT rewards_cont FROM rewards WHERE id = 1'
    );

    res.json({
      success: true,
      rewards_cont: rewards.length > 0 ? rewards[0].rewards_cont : 0
    });

  } catch (error) {
    console.error('Get rewards count error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

/**
 * PUT /api/auth/playing-status
 * อัพเดท playing_status เมื่อเริ่มเล่นเกม
 */
router.put('/playing-status', async (req, res) => {
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

    // Update playing_status
    const [result] = await pool.execute(
      'UPDATE users_new SET playing_status = ? WHERE employee_id = ?',
      [playing_status, employee_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้'
      });
    }

    // Get updated user
    const [updatedUser] = await pool.execute(
      'SELECT * FROM users_new WHERE employee_id = ?',
      [employee_id]
    );

    res.json({
      success: true,
      message: 'อัพเดทสถานะสำเร็จ',
      user: {
        id: updatedUser[0].id,
        employee_id: updatedUser[0].employee_id,
        name: updatedUser[0].name_employee,
        playing_status: updatedUser[0].playing_status,
        reward_status: updatedUser[0].reward_status
      }
    });

  } catch (error) {
    console.error('Update playing status error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

export default router;
