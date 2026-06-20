import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { generateStudyPlan, adjustStudyPlan } from '../services/llm.service';
import { replanFromNow } from '../services/replan.service';
import { verifyToken } from '../lib/jwt';

const router = Router();

const createPlanSchema = z.object({
  subject: z.string().min(2, 'Subject is required'),
  examDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid exam date'),
  dailyHours: z.number().min(0.5).max(16),
  goalScore: z.number().min(1).max(100),
  knowledgeLevel: z.enum(['BEGINNER', 'SOME_KNOWLEDGE', 'REVISION']),
  syllabusContext: z.string().optional(),
});

// POST /api/plans/create
router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { subject, examDate, dailyHours, goalScore, knowledgeLevel, syllabusContext } = parsed.data;
    
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = verifyToken(token);
        userId = payload.userId;
      } catch {}
    }

    if (!userId) {
      // Create a unique guest user to temporarily own the plan
      const guestEmail = `guest-${crypto.randomUUID()}@unslump.com`;
      const guest = await prisma.user.create({
        data: {
          email: guestEmail,
          passwordHash: 'guestpassword',
          name: 'Guest User',
        },
      });
      userId = guest.id;
    }

    // Mark any existing active plan as abandoned
    await prisma.plan.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'ABANDONED' },
    });

    // Generate plan via LLM
    const llmPlan = await generateStudyPlan({
      subject,
      examDate,
      dailyHours,
      goalScore,
      knowledgeLevel,
      syllabusContext,
    });

    // Store plan in DB
    const plan = await prisma.plan.create({
      data: {
        userId,
        subject,
        examDate: new Date(examDate),
        goalScore,
        dailyHours,
        status: 'ACTIVE',
        days: {
          create: llmPlan.days.map((day) => ({
            dayNumber: day.dayNumber,
            date: new Date(day.date),
            topics: {
              create: day.topics.map((t) => ({
                title: t.title,
                estimatedMins: t.estimatedMins,
              })),
            },
          })),
        },
      },
      include: {
        days: {
          include: { topics: true },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });

    res.status(201).json({ success: true, data: { plan, summary: llmPlan.summary } });
  } catch (err) {
    next(err);
  }
});

// GET /api/plans/active
router.get('/active', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.plan.findFirst({
      where: { userId: req.user!.userId, status: 'ACTIVE' },
      include: {
        days: { include: { topics: true }, orderBy: { dayNumber: 'asc' } },
      },
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'No active plan found' });
      return;
    }

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// GET /api/plans/:planId
router.get('/:planId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.plan.findFirst({
      where: { id: req.params.planId, userId: req.user!.userId },
      include: {
        days: { include: { topics: true }, orderBy: { dayNumber: 'asc' } },
      },
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans/:planId/replan
router.post('/:planId/replan', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify ownership
    const plan = await prisma.plan.findFirst({
      where: { id: req.params.planId, userId: req.user!.userId },
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    const result = await replanFromNow(req.params.planId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans/:planId/claim

router.post('/:planId/claim', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId;
    const userId = req.user!.userId;

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { userId: true },
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    const currentOwner = await prisma.user.findUnique({
      where: { id: plan.userId },
      select: { id: true, email: true },
    });

    // Mark any existing active plans of this user as abandoned
    await prisma.plan.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'ABANDONED' },
    });

    // Reassign this plan to the authenticated user
    await prisma.plan.update({
      where: { id: planId },
      data: { userId, status: 'ACTIVE' },
    });

    // Clean up temporary guest user if applicable
    if (
      currentOwner &&
      (currentOwner.email.startsWith('guest-') || currentOwner.email === 'guest@studybuddy.com' || currentOwner.email === 'guest@unslump.com')
    ) {
      await prisma.user.delete({
        where: { id: currentOwner.id },
      }).catch((err) => {
        console.warn('[Claim] Failed to delete guest user:', err);
      });
    }

    res.json({ success: true, message: 'Plan claimed successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans/:planId/chat
router.post('/:planId/chat', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId;
    const userId = req.user!.userId;
    const { messages } = req.body; // Array of { role: 'user'|'assistant', text: string }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, error: 'Messages history is required' });
      return;
    }

    // Fetch existing plan
    const plan = await prisma.plan.findFirst({
      where: { id: planId, userId },
      include: {
        days: { include: { topics: true }, orderBy: { dayNumber: 'asc' } },
      },
    });

    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    // Extract current status and list of completed topics
    const completedTopics: string[] = [];
    const currentPlanContext = {
      summary: `A personalized plan for ${plan.subject}`,
      days: plan.days.map((d) => ({
        dayNumber: d.dayNumber,
        date: d.date.toISOString().split('T')[0],
        topics: d.topics.map((t) => {
          if (t.status === 'COMPLETE') {
            completedTopics.push(t.title);
          }
          return { title: t.title, estimatedMins: t.estimatedMins, status: t.status };
        }),
      })),
    };

    // Ask LLM to adjust plan
    const updatedLlmPlan = await adjustStudyPlan(
      {
        subject: plan.subject,
        examDate: plan.examDate.toISOString().split('T')[0],
        dailyHours: plan.dailyHours,
        goalScore: plan.goalScore,
      },
      currentPlanContext,
      completedTopics,
      messages
    );

    // Save changes to database inside a transaction
    const updatedPlan = await prisma.$transaction(async (tx) => {
      // 1. Delete all current days and topics for this plan
      const dayIds = plan.days.map((d) => d.id);
      if (dayIds.length > 0) {
        await tx.topic.deleteMany({ where: { planDayId: { in: dayIds } } });
        await tx.planDay.deleteMany({ where: { planId } });
      }

      // 2. Create the new days and topics, carrying over status
      for (const day of updatedLlmPlan.days) {
        const topicsData = day.topics.map((t) => {
          // If this topic matches a completed topic, preserve COMPLETE status
          const isComplete = completedTopics.some(
            (ct) => ct.toLowerCase().trim() === t.title.toLowerCase().trim()
          );
          return {
            title: t.title,
            estimatedMins: t.estimatedMins,
            status: isComplete ? 'COMPLETE' : 'NOT_STARTED',
          };
        });

        const dayCompleted = topicsData.length > 0 && topicsData.every((t) => t.status === 'COMPLETE');

        await tx.planDay.create({
          data: {
            planId,
            dayNumber: day.dayNumber,
            date: new Date(day.date),
            completed: dayCompleted,
            topics: {
              create: topicsData,
            },
          },
        });
      }

      // 3. Return the updated plan
      return tx.plan.findUnique({
        where: { id: planId },
        include: {
          days: {
            include: { topics: true },
            orderBy: { dayNumber: 'asc' },
          },
        },
      });
    });

    res.json({ success: true, data: updatedPlan });
  } catch (err) {
    next(err);
  }
});

export default router;


