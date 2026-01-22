# TTB WebAR Backend API

Node.js REST API สำหรับ Unity WebGL Application

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development (auto-restart)
npm run dev

# Production
npm start
```

## 📁 Database Schema

### Table: users_data (ข้อมูลพนักงานจากลูกค้า)

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary Key |
| dept_id | VARCHAR(4) | รหัสแผนก |
| dept_descr | VARCHAR(255) | ชื่อแผนก |
| sub_chief | VARCHAR(255) | หัวหน้า |
| employee_id | VARCHAR(5) | รหัสพนักงาน (unique) |
| employee_firstname | VARCHAR(255) | ชื่อ |
| employee_lastname | VARCHAR(255) | นามสกุล |

### Table: users_new (ผู้ใช้ที่ลงทะเบียนในระบบ)

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary Key |
| dept_id | VARCHAR(4) | รหัสแผนก |
| dept_descr | VARCHAR(255) | ชื่อแผนก |
| sub_chief | VARCHAR(255) | หัวหน้า |
| employee_id | VARCHAR(5) | รหัสพนักงาน (FK → users_data) |
| employee_firstname | VARCHAR(255) | ชื่อ |
| employee_lastname | VARCHAR(255) | นามสกุล |
| create_date | DATETIME | วันที่ลงทะเบียน |
| last_login | DATETIME | เข้าสู่ระบบล่าสุด |
| playing_status | BOOLEAN | เล่นแล้วหรือยัง |
| url_image | VARCHAR(500) | URL รูปที่ถ่าย |

## 📡 API Endpoints

### Auth Routes

#### POST /api/auth/login
Login ด้วยรหัสพนักงาน (auto-populate ข้อมูลจาก users_data)

**Request:**
```json
{
  "employee_id": "04858"
}
```

**Response:**
```json
{
  "success": true,
  "message": "ลงทะเบียนสำเร็จ",
  "isNewUser": true,
  "user": {
    "id": 1,
    "dept_id": "2000",
    "dept_descr": "เอส โอเอซิส",
    "sub_chief": "CRO",
    "employee_id": "04858",
    "employee_firstname": "กรุณา",
    "employee_lastname": "เหล่าประชัยวัลย์",
    "employee_name": "กรุณา เหล่าประชัยวัลย์",
    "create_date": "2026-01-22T10:00:00.000Z",
    "last_login": "2026-01-22T10:00:00.000Z",
    "playing_status": false,
    "url_image": null
  }
}
```

#### GET /api/auth/check/:employee_id
เช็คสถานะผู้ใช้

**Response:**
```json
{
  "success": true,
  "exists_in_system": true,
  "registered": true,
  "user": {
    "id": 1,
    "dept_id": "2000",
    "dept_descr": "เอส โอเอซิส",
    "employee_id": "04858",
    "employee_firstname": "กรุณา",
    "employee_lastname": "เหล่าประชัยวัลย์",
    "employee_name": "กรุณา เหล่าประชัยวัลย์",
    "playing_status": false,
    "url_image": null
  }
}
```

#### POST /api/auth/mark-played
บันทึกว่าเล่นเกมแล้ว

**Request:**
```json
{
  "employee_id": "04858"
}
```

**Response:**
```json
{
  "success": true,
  "message": "บันทึกสถานะเล่นแล้วสำเร็จ",
  "user": {
    "id": 1,
    "dept_id": "2000",
    "dept_descr": "เอส โอเอซิส",
    "employee_id": "04858",
    "employee_firstname": "กรุณา",
    "employee_lastname": "เหล่าประชัยวัลย์",
    "employee_name": "กรุณา เหล่าประชัยวัลย์",
    "playing_status": true,
    "url_image": null
  }
}
```

#### PUT /api/auth/playing-status
อัพเดท playing_status

**Request:**
```json
{
  "employee_id": "04858",
  "playing_status": true
}
```

### Upload Routes

#### POST /api/upload/image
อัพโหลดรูปภาพ (Base64)

**Request:**
```json
{
  "employee_id": "04858",
  "image": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "อัพโหลดรูปสำเร็จ",
  "url_image": "/uploads/04858_1737550000000.png",
  "user": {
    "id": 1,
    "dept_id": "2000",
    "dept_descr": "เอส โอเอซิส",
    "employee_id": "04858",
    "employee_firstname": "กรุณา",
    "employee_lastname": "เหล่าประชัยวัลย์",
    "employee_name": "กรุณา เหล่าประชัยวัลย์",
    "url_image": "/uploads/04858_1737550000000.png"
  }
}
```

#### GET /api/upload/image/:employee_id
ดึง URL รูปของผู้ใช้

### Health Check

#### GET /health
```json
{
  "status": "ok",
  "timestamp": "2026-01-22T10:00:00.000Z"
}
```

## 🔧 Environment Variables

สร้างไฟล์ `.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=ttbwebar_db
```

## 📊 SQL Setup

```sql
-- สร้าง database
CREATE DATABASE ttbwebar_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ttbwebar_db;

-- สร้าง table users_data
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

-- สร้าง table users_new
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

-- Import ข้อมูลพนักงานตัวอย่าง
INSERT INTO users_data (dept_id, dept_descr, sub_chief, employee_id, employee_firstname, employee_lastname) VALUES
('2000', 'เอส โอเอซิส', 'CRO', '04858', 'กรุณา', 'เหล่าประชัยวัลย์'),
('1000', 'สำนักงานใหญ่', 'COO', '04863', 'จันทิมา', 'จิรพรเจริญสุข'),
('1000', 'สำนักงานใหญ่', 'COO', '05341', 'กิติมา', 'สิทธิโภควัฒน์');
```

## 🧪 Test with cURL

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "04858"}'

# Check user
curl http://localhost:3000/api/auth/check/04858

# Mark as played
curl -X POST http://localhost:3000/api/auth/mark-played \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "04858"}'
```
