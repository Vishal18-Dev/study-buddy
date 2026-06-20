'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { get } from '@/lib/fetcher';
import type { DashboardData } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ProgressPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const result = await get<DashboardData>('/api/dashboard', session.accessToken);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') fetchData();
  }, [status, fetchData, router]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-8 animate-pulse">
          <div className="space-y-2">
            <div className="h-7 w-32 bg-secondary/40 dark:bg-card/40 rounded" />
            <div className="h-4 w-48 bg-secondary/30 dark:bg-card/30 rounded" />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Syllabus card skeleton */}
            <div className="h-64 bg-secondary/20 dark:bg-card/20 rounded-2xl border border-border/20" />
            {/* Streak card skeleton */}
            <div className="h-64 bg-secondary/20 dark:bg-card/20 rounded-2xl border border-border/20" />
          </div>

          {/* Activity heatmap skeleton */}
          <div className="h-32 bg-secondary/20 dark:bg-card/20 rounded-2xl border border-border/20" />
        </div>
      </AppShell>
    );
  }

  // Coverage donut data
  const covered = data?.coveragePercent || 0;
  const pieData = [
    { name: 'Covered', value: covered },
    { name: 'Remaining', value: 100 - covered },
  ];

  // Quiz bar data
  const quizData = (data?.recentQuizScores || []).map((r) => ({
    topic: r.topicTitle.length > 12 ? r.topicTitle.slice(0, 12) + '...' : r.topicTitle,
    score: r.score,
    passed: r.passed,
  }));

  // Streak heatmap — last 30 days
  const streakData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { date: d, active: Math.random() > 0.4 }; // stub: replace with real checkin data
  });

  const COLORS = ['hsl(221.2 83.2% 53.3%)', 'hsl(217 32% 17%)'];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Progress</h1>
          <p className="text-muted-foreground text-sm">Track your study journey</p>
        </div>

        {/* Streak + coverage row */}
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Coverage donut */}
          <Card glow={true}>
            <CardHeader>
              <CardTitle className="text-base">Syllabus Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
                      <tspan className="text-2xl font-bold" style={{ fill: 'white', fontSize: '24px' }}>{covered}%</tspan>
                    </text>
                    <Tooltip
                      contentStyle={{ background: 'hsl(222 47% 11%)', border: '1px solid hsl(217 32% 17%)', borderRadius: '12px' }}
                      labelStyle={{ color: 'white' }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ color: 'hsl(215 20% 65%)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Streak card */}
          <Card glow={true}>
            <CardHeader>
              <CardTitle className="text-base">Streak Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold gradient-text">{data?.streak?.current || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Current streak</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold gradient-text">{data?.streak?.longest || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Longest streak</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

         {/* Streak heatmap */}
        <Card glow={true}>
          <CardHeader>
            <CardTitle className="text-base">Activity — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {streakData.map(({ date, active }, i) => (
                <div
                  key={i}
                  title={date.toLocaleDateString()}
                  className={cn(
                    'h-6 w-6 rounded-md transition-all',
                    active
                      ? 'bg-primary/80 hover:bg-primary'
                      : 'bg-secondary hover:bg-secondary/70'
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              ■ Active day   ■ Missed day
            </p>
          </CardContent>
        </Card>

        {/* Quiz performance */}
        {quizData.length > 0 && (
          <Card glow={true}>
            <CardHeader>
              <CardTitle className="text-base">Quiz Performance by Topic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quizData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                    <XAxis
                      dataKey="topic"
                      tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ background: 'hsl(222 47% 11%)', border: '1px solid hsl(217 32% 17%)', borderRadius: '12px' }}
                      labelStyle={{ color: 'white' }}
                      cursor={{ fill: 'hsl(217 32% 17% / 0.5)' }}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {quizData.map((d, i) => (
                        <Cell key={i} fill={d.passed ? 'hsl(142 76% 46%)' : 'hsl(38 92% 50%)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
