// ─────────────────────────────────────────────
// Enums (mirror Prisma enums exactly)
// ─────────────────────────────────────────────

export type Tier = 'FREE' | 'MONTHLY' | 'ANNUAL';
export type PlanStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
export type TopicStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'WEAK';
export type CompletionFlag = 'YES' | 'PARTIALLY' | 'NO' | 'LOGGED_OFFLINE';
export type UserPreference = 'PLAN_ONLY' | 'PLAN_CONTENT' | 'PLAN_CONTENT_EXAMS';

// ─────────────────────────────────────────────
// Domain Types
// ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name?: string | null;
  tier: Tier;
  preference: UserPreference;
  telegramId?: string | null;
  createdAt: Date;
}

export interface KnowledgeSource {
  id: string;
  userId: string;
  planId: string;
  title: string;
  type: 'pdf' | 'text' | 'youtube' | 'link';
  url?: string | null;
  content?: string | null;
  createdAt: Date;
}

export interface TopicRecommendation {
  id: string;
  topicId: string;
  title: string;
  url: string;
  isPaid: boolean;
  platform: 'YouTube' | 'Coursera' | 'Udemy' | 'Simplilearn' | 'OpenSource';
  rating: number;
}

export interface Topic {
  id: string;
  planDayId: string;
  title: string;
  estimatedMins: number;
  status: TopicStatus;
  notes?: string | null;
}

export interface PlanDay {
  id: string;
  planId: string;
  dayNumber: number;
  date: Date;
  topics: Topic[];
  completed: boolean;
}

export interface Plan {
  id: string;
  userId: string;
  subject: string;
  examDate: Date;
  goalScore: number;
  dailyHours: number;
  status: PlanStatus;
  days: PlanDay[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Streak {
  id: string;
  userId: string;
  current: number;
  longest: number;
  graceDaysUsed: number;
  lastCheckIn?: Date | null;
  updatedAt: Date;
}

export interface CheckIn {
  id: string;
  userId: string;
  planId: string;
  completionFlag: CompletionFlag;
  sessionMins: number;
  note?: string | null;
  createdAt: Date;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizResult {
  id: string;
  userId: string;
  topicId: string;
  score: number;
  passed: boolean;
  questions: QuizQuestion[];
  createdAt: Date;
}

// ─────────────────────────────────────────────
// API Request / Response Types
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StreakMilestone {
  days: number;
  message: string;
}

export interface DashboardData {
  plan: Plan | null;
  todayTopics: Topic[];
  streak: Streak | null;
  coveragePercent: number;
  recentQuizScores: { topicTitle: string; score: number; passed: boolean }[];
  todayCheckInDone: boolean;
  checkInMessage?: string;
  streakMilestone?: StreakMilestone;
}

// ─────────────────────────────────────────────
// LLM Output Shapes
// ─────────────────────────────────────────────

export interface LLMPlanDay {
  dayNumber: number;
  date: string; // YYYY-MM-DD
  topics: { title: string; estimatedMins: number }[];
}

export interface LLMPlan {
  summary: string;
  days: LLMPlanDay[];
}

export interface LLMQuiz {
  questions: QuizQuestion[];
}

// ─────────────────────────────────────────────
// Request Body Types (used by both API and web)
// ─────────────────────────────────────────────

export interface CreatePlanBody {
  subject: string;
  examDate: string; // ISO date string
  dailyHours: number;
  goalScore: number;
  knowledgeLevel: 'BEGINNER' | 'SOME_KNOWLEDGE' | 'REVISION';
  syllabusContext?: string;
}

export interface RegisterBody {
  email: string;
  password: string;
  name?: string;
  planId?: string; // pre-generated plan to associate
  preference?: UserPreference;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface CheckInBody {
  planId: string;
  completionFlag: CompletionFlag;
  sessionMins: number;
  note?: string;
}

export interface QuizSubmitAnswer {
  questionIndex: number;
  selectedIndex: number;
}

export interface QuizSubmitBody {
  topicId: string;
  answers: QuizSubmitAnswer[];
}
