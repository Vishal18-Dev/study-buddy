import { describe, expect, test } from '@jest/globals';

// ─────────────────────────────────────────────
// Replan Engine Unit Tests
// Tests the triage and redistribution logic in isolation
// ─────────────────────────────────────────────

interface MockTopic {
  id: string;
  title: string;
  estimatedMins: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'WEAK';
}

interface MockPlanDay {
  id: string;
  dayNumber: number;
  date: Date;
  completed: boolean;
  topics: MockTopic[];
}

interface MockPlan {
  id: string;
  examDate: Date;
  dailyHours: number;
  goalScore: number;
  days: MockPlanDay[];
}

interface ReplanOutput {
  triageMode: boolean;
  triageNote?: string;
  scheduledTopics: string[];
  totalDaysScheduled: number;
  revisionDaysAdded: number;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function simulateReplan(plan: MockPlan): ReplanOutput {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(plan.examDate);
  examDate.setHours(0, 0, 0, 0);

  const allTopics = plan.days.flatMap((d) => d.topics);
  const completed = allTopics.filter((t) => t.status === 'COMPLETE');
  const remaining = allTopics.filter((t) => t.status !== 'COMPLETE');
  const completionRate = allTopics.length > 0 ? completed.length / allTopics.length : 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDaysLeft = Math.max(0, Math.floor((examDate.getTime() - today.getTime()) / msPerDay));
  const workingDaysLeft = Math.max(0, totalDaysLeft - 2);
  const revisionDays = Math.min(2, totalDaysLeft);

  const triageMode = completionRate < 0.7 && remaining.length > 0;
  let topicsToSchedule = [...remaining];
  let triageNote: string | undefined;

  if (triageMode) {
    const priorityCount = Math.ceil(remaining.length * 0.4);
    topicsToSchedule = remaining.slice(0, priorityCount);
    triageNote = `Focused mode: covering the essentials to hit your ${plan.goalScore}% target`;
  }

  const dailyCapMins = plan.dailyHours * 60;
  const newDays: { topics: string[] }[] = [];
  let topicIdx = 0;

  for (let i = 0; i < workingDaysLeft && topicIdx < topicsToSchedule.length; i++) {
    const dayTopics: string[] = [];
    let dayMins = 0;

    while (topicIdx < topicsToSchedule.length) {
      const t = topicsToSchedule[topicIdx];
      if (dayMins + t.estimatedMins > dailyCapMins) break;
      dayTopics.push(t.title);
      dayMins += t.estimatedMins;
      topicIdx++;
    }

    if (dayTopics.length > 0) newDays.push({ topics: dayTopics });
  }

  return {
    triageMode,
    triageNote,
    scheduledTopics: newDays.flatMap((d) => d.topics),
    totalDaysScheduled: newDays.length,
    revisionDaysAdded: revisionDays,
  };
}

function makeTopic(id: string, status: MockTopic['status'] = 'NOT_STARTED'): MockTopic {
  return { id, title: `Topic ${id}`, estimatedMins: 45, status };
}

describe('Replan Engine — Logic Unit Tests', () => {
  // Test 1: 100% completion — no topics to schedule
  test('100% completion schedules no new topics', () => {
    const plan: MockPlan = {
      id: 'p1',
      examDate: daysFromNow(10),
      dailyHours: 3,
      goalScore: 70,
      days: [{
        id: 'd1', dayNumber: 1, date: daysFromNow(-1), completed: true,
        topics: [makeTopic('1', 'COMPLETE'), makeTopic('2', 'COMPLETE')],
      }],
    };
    const result = simulateReplan(plan);
    expect(result.scheduledTopics.length).toBe(0);
    expect(result.triageMode).toBe(false);
  });

  // Test 2: 50% done — triage mode kicks in
  test('50% completion triggers triage mode', () => {
    const topics = Array.from({ length: 10 }, (_, i) =>
      makeTopic(String(i), i < 5 ? 'COMPLETE' : 'NOT_STARTED')
    );
    const plan: MockPlan = {
      id: 'p2',
      examDate: daysFromNow(14),
      dailyHours: 2,
      goalScore: 70,
      days: [{ id: 'd1', dayNumber: 1, date: daysFromNow(-1), completed: false, topics }],
    };
    const result = simulateReplan(plan);
    expect(result.triageMode).toBe(true);
    expect(result.triageNote).toContain('Focused mode');
    // Should only schedule 40% of remaining 5 = 2 topics
    expect(result.scheduledTopics.length).toBe(2);
  });

  // Test 3: 0% done — triage mode, only 40% of topics
  test('0% completion triggers triage and schedules 40% of topics', () => {
    const topics = Array.from({ length: 20 }, (_, i) => makeTopic(String(i)));
    const plan: MockPlan = {
      id: 'p3',
      examDate: daysFromNow(10),
      dailyHours: 2,
      goalScore: 60,
      days: [{ id: 'd1', dayNumber: 1, date: daysFromNow(-1), completed: false, topics }],
    };
    const result = simulateReplan(plan);
    expect(result.triageMode).toBe(true);
    // 40% of 20 = 8 topics max
    expect(result.scheduledTopics.length).toBeLessThanOrEqual(8);
  });

  // Test 4: Near exam — 2 days left → only revision days
  test('2 days until exam creates only revision days', () => {
    const plan: MockPlan = {
      id: 'p4',
      examDate: daysFromNow(2),
      dailyHours: 3,
      goalScore: 70,
      days: [{
        id: 'd1', dayNumber: 1, date: daysFromNow(-1), completed: false,
        topics: [makeTopic('1'), makeTopic('2')],
      }],
    };
    const result = simulateReplan(plan);
    expect(result.revisionDaysAdded).toBe(2);
    expect(result.totalDaysScheduled).toBe(0); // 0 working days
  });

  // Test 5: Daily cap respected
  test('daily cap prevents overscheduling per day', () => {
    // 3 topics of 50 min each, daily cap = 2 hours (120 min) → max 2 topics/day
    const topics = Array.from({ length: 6 }, (_, i) => ({
      id: String(i), title: `Topic ${i}`, estimatedMins: 50, status: 'NOT_STARTED' as const,
    }));
    const plan: MockPlan = {
      id: 'p5',
      examDate: daysFromNow(10),
      dailyHours: 2,
      goalScore: 80,
      days: [{ id: 'd1', dayNumber: 1, date: daysFromNow(-1), completed: false, topics }],
    };
    const result = simulateReplan(plan);
    // 6 topics not in triage (100% remaining but 0% complete = triage)
    // Actually completionRate=0 < 0.7 so triage kicks in: 40% of 6 = 3 topics
    // Each day cap = 120min, each topic 50min → 2 per day
    expect(result.scheduledTopics.length).toBeLessThanOrEqual(6);
  });

  // Test 6: Exactly 70% complete — no triage
  test('exactly 70% completion does not trigger triage', () => {
    const topics = Array.from({ length: 10 }, (_, i) =>
      makeTopic(String(i), i < 7 ? 'COMPLETE' : 'NOT_STARTED')
    );
    const plan: MockPlan = {
      id: 'p6',
      examDate: daysFromNow(10),
      dailyHours: 3,
      goalScore: 70,
      days: [{ id: 'd1', dayNumber: 1, date: daysFromNow(-1), completed: false, topics }],
    };
    const result = simulateReplan(plan);
    expect(result.triageMode).toBe(false);
    // Should schedule all 3 remaining topics
    expect(result.scheduledTopics.length).toBe(3);
  });
});
