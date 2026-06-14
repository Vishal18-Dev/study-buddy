import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

const updateStatusSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'WEAK']),
});

// PATCH /api/topics/:topicId/status
router.patch('/:topicId/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    // Verify the topic belongs to the authenticated user
    const topic = await prisma.topic.findFirst({
      where: { id: req.params.topicId },
      include: { planDay: { include: { plan: true } } },
    });

    if (!topic || topic.planDay.plan.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: 'Topic not found' });
      return;
    }

    const updated = await prisma.topic.update({
      where: { id: req.params.topicId },
      data: { status: parsed.data.status },
    });

    // If all topics in the day are complete, mark the day complete
    const dayTopics = await prisma.topic.findMany({
      where: { planDayId: topic.planDayId },
    });
    const allComplete = dayTopics.every((t) => t.status === 'COMPLETE');

    await prisma.planDay.update({
      where: { id: topic.planDayId },
      data: { completed: allComplete },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

const updateNotesSchema = z.object({
  notes: z.string(),
});

// PATCH /api/topics/:topicId/notes
router.patch('/:topicId/notes', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateNotesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    // Verify the topic belongs to the authenticated user
    const topic = await prisma.topic.findFirst({
      where: { id: req.params.topicId },
      include: { planDay: { include: { plan: true } } },
    });

    if (!topic || topic.planDay.plan.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: 'Topic not found' });
      return;
    }

    const updated = await prisma.topic.update({
      where: { id: req.params.topicId },
      data: { notes: parsed.data.notes },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
