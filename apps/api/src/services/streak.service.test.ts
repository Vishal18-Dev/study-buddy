import { describe, expect, test, beforeEach } from '@jest/globals';

// ─────────────────────────────────────────────
// Streak Logic Unit Tests
// These test the business logic in isolation (no DB)
// ─────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayDiff(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
}

interface MockStreak {
  current: number;
  longest: number;
  graceDaysUsed: number;
  lastCheckIn: Date | null;
}

function simulateCheckIn(streak: MockStreak, now: Date): {
  streak: MockStreak;
  graceUsed: boolean;
  streakReset: boolean;
  milestoneMessage?: string;
} {
  const MILESTONES: Record<number, string> = {
    3: "Most students quit before Day 3. You didn't. 🎯",
    7: "One week strong. You're in the top 20% of StudyBuddy users. 🔥",
    14: "Two weeks. This is a habit now. 💪",
    30: "30 days. You're unstoppable. 🏆",
  };

  let graceUsed = false;
  let streakReset = false;
  const s = { ...streak };

  if (!s.lastCheckIn) {
    s.current = 1;
    s.longest = Math.max(1, s.longest);
    s.lastCheckIn = now;
  } else {
    const diff = dayDiff(s.lastCheckIn, now);

    if (diff === 0) {
      // Idempotent — no change
    } else if (diff === 1) {
      s.current += 1;
      s.longest = Math.max(s.current, s.longest);
      s.lastCheckIn = now;
    } else if (diff === 2 && s.graceDaysUsed < 1) {
      graceUsed = true;
      s.current += 1;
      s.longest = Math.max(s.current, s.longest);
      s.graceDaysUsed += 1;
      s.lastCheckIn = now;
    } else {
      streakReset = true;
      s.current = 1;
      s.lastCheckIn = now;
    }
  }

  return {
    streak: s,
    graceUsed,
    streakReset,
    milestoneMessage: MILESTONES[s.current],
  };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe('Streak Service — Logic Unit Tests', () => {
  const now = new Date();
  now.setHours(18, 0, 0, 0);

  // Test 1: First ever check-in
  test('first check-in starts streak at 1', () => {
    const streak: MockStreak = { current: 0, longest: 0, graceDaysUsed: 0, lastCheckIn: null };
    const result = simulateCheckIn(streak, now);
    expect(result.streak.current).toBe(1);
    expect(result.streak.longest).toBe(1);
    expect(result.graceUsed).toBe(false);
    expect(result.streakReset).toBe(false);
  });

  // Test 2: Consecutive day increments streak
  test('consecutive day increments streak and updates longest', () => {
    const streak: MockStreak = { current: 5, longest: 5, graceDaysUsed: 0, lastCheckIn: daysAgo(1) };
    const result = simulateCheckIn(streak, now);
    expect(result.streak.current).toBe(6);
    expect(result.streak.longest).toBe(6);
    expect(result.graceUsed).toBe(false);
  });

  // Test 3: Same day is idempotent
  test('same-day check-in is idempotent', () => {
    const today = new Date();
    today.setHours(8, 0, 0, 0);
    const streak: MockStreak = { current: 3, longest: 3, graceDaysUsed: 0, lastCheckIn: today };
    const result = simulateCheckIn(streak, now);
    expect(result.streak.current).toBe(3); // unchanged
  });

  // Test 4: Grace day used when missed one day
  test('grace day preserves streak when one day missed', () => {
    const streak: MockStreak = { current: 7, longest: 7, graceDaysUsed: 0, lastCheckIn: daysAgo(2) };
    const result = simulateCheckIn(streak, now);
    expect(result.graceUsed).toBe(true);
    expect(result.streakReset).toBe(false);
    expect(result.streak.current).toBe(8);
    expect(result.streak.graceDaysUsed).toBe(1);
  });

  // Test 5: No grace day available — streak resets
  test('streak resets when grace day already used', () => {
    const streak: MockStreak = { current: 7, longest: 7, graceDaysUsed: 1, lastCheckIn: daysAgo(2) };
    const result = simulateCheckIn(streak, now);
    expect(result.streakReset).toBe(true);
    expect(result.streak.current).toBe(1);
  });

  // Test 6: Missed 3+ days always resets
  test('missed 3+ days resets streak even with unused grace day', () => {
    const streak: MockStreak = { current: 14, longest: 14, graceDaysUsed: 0, lastCheckIn: daysAgo(3) };
    const result = simulateCheckIn(streak, now);
    expect(result.streakReset).toBe(true);
    expect(result.streak.current).toBe(1);
  });

  // Test 7: Milestone returned at day 7
  test('milestone message returned at 7 days', () => {
    const streak: MockStreak = { current: 6, longest: 6, graceDaysUsed: 0, lastCheckIn: daysAgo(1) };
    const result = simulateCheckIn(streak, now);
    expect(result.streak.current).toBe(7);
    expect(result.milestoneMessage).toContain('One week');
  });

  // Test 8: longest never decreases on reset
  test('longest streak never decreases when streak resets', () => {
    const streak: MockStreak = { current: 30, longest: 30, graceDaysUsed: 0, lastCheckIn: daysAgo(5) };
    const result = simulateCheckIn(streak, now);
    expect(result.streak.current).toBe(1);
    expect(result.streak.longest).toBe(30); // preserved
  });
});
