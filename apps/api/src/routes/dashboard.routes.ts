import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// GET /api/dashboard
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch all data in parallel
    const [plan, streak, recentQuizResults, todayCheckIn] = await Promise.all([
      prisma.plan.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: {
          days: { include: { topics: true }, orderBy: { dayNumber: 'asc' } },
        },
      }),
      prisma.streak.findUnique({ where: { userId } }),
      prisma.quizResult.findMany({
        where: { userId },
        include: { topic: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.checkIn.findFirst({
        where: { userId, createdAt: { gte: today, lte: todayEnd } },
      }),
    ]);

    // Today's topics
    const todayTopics = plan?.days
      .find((d) => {
        const dayDate = new Date(d.date);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate.getTime() === today.getTime();
      })
      ?.topics || [];

    // Coverage %
    const allTopics = plan?.days.flatMap((d) => d.topics) || [];
    const completedTopics = allTopics.filter((t) => t.status === 'COMPLETE');
    const coveragePercent =
      allTopics.length > 0
        ? Math.round((completedTopics.length / allTopics.length) * 100)
        : 0;

    const recentQuizScores = recentQuizResults.map((r) => ({
      topicTitle: r.topic.title,
      score: r.score,
      passed: r.passed,
    }));

    res.json({
      success: true,
      data: {
        plan,
        todayTopics,
        streak,
        coveragePercent,
        recentQuizScores,
        todayCheckInDone: !!todayCheckIn,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
