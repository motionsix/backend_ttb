import { Router } from 'express';

const router = Router();

// GET /api
router.get('/', (req, res) => {
  res.json({ 
    message: 'TTB WebAR API',
    version: '1.0.0'
  });
});

export default router;
