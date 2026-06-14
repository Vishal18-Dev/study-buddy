import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { updateStreak } from '../services/streak.service';
import { replanFromNow } from '../services/replan.service';
import { generateCheckInMessage } from '../services/llm.service';

const router = Router();

const checkInSchema = z.object({
  planId: z.string().min(1),
  completionFlag: z.enum(['YES', 'PARTIALLY', 'NO', 'LOGGED_OFFLINE']),
  sessionMins: z.number().min(0).default(0),
  note: z.string().optional(),
});

// POST /api/checkin
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { planId, completionFlag, sessionMins, note } = parsed.data;
    const userId = req.user!.userId;

    // Verify plan ownership
    const plan = await prisma.plan.findFirst({
      where: { id: planId, userId },
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    // Create check-in record
    const checkIn = await prisma.checkIn.create({
      data: { userId, planId, completionFlag, sessionMins, note },
    });

    // Update streak
    const streakResult = await updateStreak(userId);

    // Trigger replan if completion was partial or none
    let replanResult;
    if (completionFlag === 'PARTIALLY' || completionFlag === 'NO') {
      try {
        replanResult = await replanFromNow(planId);
      } catch (err) {
        console.warn('[CheckIn] Replan failed:', err);
      }
    }

    // Generate personalised check-in message
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const daysLeft = Math.max(0, Math.ceil((new Date(plan.examDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const todayTopics = await prisma.topic.count({
      where: {
        planDay: {
          planId,
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        status: { not: 'COMPLETE' },
      },
    });

    const checkInMessage = await generateCheckInMessage({
      name: user?.name || 'there',
      streak: streakResult.streak.current,
      daysLeft,
      completionFlag,
      topicsToday: todayTopics,
      contextNote: streakResult.streakReset
        ? 'Streaks reset sometimes. Starting fresh from today — let\'s make it count.'
        : streakResult.graceUsed
        ? 'Grace day used — streak intact'
        : undefined,
    });

    res.json({
      success: true,
      data: {
        checkIn,
        streak: streakResult.streak,
        milestoneMessage: streakResult.milestoneMessage,
        graceUsed: streakResult.graceUsed,
        streakReset: streakResult.streakReset,
        checkInMessage,
        replanned: !!replanResult,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/checkin/today
router.get('/today', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const checkIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.user!.userId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { done: !!checkIn, checkIn } });
  } catch (err) {
    next(err);
  }
});

export default router;
