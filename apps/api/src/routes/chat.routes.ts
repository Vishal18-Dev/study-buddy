import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { generateChatResponse } from '../services/llm.service';

const router = Router();

const chatSchema = z.object({
  planId: z.string().min(1, 'planId is required'),
  message: z.string().min(1, 'message is required'),
  chatHistory: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.string()
    })
  ).default([])
});

// POST /api/chat
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { planId, message, chatHistory } = parsed.data;
    const userId = req.user!.userId;

    // Verify ownership of the plan
    const plan = await prisma.plan.findFirst({
      where: { id: planId, userId },
      include: {
        days: {
          take: 5,
          include: { topics: true }
        }
      }
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Study plan not found' });
      return;
    }

    // Retrieve user's Knowledge Sources for context
    const knowledgeSources = await prisma.knowledgeSource.findMany({
      where: { planId, userId },
      select: { title: true, content: true }
    });

    const planContext = `${plan.subject} plan targeting a score of ${plan.goalScore}% with ${plan.dailyHours} study hours per day.`;

    const chatResponse = await generateChatResponse({
      planContext,
      chatHistory,
      message,
      knowledgeSources
    });

    res.json({
      success: true,
      data: {
        response: chatResponse
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
