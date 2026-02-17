import { Router } from 'express';
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Batch size สำหรับ insert/update ทีละกี่แถว
const BATCH_SIZE = 500;

// API Key สำหรับ import/reset (ป้องกันไม่ให้ใครก็เรียกได้)
const IMPORT_API_KEY = process.env.IMPORT_API_KEY || 'ttb-import-2026';

// Middleware: ตรวจสอบ API key
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (apiKey !== IMPORT_API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Invalid API key'
    });
  }
  next();
}

/**
 * POST /api/import/csv
 * Import ข้อมูลพนักงานจาก CSV file ที่อยู่ใน src/data/
 * รองรับข้อมูลขนาดใหญ่ (13,000+ rows) ด้วย batch processing
 * ต้องส่ง header: x-api-key
 */
router.post('/csv', requireApiKey, async (req, res) => {
  try {
    const csvPath = path.join(__dirname, '../data/data.csv');
    
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

    // Parse ข้อมูลทั้งหมดก่อน
    const records = [];
    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      const columns = line.split(',').map(col => col.trim());
      
      if (columns.length < 6) {
        skipped++;
        continue;
      }

      const [employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief] = columns;
      
      // Validate employee_id
      if (!employee_id || employee_id.length === 0) {
        skipped++;
        continue;
      }

      records.push({ employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief });
    }

    console.log(`[Import] Parsed ${records.length} records from CSV, processing in batches of ${BATCH_SIZE}...`);

    // Batch processing ด้วย INSERT ... ON DUPLICATE KEY UPDATE
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      try {
        // สร้าง VALUES placeholders สำหรับ batch
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flatMap(r => [
          r.employee_id, r.employee_firstname, r.employee_lastname,
          r.dept_id, r.dept_descr, r.sub_chief
        ]);

        // INSERT ... ON DUPLICATE KEY UPDATE — ถ้ามีอยู่แล้วจะ update ข้อมูล
        // ใช้ pool.query() แทน pool.execute() เพราะ dynamic SQL (placeholders เปลี่ยนตาม batch size)
        // pool.execute() จะสร้าง prepared statement ใหม่ทุกครั้งที่ SQL ต่างกัน = สิ้นเปลือง
        await pool.query(
          `INSERT INTO users_data (employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE
             employee_firstname = VALUES(employee_firstname),
             employee_lastname = VALUES(employee_lastname),
             dept_id = VALUES(dept_id),
             dept_descr = VALUES(dept_descr),
             sub_chief = VALUES(sub_chief)`,
          values
        );

        imported += batch.length;
        console.log(`[Import] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records processed (${imported}/${records.length})`);
      } catch (err) {
        console.error(`[Import] Batch error at offset ${i}:`, err.message);
        
        // Fallback: ทำทีละ row สำหรับ batch ที่ error
        for (const record of batch) {
          try {
            await pool.query(
              `INSERT INTO users_data (employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 employee_firstname = VALUES(employee_firstname),
                 employee_lastname = VALUES(employee_lastname),
                 dept_id = VALUES(dept_id),
                 dept_descr = VALUES(dept_descr),
                 sub_chief = VALUES(sub_chief)`,
              [record.employee_id, record.employee_firstname, record.employee_lastname,
               record.dept_id, record.dept_descr, record.sub_chief]
            );
            imported++;
          } catch (rowErr) {
            errors.push({ employee_id: record.employee_id, error: rowErr.message });
            skipped++;
          }
        }
      }
    }

    console.log(`[Import] ✅ Completed: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);

    res.json({
      success: true,
      message: `Import completed`,
      imported,
      skipped,
      total: records.length + skipped,
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
 * POST /api/import/sync
 * Sync ข้อมูลพนักงาน — รองรับทั้ง 3 กรณี:
 *   1. คนเข้าใหม่ → เพิ่มเข้า DB
 *   2. อัพเดทข้อมูล → อัพเดทใน DB
 *   3. คนออกไป → ลบออกจาก DB (ลบ users_new + รูปด้วย)
 */
router.post('/sync', requireApiKey, async (req, res) => {
  try {
    const csvPath = path.join(__dirname, '../data/data.csv');

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ success: false, error: 'CSV file not found' });
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // skip header

    // ── 1. Parse CSV ──
    const csvRecords = [];
    const csvEmployeeIds = new Set();
    let parseSkipped = 0;

    for (const line of dataLines) {
      if (!line.trim()) continue;
      const columns = line.split(',').map(col => col.trim());
      if (columns.length < 6) { parseSkipped++; continue; }

      const [employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief] = columns;
      if (!employee_id || employee_id.length === 0) { parseSkipped++; continue; }

      csvRecords.push({ employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief });
      csvEmployeeIds.add(employee_id);
    }

    console.log(`[Sync] Parsed ${csvRecords.length} records from CSV`);

    // ── 2. Import (เพิ่มใหม่ + อัพเดท) ──
    let imported = 0;
    const importErrors = [];

    for (let i = 0; i < csvRecords.length; i += BATCH_SIZE) {
      const batch = csvRecords.slice(i, i + BATCH_SIZE);
      try {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flatMap(r => [
          r.employee_id, r.employee_firstname, r.employee_lastname,
          r.dept_id, r.dept_descr, r.sub_chief
        ]);

        await pool.query(
          `INSERT INTO users_data (employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE
             employee_firstname = VALUES(employee_firstname),
             employee_lastname = VALUES(employee_lastname),
             dept_id = VALUES(dept_id),
             dept_descr = VALUES(dept_descr),
             sub_chief = VALUES(sub_chief)`,
          values
        );
        imported += batch.length;
      } catch (err) {
        // Fallback ทีละ row
        for (const record of batch) {
          try {
            await pool.query(
              `INSERT INTO users_data (employee_id, employee_firstname, employee_lastname, dept_id, dept_descr, sub_chief)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 employee_firstname = VALUES(employee_firstname),
                 employee_lastname = VALUES(employee_lastname),
                 dept_id = VALUES(dept_id),
                 dept_descr = VALUES(dept_descr),
                 sub_chief = VALUES(sub_chief)`,
              [record.employee_id, record.employee_firstname, record.employee_lastname,
               record.dept_id, record.dept_descr, record.sub_chief]
            );
            imported++;
          } catch (rowErr) {
            importErrors.push({ employee_id: record.employee_id, error: rowErr.message });
          }
        }
      }
    }

    // ── 3. หาคนที่อยู่ใน DB แต่ไม่อยู่ใน CSV (คนออก) ──
    const [allDbEmployees] = await pool.execute('SELECT employee_id FROM users_data');
    const removedIds = allDbEmployees
      .map(row => row.employee_id)
      .filter(id => !csvEmployeeIds.has(id));

    let removedCount = 0;
    let removedPlayed = 0;
    const removedErrors = [];
    const UPLOAD_DIR = path.join(__dirname, '../../uploads');

    for (const empId of removedIds) {
      try {
        // เช็คว่ามีใน users_new หรือไม่
        const [userNew] = await pool.execute(
          'SELECT employee_id, url_image, playing_status FROM users_new WHERE employee_id = ?',
          [empId]
        );

        if (userNew.length > 0) {
          // ลบรูปออกจาก disk ถ้ามี
          if (userNew[0].url_image) {
            const imgPath = path.join(UPLOAD_DIR, path.basename(userNew[0].url_image));
            try {
              if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
            } catch { /* skip */ }
          }
          if (userNew[0].playing_status) removedPlayed++;

          // ลบ users_new ก่อน (FK constraint)
          await pool.execute('DELETE FROM users_new WHERE employee_id = ?', [empId]);
        }

        // ลบ users_data
        await pool.execute('DELETE FROM users_data WHERE employee_id = ?', [empId]);
        removedCount++;
      } catch (err) {
        removedErrors.push({ employee_id: empId, error: err.message });
      }
    }

    console.log(`[Sync] ✅ Done: ${imported} imported/updated, ${removedCount} removed (${removedPlayed} had played)`);

    res.json({
      success: true,
      message: 'Sync completed',
      summary: {
        csv_total: csvRecords.length,
        imported_or_updated: imported,
        removed: removedCount,
        removed_had_played: removedPlayed,
        parse_skipped: parseSkipped,
        errors: [...importErrors, ...removedErrors].length > 0
          ? [...importErrors, ...removedErrors]
          : undefined
      }
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/import/reset
 * ล้างข้อมูลทั้งหมด (users_new ก่อน เพราะมี FK → users_data)
 */
router.post('/reset', requireApiKey, async (req, res) => {
  try {
    // ลบ users_new ก่อน (มี FK reference ไป users_data)
    const [deletedNew] = await pool.execute('DELETE FROM users_new');
    console.log(`[Reset] Deleted ${deletedNew.affectedRows} rows from users_new`);

    // ลบ users_data
    const [deletedData] = await pool.execute('DELETE FROM users_data');
    console.log(`[Reset] Deleted ${deletedData.affectedRows} rows from users_data`);

    res.json({
      success: true,
      message: 'ล้างข้อมูลสำเร็จ',
      deleted: {
        users_new: deletedNew.affectedRows,
        users_data: deletedData.affectedRows
      }
    });

  } catch (error) {
    console.error('Reset error:', error);
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
