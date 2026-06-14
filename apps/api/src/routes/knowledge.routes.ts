import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { integrateKnowledgeSources } from '../services/replan.service';

const router = Router();

const addKnowledgeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['text', 'link', 'youtube', 'pdf']),
  url: z.string().optional(),
  content: z.string().optional()
});

// GET /api/knowledge/:planId
router.get('/:planId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId;
    const userId = req.user!.userId;

    // Verify ownership
    const plan = await prisma.plan.findFirst({
      where: { id: planId, userId }
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Study plan not found' });
      return;
    }

    const sources = await prisma.knowledgeSource.findMany({
      where: { planId, userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: sources });
  } catch (err) {
    next(err);
  }
});

// POST /api/knowledge/:planId
router.post('/:planId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = addKnowledgeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const planId = req.params.planId;
    const userId = req.user!.userId;
    const { title, type, url, content } = parsed.data;

    // Verify ownership
    const plan = await prisma.plan.findFirst({
      where: { id: planId, userId }
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Study plan not found' });
      return;
    }

    const source = await prisma.knowledgeSource.create({
      data: {
        userId,
        planId,
        title,
        type,
        url,
        content
      }
    });

    // Run LLM mapping in the background to integrate notes to upcoming schedule days
    await integrateKnowledgeSources(planId, userId);

    res.status(201).json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

export default router;
