import { prisma } from '../lib/prisma';
import { Streak } from '@prisma/client';
import cron from 'node-cron';

export interface StreakUpdateResult {
  streak: Streak;
  milestoneMessage?: string;
  graceUsed?: boolean;
  streakReset?: boolean;
}

const STREAK_MILESTONES: Record<number, string> = {
  3: "Most students quit before Day 3. You did not.",
  7: "One week strong. You are in the top 20% of Unslump users.",
  14: "Two weeks. This is a solid habit now.",
  30: "30 days. You are unstoppable.",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayDiff(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
}

export async function updateStreak(userId: string): Promise<StreakUpdateResult> {
  let streak = await prisma.streak.findUnique({ where: { userId } });

  if (!streak) {
    streak = await prisma.streak.create({
      data: { userId },
    });
  }

  const now = new Date();
  let graceUsed = false;
  let streakReset = false;

  if (!streak.lastCheckIn) {
    // First ever check-in
    streak = await prisma.streak.update({
      where: { userId },
      data: {
        current: 1,
        longest: Math.max(1, streak.longest),
        lastCheckIn: now,
      },
    });
  } else {
    const diff = dayDiff(streak.lastCheckIn, now);

    if (diff === 0) {
      // Same day — idempotent, no change
    } else if (diff === 1) {
      // Consecutive day — increment streak
      const newCurrent = streak.current + 1;
      streak = await prisma.streak.update({
        where: { userId },
        data: {
          current: newCurrent,
          longest: Math.max(newCurrent, streak.longest),
          lastCheckIn: now,
        },
      });
    } else if (diff === 2 && streak.graceDaysUsed < 1) {
      // Missed one day but grace day available
      graceUsed = true;
      const newCurrent = streak.current + 1;
      streak = await prisma.streak.update({
        where: { userId },
        data: {
          current: newCurrent,
          longest: Math.max(newCurrent, streak.longest),
          graceDaysUsed: streak.graceDaysUsed + 1,
          lastCheckIn: now,
        },
      });
    } else {
      // Streak broken — reset to 1
      streakReset = true;
      streak = await prisma.streak.update({
        where: { userId },
        data: {
          current: 1,
          lastCheckIn: now,
        },
      });
    }
  }

  const milestoneMessage = STREAK_MILESTONES[streak.current];

  return { streak, milestoneMessage, graceUsed, streakReset };
}

export async function useGraceDay(userId: string): Promise<{ success: boolean; message: string; streak?: Streak }> {
  const streak = await prisma.streak.findUnique({ where: { userId } });

  if (!streak) {
    return { success: false, message: 'No streak record found' };
  }

  if (streak.graceDaysUsed >= 1) {
    return { success: false, message: 'Grace day already used this week. Keep going — you can do it.' };
  }

  const updated = await prisma.streak.update({
    where: { userId },
    data: { graceDaysUsed: streak.graceDaysUsed + 1 },
  });

  return {
    success: true,
    message: 'Grace day used — streak intact.',
    streak: updated,
  };
}

// Cron: reset graceDaysUsed every Monday at midnight
export function startStreakCron(): void {
  // '0 0 * * 1' = midnight every Monday
  cron.schedule('0 0 * * 1', async () => {
    console.log('[Cron] Resetting weekly grace days...');
    try {
      const result = await prisma.streak.updateMany({
        data: { graceDaysUsed: 0 },
      });
      console.log(`[Cron] Reset grace days for ${result.count} users`);
    } catch (err) {
      console.error('[Cron] Failed to reset grace days:', err);
    }
  }, { timezone: 'UTC' });

  console.log('[Cron] Streak reset cron scheduled (Monday midnight UTC)');
}
