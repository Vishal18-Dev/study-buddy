// Client-side type definitions
export interface Topic {
  id: string;
  planDayId: string;
  title: string;
  estimatedMins: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'WEAK';
  notes?: string | null;
}

export interface PlanDay {
  id: string;
  planId: string;
  dayNumber: number;
  date: string;
  topics: Topic[];
  completed: boolean;
}

export interface Plan {
  id: string;
  userId: string;
  subject: string;
  examDate: string;
  goalScore: number;
  dailyHours: number;
  status: string;
  days: PlanDay[];
  createdAt: string;
  updatedAt: string;
}

export interface Streak {
  id: string;
  userId: string;
  current: number;
  longest: number;
  graceDaysUsed: number;
  lastCheckIn: string | null;
}

export interface QuizQuestion {
  index: number;
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
}

export interface DashboardData {
  plan: Plan | null;
  todayTopics: Topic[];
  streak: Streak | null;
  coveragePercent: number;
  recentQuizScores: { topicTitle: string; score: number; passed: boolean }[];
  todayCheckInDone: boolean;
}
