# backend_ttb

Node.js REST API project.

## Requirements

- Node.js v22.17.1 or higher

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file:

```bash
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ttbwebar_db
```

3. Setup database:

```bash
# Run schema.sql in MySQL
mysql -u root -p ttbwebar_db < src/database/schema.sql
```

4. Start the server:

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## API Endpoints

| Method | Endpoint                    | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | /health                     | Health check                   |
| GET    | /api                        | API info                       |
| POST   | /api/auth/login             | Login / Register user          |
| GET    | /api/auth/check/:employee_id| Check user status              |

### Login API

**POST** `/api/auth/login`

Request Body:
```json
{
  "name": "ชื่อพนักงาน",
  "employee_id": "12345"
}
```

Response (Success):
```json
{
  "success": true,
  "message": "เข้าสู่ระบบสำเร็จ",
  "isNewUser": false,
  "user": {
    "id": 1,
    "employee_id": "12345",
    "name": "ชื่อพนักงาน",
    "create_date": "2026-01-16T10:00:00.000Z",
    "last_login": "2026-01-16T12:00:00.000Z",
    "playing_status": false,
    "reward_status": null
  }
}
```

## Project Structure

```
backend/
├── src/
│   ├── index.js           # Entry point
│   ├── config/
│   │   └── database.js    # MySQL connection
│   ├── database/
│   │   └── schema.sql     # Database schema
│   └── routes/
│       ├── api.js         # General API routes
│       └── auth.js        # Auth/Login routes
├── package.json
├── .gitignore
├── .nvmrc
└── README.md
```

## Database Tables

- **users_data** - ข้อมูลพนักงานจากลูกค้า (employee_id 5 หลัก)
- **users_new** - ผู้ใช้ที่ลงทะเบียนเข้าเล่นเกม
- **rewards** - ข้อมูลรางวัล
