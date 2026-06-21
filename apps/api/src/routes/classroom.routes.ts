import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { generateStudyPlan } from '../services/llm.service';

const router = Router();

const createClassroomSchema = z.object({
  name: z.string().min(2, 'Classroom name must be at least 2 characters'),
});

const joinClassroomSchema = z.object({
  code: z.string().length(6, 'Code must be exactly 6 characters'),
});

const createTemplateSchema = z.object({
  subject: z.string().min(2, 'Subject is required'),
  syllabusContext: z.string().min(1, 'Syllabus context is required'),
});

const assignPlanSchema = z.object({
  subject: z.string().min(2, 'Subject is required'),
  examDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid exam date'),
  dailyHours: z.number().min(0.5).max(16),
  goalScore: z.number().min(1).max(100),
  knowledgeLevel: z.enum(['BEGINNER', 'SOME_KNOWLEDGE', 'REVISION']),
  syllabusContext: z.string().min(1, 'Syllabus content is required'),
  currentScore: z.number().min(0).max(100),
  teacherNotes: z.string().optional(),
  templateId: z.string().min(1, 'templateId is required'),
});

// Helper to generate a unique 6-char code
async function generateUniqueClassroomCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  while (attempts < 10) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await prisma.classroom.findUnique({ where: { code } });
    if (!existing) return code;
    attempts++;
  }
  throw new Error('Failed to generate a unique classroom code');
}

// ── GET /api/classrooms/taught ───────────────────
router.get('/taught', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.userId;
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: classrooms });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/classrooms/joined ───────────────────
router.get('/joined', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user!.userId;
    const members = await prisma.classroomMember.findMany({
      where: { studentId },
      include: {
        classroom: {
          include: {
            teacher: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({ success: true, data: members.map((m) => m.classroom) });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/classrooms ─────────────────────────
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'TEACHER') {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (user?.role !== 'TEACHER') {
        res.status(403).json({ success: false, error: 'Only teachers can create classrooms' });
        return;
      }
    }

    const parsed = createClassroomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { name } = parsed.data;
    const teacherId = req.user!.userId;
    const code = await generateUniqueClassroomCode();

    const classroom = await prisma.classroom.create({
      data: { name, code, teacherId },
    });

    res.status(201).json({ success: true, data: classroom });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/classrooms/join ────────────────────
router.post('/join', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = joinClassroomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { code } = parsed.data;
    const studentId = req.user!.userId;

    const classroom = await prisma.classroom.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!classroom) {
      res.status(404).json({ success: false, error: 'Classroom not found with this code' });
      return;
    }

    if (classroom.teacherId === studentId) {
      res.status(400).json({ success: false, error: 'You cannot join your own classroom' });
      return;
    }

    // Check if already a member
    const existing = await prisma.classroomMember.findUnique({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId,
        },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'You are already a member of this classroom' });
      return;
    }

    const member = await prisma.classroomMember.create({
      data: {
        classroomId: classroom.id,
        studentId,
      },
    });

    res.status(201).json({ success: true, data: { classroom, member } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/classrooms/:classroomId/templates ──
router.post('/:classroomId/templates', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classroomId } = req.params;
    const teacherId = req.user!.userId;

    // Verify classroom exists and belongs to the teacher
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, teacherId },
    });

    if (!classroom) {
      res.status(404).json({ success: false, error: 'Classroom not found or unauthorized' });
      return;
    }

    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { subject, syllabusContext } = parsed.data;

    const template = await prisma.planTemplate.create({
      data: {
        classroomId,
        subject,
        syllabusContext,
      },
    });

    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/classrooms/:classroomId/templates ───
router.get('/:classroomId/templates', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user!.userId;

    // Verify user is in classroom (either as teacher or member)
    const classroom = await prisma.classroom.findFirst({
      where: {
        id: classroomId,
        OR: [
          { teacherId: userId },
          { members: { some: { studentId: userId } } },
        ],
      },
    });

    if (!classroom) {
      res.status(404).json({ success: false, error: 'Classroom not found or unauthorized' });
      return;
    }

    const templates = await prisma.planTemplate.findMany({
      where: { classroomId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/classrooms/:classroomId/roster ──────
router.get('/:classroomId/roster', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classroomId } = req.params;
    const teacherId = req.user!.userId;

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, teacherId },
    });

    if (!classroom) {
      res.status(404).json({ success: false, error: 'Classroom not found or unauthorized' });
      return;
    }

    const members = await prisma.classroomMember.findMany({
      where: { classroomId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            streaks: true,
            plans: {
              where: { classroomId, status: 'ACTIVE' },
              include: {
                days: {
                  include: { topics: { select: { status: true } } },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            checkIns: {
              where: { plan: { classroomId } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const roster = members.map((m) => {
      const student = m.student;
      const activePlan = student.plans[0] || null;
      const streak = student.streaks ? student.streaks.current : 0;
      const lastCheckIn = student.checkIns[0] || null;

      let coveragePercent = 0;
      if (activePlan) {
        const allTopics = activePlan.days.flatMap((d) => d.topics);
        const completedTopics = allTopics.filter((t) => t.status === 'COMPLETE');
        coveragePercent =
          allTopics.length > 0 ? Math.round((completedTopics.length / allTopics.length) * 100) : 0;
      }

      return {
        id: student.id,
        name: student.name || 'Anonymous Student',
        email: student.email,
        streak,
        activePlan: activePlan
          ? {
              id: activePlan.id,
              subject: activePlan.subject,
              goalScore: activePlan.goalScore,
              dailyHours: activePlan.dailyHours,
              coveragePercent,
            }
          : null,
        lastCheckIn: lastCheckIn
          ? {
              date: lastCheckIn.createdAt,
              completionFlag: lastCheckIn.completionFlag,
            }
          : null,
      };
    });

    res.json({ success: true, data: roster });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/classrooms/:classroomId/students/:studentId/plans ──
router.post(
  '/:classroomId/students/:studentId/plans',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classroomId, studentId } = req.params;
      const teacherId = req.user!.userId;

      // 1. Verify classroom belongs to the teacher
      const classroom = await prisma.classroom.findFirst({
        where: { id: classroomId, teacherId },
      });

      if (!classroom) {
        res.status(404).json({ success: false, error: 'Classroom not found or unauthorized' });
        return;
      }

      // 2. Verify student belongs to classroom
      const member = await prisma.classroomMember.findUnique({
        where: {
          classroomId_studentId: {
            classroomId,
            studentId,
          },
        },
      });

      if (!member) {
        res.status(404).json({ success: false, error: 'Student is not a member of this classroom' });
        return;
      }

      // 3. Parse input
      const parsed = assignPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const {
        subject,
        examDate,
        dailyHours,
        goalScore,
        knowledgeLevel,
        syllabusContext,
        currentScore,
        teacherNotes,
        templateId,
      } = parsed.data;

      // 4. Generate plan via LLM
      const llmPlan = await generateStudyPlan({
        subject,
        examDate,
        dailyHours,
        goalScore,
        knowledgeLevel,
        syllabusContext,
        currentScore,
        teacherNotes,
      } as any);

      // 5. Store plan in DB assigned to student, starting as PAUSED and unaccepted
      const plan = await prisma.plan.create({
        data: {
          userId: studentId,
          subject,
          examDate: new Date(examDate),
          goalScore,
          dailyHours,
          status: 'PAUSED',
          isTeacherAssigned: true,
          teacherPlanAccepted: false,
          currentScore,
          teacherNotes,
          templateId,
          classroomId,
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

      res.status(201).json({
        success: true,
        data: plan,
        message: 'Personalized study plan generated and assigned to the student!',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
