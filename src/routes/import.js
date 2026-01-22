import { Router } from 'express';
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /api/import/csv
 * Import ข้อมูลพนักงานจาก CSV file ที่อยู่ใน src/data/
 */
router.post('/csv', async (req, res) => {
  try {
    const csvPath = path.join(__dirname, '../data/Mock Up_Manlist_Fly High_edit.csv');
    
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({
        success: false,
        error: 'CSV file not found'
      });
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Skip header
    const dataLines = lines.slice(1);
    
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      const columns = line.split(',').map(col => col.trim());
      
      if (columns.length < 6) {
        skipped++;
        continue;
      }

      const [employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief] = columns;

      try {
        // Check if already exists
        const [existing] = await pool.execute(
          'SELECT id FROM users_data WHERE employee_id = ?',
          [employee_id]
        );

        if (existing.length > 0) {
          // Update existing
          await pool.execute(
            `UPDATE users_data SET 
              employee_firstname = ?, 
              employee_lastname = ?, 
              dept_id = ?, 
              dept_descr = ?, 
              sub_chief = ?
            WHERE employee_id = ?`,
            [employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief, employee_id]
          );
        } else {
          // Insert new
          await pool.execute(
            `INSERT INTO users_data (employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief]
          );
        }
        
        imported++;
      } catch (err) {
        errors.push({ employee_id, error: err.message });
        skipped++;
      }
    }

    res.json({
      success: true,
      message: `Import completed`,
      imported,
      skipped,
      total: dataLines.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/import/stats
 * ดูสถิติข้อมูลใน database
 */
router.get('/stats', async (req, res) => {
  try {
    const [usersData] = await pool.execute('SELECT COUNT(*) as count FROM users_data');
    const [usersNew] = await pool.execute('SELECT COUNT(*) as count FROM users_new');
    const [played] = await pool.execute('SELECT COUNT(*) as count FROM users_new WHERE playing_status = TRUE');

    res.json({
      success: true,
      stats: {
        users_data: usersData[0].count,
        users_new: usersNew[0].count,
        played: played[0].count
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
