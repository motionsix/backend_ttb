-- TTB WebAR Database Schema

-- Table: users_data (ข้อมูลพนักงานจากลูกค้า - import จาก CSV)
CREATE TABLE IF NOT EXISTS users_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dept_id VARCHAR(4) NOT NULL,
  dept_descr VARCHAR(255) NOT NULL,
  sub_chief VARCHAR(255) NOT NULL,
  employee_id VARCHAR(5) NOT NULL UNIQUE,
  employee_firstname VARCHAR(255) NOT NULL,
  employee_lastname VARCHAR(255) NOT NULL,
  INDEX idx_employee_id (employee_id),
  INDEX idx_dept_id (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: users_new (ผู้ใช้ที่ลงทะเบียนในระบบ)
CREATE TABLE IF NOT EXISTS users_new (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dept_id VARCHAR(4) NOT NULL,
  dept_descr VARCHAR(255) NOT NULL,
  sub_chief VARCHAR(255) NOT NULL,
  employee_id VARCHAR(5) NOT NULL UNIQUE,
  employee_firstname VARCHAR(255) NOT NULL,
  employee_lastname VARCHAR(255) NOT NULL,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  playing_status BOOLEAN DEFAULT FALSE,
  url_image VARCHAR(500) DEFAULT NULL,
  INDEX idx_employee_id (employee_id),
  INDEX idx_dept_id (dept_id),
  FOREIGN KEY (employee_id) REFERENCES users_data(employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Import ข้อมูลพนักงานจาก CSV (Mock Up_Manlist_Fly High_edit.csv)
-- =====================================================
INSERT INTO users_data (dept_id, dept_descr, sub_chief, employee_id, employee_firstname, employee_lastname) VALUES
('2000', 'เอส โอเอซิส', 'CRO', '04858', 'กรุณา', 'เหล่าประชัยวัลย์'),
('1000', 'สำนักงานใหญ่', 'COO', '04863', 'จันทิมา', 'จิรพรเจริญสุข'),
('1000', 'สำนักงานใหญ่', 'COO', '05341', 'กิติมา', 'สิทธิโภควัฒน์'),
('1000', 'สำนักงานใหญ่', 'COO', '05444', 'สุภมาส', 'เขียวไพรี'),
('0916', 'สาขาทองหล่อ ซอย 17', 'CRSDG', '05729', 'ดนิตา', 'อยู่เย็น'),
('1000', 'สำนักงานใหญ่', 'CIO', '06132', 'นำพล', 'อุทกะปิณฑานนท์'),
('1000', 'สำนักงานใหญ่', 'COO', '06254', 'ชัยวุฒิ', 'โภคภัณฑ์เจริญ'),
('1000', 'สำนักงานใหญ่', 'COO', '06268', 'วันเพ็ญ', 'วงศ์วรพฤกษ์'),
('1000', 'สำนักงานใหญ่', 'CRO', '06299', 'จีระภรณ์', 'พรสิทธิ์ไพบูลย์'),
('0633', 'สาขาอยุธยา พาร์ค', 'CRSDG', '06410', 'เสริมศรี', 'เพ็งอ้น'),
('1000', 'สำนักงานใหญ่', 'CRO', '06470', 'ฤทธิเดช', 'ตรียาภรณ์พันธ์'),
('0639', 'สาขาโรบินสัน สระบุรี', 'CRSDG', '06472', 'ธีรเดช', 'ล้ำเลิศพุทธรัตน์'),
('1000', 'สำนักงานใหญ่', 'CPO', '06651', 'จิตชนก', 'แดนวังเดิม'),
('2000', 'เอส โอเอซิส', 'CFO', '06708', 'เทพจิตรา', 'ชูนุ่น'),
('2000', 'เอส โอเอซิส', 'CCRMG', '06806', 'ธนวัต', 'วัชระชัยพงษ์'),
('1000', 'สำนักงานใหญ่', 'COO', '06809', 'สุรศักดิ์', 'เชี่ยวพิมลพร'),
('1000', 'สำนักงานใหญ่', 'COO', '06827', 'พรชัย', 'ศรีประเสริฐการค้า'),
('3000', 'ศูนย์-กรุงเกษม', 'COO', '06836', 'จรัล', 'ชนะนันทศักดิ์'),
('1000', 'สำนักงานใหญ่', 'CRO', '06844', 'ดำรงค์', 'ปฏิยุทธพันธ์');
