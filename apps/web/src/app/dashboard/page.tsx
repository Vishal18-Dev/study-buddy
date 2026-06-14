'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Circle, Clock, Flame, Target, CalendarDays,
  BookOpen, ChevronRight, Lock, Trophy, PlayCircle, Sparkles,
  ArrowRight, BarChart3
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { get, post, patch } from '@/lib/fetcher';
import { daysUntil, formatMins, cn } from '@/lib/utils';
import type { DashboardData, Topic } from '@/lib/types';



/** Simple inline video-link card shown under each topic */
function VideoCard({ topicId, title }: { topicId: string; title: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/study/${topicId}`)}
      className="w-full text-left flex items-center gap-2.5 mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-primary/5 hover:border-primary/20 transition-all group"
      id={`video-card-${topicId}`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 shrink-0">
        <PlayCircle className="h-4 w-4 text-red-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
          Watch & Learn: {title}
        </p>
        <p className="text-[10px] text-muted-foreground">Play video inline in Study Mode</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className="card-elevated p-4 flex items-start gap-3">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkInDone, setCheckInDone] = useState(false);
  const [milestoneMsg, setMilestoneMsg] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const result = await get<DashboardData>('/api/dashboard', session.accessToken);
      setData(result);
      setCheckInDone(result.todayCheckInDone);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') fetchDashboard();
  }, [status, fetchDashboard, router]);

  const handleTopicToggle = async (topic: Topic) => {
    if (!session?.accessToken || !data) return;
    const newStatus = topic.status === 'COMPLETE' ? 'NOT_STARTED' : 'COMPLETE';
    try {
      await patch(`/api/topics/${topic.id}/status`, { status: newStatus }, session.accessToken);
      fetchDashboard();
    } catch { /* silent */ }
  };

  const handleCheckIn = async (flag: string) => {
    if (!session?.accessToken || !data?.plan) return;
    setCheckingIn(true);
    try {
      const result = await post<{ milestoneMessage?: string }>(                '/api/checkin',
        { planId: data.plan.id, completionFlag: flag, sessionMins: 0 },
        session.accessToken
      );
      if (result.milestoneMessage) setMilestoneMsg(result.milestoneMessage);
      setCheckInDone(true);
      fetchDashboard();
    } catch { /* silent */ } finally { setCheckingIn(false); }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data?.plan) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">No active study plan</h2>
            <p className="text-muted-foreground">Let&apos;s build one — it takes less than 2 minutes.</p>
          </div>
          <Button size="lg" onClick={() => router.push('/onboard')}>
            Create my study plan
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </AppShell>
    );
  }

  const { plan, todayTopics, streak, coveragePercent, recentQuizScores } = data;
  const daysLeft = daysUntil(plan.examDate);
  const totalMins = todayTopics.reduce((acc, t) => acc + t.estimatedMins, 0);
  const completedCount = todayTopics.filter(t => t.status === 'COMPLETE').length;
  const allDone = todayTopics.length > 0 && completedCount === todayTopics.length;
  const firstName = session?.user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-up">

        {/* ── Milestone banner ───────────────────────── */}
        {milestoneMsg && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">{milestoneMsg}</p>
          </div>
        )}

        {/* ── Hero card ──────────────────────────────── */}
        <div className="hero-gradient rounded-2xl px-6 py-7 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          <div className="relative">
            <p className="text-white/70 text-sm font-medium">{greeting}, {firstName}</p>
            <h1 className="text-2xl font-bold mt-1 mb-4">{plan.subject}</h1>

            <div className="flex flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold">
                <CalendarDays className="h-3.5 w-3.5" />
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} to exam
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold">
                <Target className="h-3.5 w-3.5" />
                Goal: {plan.goalScore}%
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold">
                <Clock className="h-3.5 w-3.5" />
                {formatMins(totalMins)} today
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/70">Syllabus coverage</span>
                <span className="font-bold">{coveragePercent}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-white rounded-full transition-all duration-700"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>

            {todayTopics.length > 0 ? (
              <Button
                className="bg-white text-primary hover:bg-white/90 font-semibold shadow-md"
                onClick={() => router.push(`/study/${todayTopics.find(t => t.status !== 'COMPLETE')?.id || todayTopics[0].id}`)}
                id="start-studying-btn"
              >
                <PlayCircle className="h-4 w-4" />
                {allDone ? 'Review today\'s topics' : 'Start Studying'}
              </Button>
            ) : (
              <p className="text-white/70 text-sm">No topics scheduled for today.</p>
            )}
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
          <StatCard
            label="Day streak"
            value={streak?.current || 0}
            icon={Flame}
            accent="bg-orange-50 text-orange-500"
          />
          <StatCard
            label="Days to exam"
            value={daysLeft}
            icon={CalendarDays}
            accent="bg-primary/10 text-primary"
          />
          <StatCard
            label="Coverage"
            value={`${coveragePercent}%`}
            icon={BarChart3}
            accent="bg-teal-50 text-teal-600"
          />
          <StatCard
            label="Today"
            value={`${completedCount}/${todayTopics.length}`}
            sub="topics done"
            icon={CheckCircle2}
            accent="bg-emerald-50 text-emerald-600"
          />
        </div>

        {/* ── Check-in prompt ────────────────────────── */}
        {!checkInDone && (
          <div className="card-elevated p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              How did yesterday go?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { flag: 'YES',           label: 'Completed it',  color: 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200' },
                { flag: 'PARTIALLY',     label: 'Partially',     color: 'text-amber-600 hover:bg-amber-50 hover:border-amber-200' },
                { flag: 'NO',            label: 'Missed it',     color: 'text-red-500 hover:bg-red-50 hover:border-red-200' },
                { flag: 'LOGGED_OFFLINE',label: 'Studied offline',color: 'text-blue-600 hover:bg-blue-50 hover:border-blue-200' },
              ].map(({ flag, label, color }) => (
                <button
                  key={flag}
                  onClick={() => handleCheckIn(flag)}
                  disabled={checkingIn}
                  id={`checkin-${flag.toLowerCase()}`}
                  className={cn(
                    'py-2.5 px-3 rounded-xl border border-border text-xs font-semibold transition-all duration-150 disabled:opacity-50',
                    color
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Today's plan ───────────────────────────── */}
        <div className="card-elevated">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Today&apos;s Plan
            </h2>
            <Badge variant="secondary" className="font-semibold">
              {completedCount}/{todayTopics.length} done
            </Badge>
          </div>

          {todayTopics.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-lg">All done for today!</p>
              <p className="text-muted-foreground text-sm mt-1">You&apos;ve earned a rest.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {todayTopics.map((topic, idx) => {
                const done = topic.status === 'COMPLETE';
                return (
                  <div key={topic.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {/* Toggle */}
                      <button
                        onClick={() => handleTopicToggle(topic)}
                        className="shrink-0 transition-transform hover:scale-110"
                        id={`topic-toggle-${topic.id}`}
                      >
                        {done
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          : <Circle className="h-5 w-5 text-slate-300 hover:text-primary transition-colors" />
                        }
                      </button>

                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-semibold leading-snug',
                          done ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}>
                          {idx + 1}. {topic.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatMins(topic.estimatedMins)}
                        </p>
                      </div>

                      {/* Study button */}
                      {!done && (
                        <button
                          onClick={() => router.push(`/study/${topic.id}`)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline shrink-0"
                          id={`study-${topic.id}`}
                        >
                          Study
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* YouTube link for each topic */}
                    {!done && <VideoCard topicId={topic.id} title={topic.title} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Daily test card ────────────────────────── */}
        <div
          className={cn(
            'rounded-2xl p-5 border transition-all duration-500',
            allDone
              ? 'quiz-unlock-glow bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-border opacity-80'
          )}
          id="daily-quiz-card"
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl shrink-0',
              allDone ? 'bg-emerald-100' : 'bg-slate-200'
            )}>
              {allDone
                ? <Trophy className="h-6 w-6 text-emerald-600" />
                : <Lock className="h-6 w-6 text-slate-400" />
              }
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                {allDone ? 'Daily Test — Unlocked!' : 'Daily Test'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allDone
                  ? 'You finished all topics. Take your daily assessment now.'
                  : `Complete all ${todayTopics.length} topics to unlock today's test.`
                }
              </p>
            </div>
            {allDone && todayTopics.length > 0 && (
              <Button
                onClick={() => router.push(`/quiz/${todayTopics[0].id}`)}
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                id="take-daily-test-btn"
              >
                Take test
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Progress towards unlock */}
          {!allDone && todayTopics.length > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>{completedCount} of {todayTopics.length} topics complete</span>
                <span>{Math.round((completedCount / todayTopics.length) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-1.5 bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${(completedCount / todayTopics.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Recent quiz scores ──────────────────────── */}
        {recentQuizScores.length > 0 && (
          <div className="card-elevated p-5">
            <h2 className="font-semibold text-sm text-foreground mb-3">Recent Quiz Scores</h2>
            <div className="space-y-2">
              {recentQuizScores.slice(0, 4).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0">
                  <span className="text-sm text-foreground truncate flex-1 mr-3">{r.topicTitle}</span>
                  <Badge
                    variant={r.passed ? 'success' : 'warning'}
                    className="font-bold shrink-0"
                  >
                    {r.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
