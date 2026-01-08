import { Router } from 'express';

const router = Router();

// GET /api
router.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to the API',
    version: '1.0.0'
  });
});

// Example: GET /api/users
router.get('/users', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' }
    ]
  });
});

// Example: POST /api/users
router.post('/users', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  res.status(201).json({
    message: 'User created',
    user: { id: Date.now(), name }
  });
});

export default router;

