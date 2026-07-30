import express, { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';

const router: Router = express.Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  res.json({ message: 'Progress endpoint' });
});

export default router;
