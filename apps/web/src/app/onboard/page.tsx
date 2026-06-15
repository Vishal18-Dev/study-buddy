'use client';
// force rebuild
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Send, Upload, ArrowRight, BookOpen, ArrowLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { post } from '@/lib/fetcher';
import type { Plan } from '@/lib/types';

type Message = { role: 'bot' | 'user'; text: string };
type KnowledgeLevel = 'BEGINNER' | 'SOME_KNOWLEDGE' | 'REVISION';

interface FormData {
  subject: string;
  examDate: string;
  dailyHours: number;
  goalScore: number;
  knowledgeLevel: KnowledgeLevel;
  syllabusContext: string;
}

const QUESTIONS = [
  { key: 'subject' as const, text: 'What subject or exam are you preparing for?' },
  { key: 'examDate' as const, text: 'When is your exam? (e.g. "2024-08-15" or "in 30 days")' },
  { key: 'dailyHours' as const, text: 'How many hours can you study per day? (e.g. 2)' },
  { key: 'goalScore' as const, text: 'What\'s your target score? (e.g. 70 for 70%, or just type "pass" for 60)' },
  { key: 'knowledgeLevel' as const, text: 'How would you rate your current knowledge?', choices: ['Beginner', 'Some knowledge', 'Revision mode'] },
  { key: 'syllabusFile' as const, text: 'Want to upload your syllabus PDF for a more personalised plan? (optional — type "skip" to continue)', isFile: true },
];

function parseExamDate(input: string): string {
  if (/in\s+\d+\s+days?/i.test(input)) {
    const days = parseInt(input.match(/(\d+)/)?.[1] || '30');
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  // Default: 30 days
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

function parseGoalScore(input: string): number {
  if (/pass/i.test(input)) return 60;
  const num = parseInt(input);
  return isNaN(num) ? 60 : Math.min(100, Math.max(1, num));
}

const knowledgeMap: Record<string, KnowledgeLevel> = {
  'beginner': 'BEGINNER',
  'some knowledge': 'SOME_KNOWLEDGE',
  'revision mode': 'REVISION',
  'revision': 'REVISION',
  '1': 'BEGINNER',
  '2': 'SOME_KNOWLEDGE',
  '3': 'REVISION',
};

export default function OnboardPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: "Hi! I'm StudyBuddy. Let's build your personalised study plan — it only takes 2 minutes. " + QUESTIONS[0].text },
  ]);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState('');
  const [formData, setFormData] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planSummary, setPlanSummary] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBot = (text: string) => setMessages((m) => [...m, { role: 'bot', text }]);
  const addUser = (text: string) => setMessages((m) => [...m, { role: 'user', text }]);

  const advanceStep = useCallback(async (answer: string) => {
    const q = QUESTIONS[step];
    if (!q) {
      if (answer.toLowerCase().trim() === 'retry') {
        addUser(answer);
        setStep(QUESTIONS.length - 1);
        setTimeout(() => addBot("Okay! To trigger the generation again, just type 'skip' or upload your syllabus again."), 400);
      }
      return;
    }

    addUser(answer);

    const updated = { ...formData };

    if (q.key === 'subject') updated.subject = answer;
    else if (q.key === 'examDate') updated.examDate = parseExamDate(answer);
    else if (q.key === 'dailyHours') updated.dailyHours = parseFloat(answer) || 2;
    else if (q.key === 'goalScore') updated.goalScore = parseGoalScore(answer);
    else if (q.key === 'knowledgeLevel') {
      updated.knowledgeLevel = knowledgeMap[answer.toLowerCase()] || 'BEGINNER';
    } else if (q.key === 'syllabusFile') {
      if (answer.startsWith('Uploaded:')) {
        updated.syllabusContext = `Syllabus PDF file uploaded: ${answer.replace('Uploaded: ', '')}`;
      }
    }

    setFormData(updated);

    const nextStep = step + 1;
    setStep(nextStep);

    if (nextStep < QUESTIONS.length) {
      const nextQ = QUESTIONS[nextStep];
      setTimeout(() => {
        if (nextQ.choices) {
          addBot(nextQ.text + '\n\nChoose one: Beginner / Some knowledge / Revision mode');
        } else {
          addBot(nextQ.text);
        }
      }, 400);
    } else {
      // All questions answered — generate plan
      setTimeout(() => {
        addBot("Building your personalised study plan... this usually takes 10–15 seconds.");
      }, 400);
      setLoading(true);

      try {
        const token = session?.accessToken || undefined;
        const result = await post<{ plan: Plan; summary: string }>('/api/plans/create', {
          subject: updated.subject || 'General Studies',
          examDate: updated.examDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          dailyHours: updated.dailyHours || 2,
          goalScore: updated.goalScore || 60,
          knowledgeLevel: updated.knowledgeLevel || 'BEGINNER',
          syllabusContext: updated.syllabusContext || '',
        }, token);

        setPlan(result.plan);
        setPlanSummary(result.summary);
        localStorage.setItem('pendingPlanId', result.plan.id);

        setTimeout(() => {
          addBot(`Your plan is ready! Here\'s the overview:\n\n${result.summary}\n\nYou have ${result.plan.days.length} days planned. Save your plan to track progress and access it anytime.`);
        }, 400);
      } catch {
        addBot("We hit a snag generating your plan. Let\'s try with the details you provided — please type 'retry'.");
      } finally {
        setLoading(false);
      }
    }

    setInput('');
  }, [step, formData, session?.accessToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      advanceStep(`Uploaded: ${file.name}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    advanceStep(input.trim());
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              <ArrowLeft className="h-4 w-4" />
              Exit
            </Link>
            <div className="h-4 w-px bg-border" />
            <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-bold gradient-text">StudyBuddy AI</span>
            </Link>
          </div>
          <span className="text-xs text-muted-foreground">Step {Math.min(step + 1, QUESTIONS.length)} of {QUESTIONS.length}</span>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col gap-4 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex animate-fade-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'bot' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 mr-3 mt-1">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] whitespace-pre-wrap text-sm ${
                m.role === 'bot' ? 'bubble-bot' : 'bubble-user'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 animate-fade-up">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div className="bubble-bot flex items-center gap-2">
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="text-sm text-muted-foreground">Building your plan...</span>
            </div>
          </div>
        )}

        {/* Plan preview + CTA */}
        {plan && (
          <div className="animate-fade-up mt-4">
            <Card className="p-6 border-glow">
              <h3 className="font-semibold text-lg mb-1">Your Study Plan</h3>
              <p className="text-muted-foreground text-sm mb-4">{planSummary}</p>
              <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                {plan.days.slice(0, 5).map((day) => (
                  <div key={day.id} className="flex items-start gap-3 py-2 border-b border-border/50">
                    <span className="text-xs font-medium text-primary shrink-0">Day {day.dayNumber}</span>
                    <div className="flex flex-wrap gap-1">
                      {day.topics.map((t) => (
                        <span key={t.id} className="text-xs bg-secondary rounded-full px-2 py-0.5">{t.title}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {plan.days.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">+ {plan.days.length - 5} more days</p>
                )}
              </div>
              {status === 'authenticated' ? (
                <Link href="/dashboard">
                  <Button className="w-full" size="lg">
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href={`/signup?planId=${plan.id}`}>
                  <Button className="w-full" size="lg">
                    Save your plan — it&apos;s free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </Card>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!plan && (
        <div className="glass border-t border-border sticky bottom-0">
          <div className="max-w-2xl mx-auto px-4 py-4">
            {QUESTIONS[step]?.choices ? (
              <div className="flex flex-wrap gap-2">
                {QUESTIONS[step].choices!.map((c) => (
                  <button
                    key={c}
                    onClick={() => advanceStep(c)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-primary/10 hover:border-primary/40 transition-all duration-200 disabled:opacity-50"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : QUESTIONS[step]?.isFile ? (
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                  disabled={loading}
                >
                  <Upload className="h-4 w-4" />
                  Upload PDF
                </Button>
                <Button variant="ghost" onClick={() => advanceStep('skip')} disabled={loading}>
                  Skip
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={loading}
                  autoFocus
                  id="onboard-input"
                />
                <Button type="submit" disabled={loading || !input.trim()} size="icon" id="onboard-send">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
