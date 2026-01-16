-- TTB WebAR Database Schema

-- Table: users_data (ข้อมูลพนักงานจากลูกค้า)
CREATE TABLE IF NOT EXISTS users_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(5) NOT NULL UNIQUE,
  INDEX idx_employee_id (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: users_new (ผู้ใช้ที่ลงทะเบียนในระบบ)
CREATE TABLE IF NOT EXISTS users_new (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(5) NOT NULL UNIQUE,
  name_employee VARCHAR(255) NOT NULL,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  playing_status BOOLEAN DEFAULT FALSE,
  reward_status JSON DEFAULT NULL,
  url_image VARCHAR(500) DEFAULT NULL,
  INDEX idx_employee_id (employee_id),
  FOREIGN KEY (employee_id) REFERENCES users_data(employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ถ้า table มีอยู่แล้ว ให้ ALTER เพิ่ม column
-- ALTER TABLE users_new ADD COLUMN url_image VARCHAR(500) DEFAULT NULL;

-- Table: rewards
CREATE TABLE IF NOT EXISTS rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rewards_cont INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample employee data (ตัวอย่าง)
-- INSERT INTO users_data (employee_id) VALUES ('12345'), ('67890'), ('11111');
