import { prisma } from '../lib/prisma';
import { Plan, PlanDay, Topic } from '@prisma/client';

type PlanWithDays = Plan & {
  days: (PlanDay & { topics: Topic[] })[];
};

export interface ReplanResult {
  plan: PlanWithDays;
  triageMode: boolean;
  triageNote?: string;
}

export async function replanFromNow(planId: string): Promise<ReplanResult> {
  // 1. Load full plan
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      days: {
        include: { topics: true },
        orderBy: { dayNumber: 'asc' },
      },
    },
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(plan.examDate);
  examDate.setHours(0, 0, 0, 0);

  // 2. Separate completed from remaining topics
  const allTopics = plan.days.flatMap((d) => d.topics);
  const completedTopics = allTopics.filter((t) => t.status === 'COMPLETE');
  const remainingTopics = allTopics.filter(
    (t) => t.status !== 'COMPLETE'
  );

  const completionRate = allTopics.length > 0 ? completedTopics.length / allTopics.length : 0;

  // 3. Calculate working days (reserve last 2 days for revision)
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDaysLeft = Math.max(0, Math.floor((examDate.getTime() - today.getTime()) / msPerDay));
  const workingDaysLeft = Math.max(0, totalDaysLeft - 2);
  const revisionDays = Math.min(2, totalDaysLeft);

  // 4. Triage mode if completion rate < 70%
  const triageMode = completionRate < 0.7 && remainingTopics.length > 0;
  let topicsToSchedule = [...remainingTopics];
  let triageNote: string | undefined;

  if (triageMode) {
    const priorityCount = Math.ceil(remainingTopics.length * 0.4);
    const priorityTopics = remainingTopics.slice(0, priorityCount);
    // Mark rest as optional (we keep them but flag in title)
    topicsToSchedule = priorityTopics;
    triageNote = `Focused mode: covering the essentials to hit your ${plan.goalScore}% target`;
  }

  // 5. Delete all future (incomplete) days and re-create
  const futureDayIds = plan.days
    .filter((d) => {
      const dayDate = new Date(d.date);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate >= today && !d.completed;
    })
    .map((d) => d.id);

  if (futureDayIds.length > 0) {
    await prisma.topic.deleteMany({
      where: { planDayId: { in: futureDayIds } },
    });
    await prisma.planDay.deleteMany({
      where: { id: { in: futureDayIds } },
    });
  }

  // 6. Redistribute topics across working days
  const dailyCapMins = plan.dailyHours * 60;
  const newDays: { date: Date; topics: { title: string; estimatedMins: number }[] }[] = [];

  let topicIdx = 0;
  for (let i = 0; i < workingDaysLeft && topicIdx < topicsToSchedule.length; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const dayTopics: { title: string; estimatedMins: number }[] = [];
    let dayMins = 0;

    while (topicIdx < topicsToSchedule.length) {
      const t = topicsToSchedule[topicIdx];
      if (dayMins + t.estimatedMins > dailyCapMins) break;
      dayTopics.push({ title: t.title, estimatedMins: t.estimatedMins });
      dayMins += t.estimatedMins;
      topicIdx++;
    }

    if (dayTopics.length > 0) {
      newDays.push({ date, topics: dayTopics });
    }
  }

  // 7. Add revision days at the end
  for (let r = 0; r < revisionDays; r++) {
    const date = new Date(examDate);
    date.setDate(examDate.getDate() - (revisionDays - r));
    newDays.push({
      date,
      topics: [{ title: 'Revision — review all completed topics', estimatedMins: Math.floor(dailyCapMins * 0.8) }],
    });
  }

  // 8. Get current max dayNumber
  const completedDays = plan.days.filter((d) => d.completed);
  const maxDayNum = completedDays.length > 0
    ? Math.max(...completedDays.map((d) => d.dayNumber))
    : 0;

  // 9. Create new PlanDay records
  for (let i = 0; i < newDays.length; i++) {
    const { date, topics } = newDays[i];
    await prisma.planDay.create({
      data: {
        planId: plan.id,
        dayNumber: maxDayNum + i + 1,
        date,
        topics: {
          create: topics.map((t) => ({
            title: t.title,
            estimatedMins: t.estimatedMins,
          })),
        },
      },
    });
  }

  // 10. Return updated plan
  const updatedPlan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      days: {
        include: { topics: true },
        orderBy: { dayNumber: 'asc' },
      },
    },
  }) as PlanWithDays;

  return { plan: updatedPlan, triageMode, triageNote };
}

export async function integrateKnowledgeSources(planId: string, userId: string): Promise<void> {
  const { mapResourcesToTopics } = require('./llm.service');
  
  const topics = await prisma.topic.findMany({
    where: {
      planDay: { planId },
      status: { not: 'COMPLETE' }
    },
    select: { id: true, title: true }
  });

  const resources = await prisma.knowledgeSource.findMany({
    where: { planId, userId },
    select: { title: true, type: true }
  });

  if (topics.length === 0 || resources.length === 0) return;

  try {
    const mapping = await mapResourcesToTopics(topics, resources);
    for (const [topicId, newTitle] of Object.entries(mapping)) {
      if (typeof newTitle === 'string') {
        await prisma.topic.update({
          where: { id: topicId },
          data: { title: newTitle }
        });
      }
    }
  } catch (err) {
    console.error('❌ [Replan] Failed to integrate knowledge sources:', err);
  }
}
