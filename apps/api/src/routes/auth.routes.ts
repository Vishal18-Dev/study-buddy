import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ── Schemas ────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().nullable().optional(),
  planId: z.string().nullable().optional(), // pre-generated plan to associate
  preference: z.enum(['PLAN_ONLY', 'PLAN_CONTENT', 'PLAN_CONTENT_EXAMS']).optional(),
  role: z.enum(['STUDENT', 'TEACHER']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const updateRoleSchema = z.object({
  role: z.enum(['STUDENT', 'TEACHER']),
});

// ── POST /api/auth/register ────────────────────
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { email, password, name, planId, preference, role } = parsed.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        preference: preference || 'PLAN_ONLY',
        role: role || 'STUDENT',
      },
    });

    // Create initial streak record
    await prisma.streak.create({
      data: { userId: user.id },
    });

    // If a pre-generated planId was passed (from onboarding), associate it
    if (planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { userId: true },
      });
      if (plan) {
        const currentOwner = await prisma.user.findUnique({
          where: { id: plan.userId },
          select: { id: true, email: true },
        });

        // Update plan to belong to the new registered user
        await prisma.plan.update({
          where: { id: planId },
          data: { userId: user.id },
        });

        // If the old owner was a temporary guest account, delete it to clean up DB
        if (
          currentOwner &&
          (currentOwner.email.startsWith('guest-') || currentOwner.email === 'guest@studybuddy.com' || currentOwner.email === 'guest@unslump.com')
        ) {
          await prisma.user.delete({
            where: { id: currentOwner.id },
          }).catch((err) => {
            console.warn('[Register] Failed to delete guest user:', err);
          });
        }
      }
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          preference: user.preference,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ───────────────────────
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          preference: user.preference,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ───────────────────────────
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        preference: true,
        telegramId: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/auth/role ───────────────────────
router.patch('/role', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { role } = parsed.data;
    const userId = req.user!.userId;

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (existingUser?.role === 'STUDENT') {
      res.status(403).json({ success: false, error: 'Students are not allowed to change their user role' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ success: true, data: updatedUser, message: `Role updated to ${role}` });
  } catch (err) {
    next(err);
  }
});

export default router;
