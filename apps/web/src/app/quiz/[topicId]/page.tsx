'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { post } from '@/lib/fetcher';
import { cn } from '@/lib/utils';

interface FullQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export default function QuizPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ questionIndex: number; selectedIndex: number }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; message: string; gradedAnswers: unknown[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (!session?.accessToken || !topicId) return;
    const load = async () => {
      try {
        const res = await post<{ questions: unknown[]; _full: FullQuestion[] }>(
          '/api/quiz/generate',
          { topicId },
          session.accessToken
        );
        setQuestions(res._full);
      } catch {
        // silent — show error state
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session?.accessToken, topicId]);

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
  };

  const handleNext = () => {
    if (selected === null) return;
    const newAnswers = [...answers, { questionIndex: currentQ, selectedIndex: selected }];
    setAnswers(newAnswers);
    setSelected(null);
    setRevealed(false);

    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      handleSubmit(newAnswers);
    }
  };

  const handleReveal = () => setRevealed(true);

  const handleSubmit = async (finalAnswers: { questionIndex: number; selectedIndex: number }[]) => {
    if (!session?.accessToken) return;
    setSubmitting(true);
    try {
      const res = await post<{ score: number; passed: boolean; message: string; gradedAnswers: unknown[] }>(
        '/api/quiz/submit',
        { topicId, answers: finalAnswers },
        session.accessToken
      );
      setResult(res);
      setSubmitted(true);
    } catch {
      setSubmitted(true);
      setResult({ score: 0, passed: false, message: 'Submission failed. Please try again.', gradedAnswers: [] });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || submitting) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">
            {loading ? 'Generating quiz questions...' : 'Submitting your answers...'}
          </p>
        </div>
      </AppShell>
    );
  }

  if (questions.length === 0) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">Could not load quiz questions.</p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Go back
          </Button>
        </div>
      </AppShell>
    );
  }

  // Results screen
  if (submitted && result) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto space-y-6 animate-fade-up">
          <Card className={cn('p-8 text-center', result.passed ? 'border-green-500/30' : 'border-yellow-500/30')}>
            <div className="flex justify-center mb-4">
              {result.passed ? (
                <CheckCircle2 className="h-16 w-16 text-green-400" />
              ) : (
                <XCircle className="h-16 w-16 text-yellow-400" />
              )}
            </div>
            <div className="text-5xl font-bold gradient-text mb-2">{result.score}%</div>
            <Badge variant={result.passed ? 'success' : 'warning'} className="text-sm mb-4">
              {result.passed ? 'Passed' : 'Needs revision'}
            </Badge>
            <p className="text-muted-foreground text-sm mb-6">{result.message}</p>
            <Button onClick={() => router.push('/dashboard')} className="w-full" id="quiz-back-btn">
              Back to dashboard
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const q = questions[currentQ];
  const progress = ((currentQ) / questions.length) * 100;

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Question {currentQ + 1} of {questions.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Question */}
        <Card className="animate-slide-in" key={currentQ}>
          <CardHeader>
            <p className="text-lg font-semibold leading-relaxed">{q.question}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correctIndex;
              const isSelected = selected === i;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={revealed}
                  id={`option-${i}`}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200',
                    !revealed && isSelected && 'border-primary bg-primary/10',
                    !revealed && !isSelected && 'border-border hover:border-primary/40 hover:bg-secondary/50',
                    revealed && isCorrect && 'border-green-500 bg-green-500/10 text-green-300',
                    revealed && !isCorrect && isSelected && 'border-red-500 bg-red-500/10 text-red-300',
                    revealed && !isCorrect && !isSelected && 'border-border opacity-50',
                  )}
                >
                  <span className="font-medium mr-2">{['A', 'B', 'C', 'D'][i]}.</span>
                  {opt}
                </button>
              );
            })}

            {revealed && (
              <div className="mt-4 rounded-xl bg-secondary/50 px-4 py-3 text-sm">
                <p className="font-medium text-accent mb-1">Explanation</p>
                <p className="text-muted-foreground">{q.explanation}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {!revealed && selected !== null && (
                <Button variant="outline" onClick={handleReveal} className="flex-1" id="reveal-btn">
                  Check answer
                </Button>
              )}
              {(revealed || selected !== null) && (
                <Button
                  onClick={handleNext}
                  className="flex-1"
                  disabled={selected === null}
                  id="next-question-btn"
                >
                  {currentQ + 1 === questions.length ? 'Submit quiz' : 'Next question'}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
