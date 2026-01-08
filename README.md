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
```

3. Start the server:

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## API Endpoints

| Method | Endpoint     | Description          |
|--------|--------------|----------------------|
| GET    | /health      | Health check         |
| GET    | /api         | API info             |
| GET    | /api/users   | Get all users        |
| POST   | /api/users   | Create a user        |

## Project Structure

```
backend/
├── src/
│   ├── index.js        # Entry point
│   └── routes/
│       └── api.js      # API routes
├── package.json
├── .gitignore
├── .nvmrc
└── README.md
```
