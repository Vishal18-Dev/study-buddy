import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { generateRecommendationsForTopic, searchYoutubeVideosWithGemini } from '../services/llm.service';

const router = Router();

const rateSchema = z.object({
  rating: z.enum(['1', '-1'])
});

// GET /api/recommendations/video/search
router.get('/video/search', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.query as string;
    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter is required' });
      return;
    }

    const userId = req.user!.userId;
    const activePlan = await prisma.plan.findFirst({
      where: { userId, status: 'ACTIVE' }
    });

    const syllabusContext = activePlan
      ? await prisma.syllabusChunk.findFirst({ where: { planId: activePlan.id } })
      : null;

    const topicTitle = query.replace(/\s+tutorial\s+lesson/gi, '').trim();

    // Call the new searchYoutubeVideosWithGemini service
    const videos = await searchYoutubeVideosWithGemini(
      topicTitle,
      activePlan?.subject || 'General Studies',
      syllabusContext?.content || undefined
    );

    res.json({ success: true, data: videos });
  } catch (err) {
    next(err);
  }
});

// GET /api/recommendations/:topicId
router.get('/:topicId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicId = req.params.topicId;

    // Verify topic belongs to user
    const topic = await prisma.topic.findFirst({
      where: { id: topicId },
      include: {
        planDay: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!topic || topic.planDay.plan.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: 'Topic not found' });
      return;
    }

    // Check if recommendations already exist
    let recs = await prisma.topicRecommendation.findMany({
      where: { topicId },
      orderBy: { rating: 'desc' }
    });

    // If none exist, generate via LLM/mock and store them
    if (recs.length === 0) {
      const suggested = await generateRecommendationsForTopic(
        topic.title,
        topic.planDay.plan.subject
      );

      // Save to database
      await prisma.topicRecommendation.createMany({
        data: suggested.map((r) => ({
          topicId,
          title: r.title,
          url: r.url,
          isPaid: r.isPaid,
          platform: r.platform
        }))
      });

      recs = await prisma.topicRecommendation.findMany({
        where: { topicId },
        orderBy: { rating: 'desc' }
      });
    }

    res.json({ success: true, data: recs });
  } catch (err) {
    next(err);
  }
});

// POST /api/recommendations/:recId/rate
router.post('/:recId/rate', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const recId = req.params.recId;
    const rateDiff = parseInt(parsed.data.rating, 10);

    const rec = await prisma.topicRecommendation.findUnique({
      where: { id: recId },
      include: {
        topic: {
          include: {
            planDay: {
              include: {
                plan: true
              }
            }
          }
        }
      }
    });

    if (!rec || rec.topic.planDay.plan.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: 'Recommendation not found' });
      return;
    }

    const updated = await prisma.topicRecommendation.update({
      where: { id: recId },
      data: {
        rating: {
          increment: rateDiff
        }
      }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
