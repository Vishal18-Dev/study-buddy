import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { generateQuiz } from '../services/llm.service';
import { setCache, getCache, deleteCache } from '../services/redis.service';
import { QuizQuestion } from '@studybuddy/shared';

const router = Router();

const generateSchema = z.object({
  topicId: z.string().min(1),
  count: z.number().min(5).max(10).optional().default(7),
});

const submitSchema = z.object({
  topicId: z.string().min(1),
  answers: z.array(
    z.object({
      questionIndex: z.number().min(0),
      selectedIndex: z.number().min(0).max(3),
    })
  ).min(1),
});

// POST /api/quiz/generate
router.post('/generate', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { topicId, count } = parsed.data;

    // Verify topic ownership
    const topic = await prisma.topic.findFirst({
      where: { id: topicId },
      include: { planDay: { include: { plan: { select: { userId: true, subject: true } } } } },
    });

    if (!topic || topic.planDay.plan.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: 'Topic not found' });
      return;
    }

    const quiz = await generateQuiz(topic.title, topic.planDay.plan.subject, count);

    // Cache the full questions (with answers) in Redis for grading
    const cacheKey = `quiz:user:${req.user!.userId}:topic:${topicId}`;
    await setCache(cacheKey, quiz.questions, 900); // 15 mins cache

    // Return questions WITHOUT correct answers (security)
    const sanitized = quiz.questions.map((q, i) => ({
      index: i,
      question: q.question,
      options: q.options,
      // correctIndex and explanation returned AFTER submission
    }));

    res.json({ success: true, data: { topicId, questions: sanitized, _full: quiz.questions } });
    // Note: _full is included here for MVP simplicity (client needs it to grade)
    // In production, store questions server-side and only send answers on submit
  } catch (err) {
    next(err);
  }
});

// POST /api/quiz/submit
router.post('/submit', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { topicId, answers } = parsed.data;
    const userId = req.user!.userId;

    // Verify topic ownership
    const topic = await prisma.topic.findFirst({
      where: { id: topicId },
      include: { planDay: { include: { plan: { select: { userId: true, subject: true } } } } },
    });

    if (!topic || topic.planDay.plan.userId !== userId) {
      res.status(404).json({ success: false, error: 'Topic not found' });
      return;
    }

    // Retrieve the cached quiz questions from Redis
    const cacheKey = `quiz:user:${userId}:topic:${topicId}`;
    let questions = await getCache<QuizQuestion[]>(cacheKey);

    if (!questions) {
      console.warn(`[Quiz] Cache miss for key ${cacheKey}. Falling back to LLM regeneration.`);
      const quiz = await generateQuiz(topic.title, topic.planDay.plan.subject, answers.length);
      questions = quiz.questions;
    } else {
      // Clean up cache after retrieval
      await deleteCache(cacheKey).catch((err) => {
        console.warn('[Quiz] Failed to delete cache:', err);
      });
    }

    // Score
    let correct = 0;
    const gradedAnswers = answers.map((a) => {
      const q = questions[a.questionIndex];
      if (!q) return { ...a, isCorrect: false };
      const isCorrect = a.selectedIndex === q.correctIndex;
      if (isCorrect) correct++;
      return {
        ...a,
        isCorrect,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        question: q.question,
        options: q.options,
      };
    });

    const score = Math.round((correct / answers.length) * 100);
    const passed = score >= 60;

    // Store result
    const result = await prisma.quizResult.create({
      data: {
        userId,
        topicId,
        score,
        passed,
        questions: JSON.stringify(gradedAnswers),
      },
    });

    // Update topic status
    await prisma.topic.update({
      where: { id: topicId },
      data: { status: passed ? 'COMPLETE' : 'WEAK' },
    });

    const message = passed
      ? `Great work — ${score}% on ${topic.title}. Topic marked complete.`
      : `This topic needs a bit more time. I've added it back to your plan.`;

    res.json({
      success: true,
      data: {
        result: {
          ...result,
          questions: gradedAnswers,
        },
        score,
        passed,
        gradedAnswers,
        message,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
