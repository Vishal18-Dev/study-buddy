import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { useGraceDay } from '../services/streak.service';

const router = Router();

// GET /api/streaks/me
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const streak = await prisma.streak.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!streak) {
      res.status(404).json({ success: false, error: 'No streak record found' });
      return;
    }

    res.json({ success: true, data: streak });
  } catch (err) {
    next(err);
  }
});

// POST /api/streaks/grace
router.post('/grace', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await useGraceDay(req.user!.userId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      success: result.success,
      data: result.success ? { streak: result.streak, message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
