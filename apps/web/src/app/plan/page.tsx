'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { RefreshCw, ChevronDown, CheckCircle2, Clock, AlertTriangle, Send, MessageSquare, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { get, post } from '@/lib/fetcher';
import { formatDate, formatMins, cn } from '@/lib/utils';
import { usePlan } from '@/components/providers/PlanContext';
import type { Plan } from '@/lib/types';

type Message = { role: 'user' | 'assistant'; text: string };

export default function PlanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { plans } = usePlan();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [replanning, setReplanning] = useState(false);
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([0]));
  const [view, setView] = useState<'plan' | 'chat'>('plan');

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchPlan = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const result = await get<Plan>('/api/plans/active', session.accessToken);
      setPlan(result);
      
      // Load chat history from localStorage
      const cached = localStorage.getItem(`chat:plan:${result.id}`);
      if (cached) {
        setMessages(JSON.parse(cached));
      } else {
        setMessages([
          {
            role: 'assistant',
            text: `Hi! I am your Unslump Plan Adjuster. Need to change anything? Tell me in plain English!\n\nExamples:\n• "Add biochem exercises to Day 3"\n• "Delete photosynthesis from Day 2"\n• "Extend my plan to 45 days"\n• "I have 3 hours on weekends and 1 hour on weekdays"`
          }
        ]);
      }
    } catch {
      // no plan
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') fetchPlan();
  }, [status, fetchPlan, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReplan = async () => {
    if (!plan || !session?.accessToken) return;
    setReplanning(true);
    try {
      const result = await post<{ plan: Plan }>(`/api/plans/${plan.id}/replan`, {}, session.accessToken);
      setPlan(result.plan);
    } catch {
      // silent
    } finally {
      setReplanning(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading || !plan || !session?.accessToken) return;

    const userText = chatInput.trim();
    setChatInput('');
    
    const newMessages: Message[] = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    setChatLoading(true);

    try {
      const result = await post<Plan>(
        `/api/plans/${plan.id}/chat`,
        { messages: newMessages },
        session.accessToken
      );
      setPlan(result);
      
      const updatedMessages: Message[] = [
        ...newMessages,
        { role: 'assistant', text: `Adjusted plan successfully! Check out your updated timeline on the left.` }
      ];
      setMessages(updatedMessages);
      localStorage.setItem(`chat:plan:${plan.id}`, JSON.stringify(updatedMessages));
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', text: `Sorry, I hit a snag modifying your plan. Please try rephrasing your request.` }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-border/40 pb-5">
            <div className="space-y-2">
              <div className="h-8 w-60 bg-secondary/40 dark:bg-card/40 rounded" />
              <div className="h-4 w-96 bg-secondary/30 dark:bg-card/30 rounded" />
            </div>
            <div className="h-10 w-24 bg-secondary/40 dark:bg-card/40 rounded-xl" />
          </div>

          {/* Main layout skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left timeline */}
            <div className="lg:col-span-7 space-y-4">
              <div className="h-6 w-40 bg-secondary/40 dark:bg-card/40 rounded" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-secondary/20 dark:bg-card/20 rounded-2xl border border-border/20" />
                ))}
              </div>
            </div>
            
            {/* Right chat panel */}
            <div className="lg:col-span-5 space-y-4">
              <div className="h-6 w-40 bg-secondary/40 dark:bg-card/40 rounded" />
              <div className="h-[400px] bg-secondary/20 dark:bg-card/20 rounded-3xl border border-border/20" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!plan) {
    return (
      <AppShell>
        <div className="text-center py-20 animate-fade-up">
          <h2 className="text-2xl font-bold mb-2">No active plan</h2>
          <p className="text-muted-foreground mb-6">Create a study plan to get started.</p>
          <Button onClick={() => router.push('/onboard')}>Create plan</Button>
        </div>
      </AppShell>
    );
  }

  // Group days by week
  const weeks: typeof plan.days[] = [];
  for (let i = 0; i < plan.days.length; i += 7) {
    weeks.push(plan.days.slice(i, i + 7));
  }

  const toggleWeek = (i: number) => {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const statusConfig = {
    COMPLETE: { label: 'Done', variant: 'success' as const, icon: CheckCircle2 },
    IN_PROGRESS: { label: 'In progress', variant: 'accent' as const, icon: RefreshCw },
    WEAK: { label: 'Needs review', variant: 'warning' as const, icon: AlertTriangle },
    NOT_STARTED: { label: 'Upcoming', variant: 'secondary' as const, icon: Clock },
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-extrabold tracking-tight gradient-text">{plan.subject}</h1>
              {plans.length > 1 && (
                <button
                  onClick={() => router.push('/plans')}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border/40 hover:border-border px-2 py-0.5 rounded-full transition-all"
                >
                  Switch plan
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">Exam: {formatDate(plan.examDate)} • Goal: {plan.goalScore}% • Availability: {plan.dailyHours}h/day</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mobile View Toggle */}
            <div className="flex lg:hidden bg-secondary rounded-xl p-1 border border-border">
              <button
                onClick={() => setView('plan')}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", view === 'plan' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
              >
                Plan View
              </button>
              <button
                onClick={() => setView('chat')}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", view === 'chat' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
              >
                AI Adjuster
              </button>
            </div>

            <Button variant="outline" className="rounded-xl" onClick={handleReplan} loading={replanning} id="replan-btn">
              <RefreshCw className="h-4 w-4" />
              Replan
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Side: Study Plan Timeline */}
          <div className={cn("lg:col-span-7 space-y-4", view !== 'plan' && "hidden lg:block")}>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Timeline Overview
            </h2>

            <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-2">
              {weeks.map((weekDays, wi) => (
                <Card key={wi} glow={true} className="overflow-hidden border border-border/40 shadow-sm">
                  <button
                    onClick={() => toggleWeek(wi)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-secondary/30 transition-colors"
                    id={`week-${wi + 1}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">Week {wi + 1}</span>
                      <Badge variant="secondary">
                        {weekDays.filter((d) => d.completed).length}/{weekDays.length} days complete
                      </Badge>
                    </div>
                    <ChevronDown
                      className={cn('h-5 w-5 text-muted-foreground transition-transform', openWeeks.has(wi) && 'rotate-180')}
                    />
                  </button>

                  {openWeeks.has(wi) && (
                    <div className="px-6 pb-4 space-y-3 animate-fade-up">
                      {weekDays.map((day) => (
                        <div
                          key={day.id}
                          className={cn(
                            'rounded-xl p-4 border transition-all',
                            day.completed
                              ? 'border-green-500/20 bg-green-500/5'
                              : 'border-border/50 bg-secondary/20'
                          )}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary">Day {day.dayNumber}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(day.date)}</span>
                            </div>
                            {day.completed && <Badge variant="success">Complete</Badge>}
                          </div>

                          <div className="space-y-2">
                            {day.topics.map((topic) => {
                              const cfg = statusConfig[topic.status];
                              return (
                                <div key={topic.id} className="flex items-center justify-between gap-3 py-1 border-b border-border/20 last:border-0 pb-1.5 last:pb-0">
                                  <div className="flex items-center gap-2.5">
                                    <cfg.icon className={cn(
                                      'h-4 w-4 shrink-0',
                                      topic.status === 'COMPLETE' ? 'text-green-400' :
                                      topic.status === 'WEAK' ? 'text-yellow-400' :
                                      topic.status === 'IN_PROGRESS' ? 'text-accent' :
                                      'text-muted-foreground'
                                    )} />
                                    <span className="text-sm font-medium leading-tight">{topic.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant={cfg.variant} className="text-xs px-2 py-0">{cfg.label}</Badge>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatMins(topic.estimatedMins)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Right Side: Chat Panel */}
          <div className={cn("lg:col-span-5 flex flex-col", view !== 'chat' && "hidden lg:flex")}>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-accent" />
              Plan Adjuster Chat
            </h2>

            <Card glow={true} className="flex-1 flex flex-col justify-between h-[calc(100vh-16rem)] border border-border/40 shadow-lg overflow-hidden rounded-3xl">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] text-sm px-4 py-3 rounded-2xl shadow-sm leading-relaxed whitespace-pre-wrap",
                        m.role === 'user' ? "bubble-user" : "bubble-bot"
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start items-center gap-2 animate-pulse">
                    <div className="bubble-bot flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-border/40 bg-secondary/10">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Unslump to change your plan..."
                    disabled={chatLoading}
                    className="rounded-xl border border-border focus-visible:ring-primary shadow-inner bg-background"
                  />
                  <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()} className="rounded-xl shadow-md">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
