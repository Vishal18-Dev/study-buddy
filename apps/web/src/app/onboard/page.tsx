'use client';
import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Send, Upload, ArrowRight, BookOpen, ArrowLeft, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { post } from '@/lib/fetcher';
import { usePlan } from '@/components/providers/PlanContext';
import { useToast } from '@/components/ui/toast-provider';
import type { Plan } from '@/lib/types';

type ChatMessage = { role: 'user' | 'model'; content: string };

interface ExtractedParams {
  subject: string | null;
  examDate: string | null;
  dailyHours: number | null;
  goalScore: number | null;
  knowledgeLevel: 'BEGINNER' | 'SOME_KNOWLEDGE' | 'REVISION' | null;
  syllabusContext: string | null;
}

function OnboardContent() {
  const { data: session, status } = useSession();
  const { refreshPlans } = usePlan();
  const router = useRouter();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const fromPlans = searchParams?.get('from') === 'plans';
  
  // URL parameters for teacher-assigned plan customization
  const classroomIdParam = searchParams?.get('classroomId');
  const templateIdParam = searchParams?.get('templateId');
  const subjectParam = searchParams?.get('subject');
  const syllabusContextParam = searchParams?.get('syllabusContext');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: subjectParam 
        ? `Hi! I see you are creating a plan for "${subjectParam}" assigned by your teacher. Let's customize it! When is your exam, how many hours can you study per day, and what is your goal score?`
        : "Yo! I'm Unslump. I build sick study plans tailored for your exams. Tell me what subject or exam you're preparing for, when it is, and let's get it sorted!"
    }
  ]);
  
  const [input, setInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planSummary, setPlanSummary] = useState('');
  
  const [extracted, setExtracted] = useState<ExtractedParams>({
    subject: subjectParam || null,
    examDate: null,
    dailyHours: null,
    goalScore: null,
    knowledgeLevel: null,
    syllabusContext: syllabusContextParam || null,
  });
  
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync parameters if passed via query params
  useEffect(() => {
    if (subjectParam) {
      setExtracted(prev => ({
        ...prev,
        subject: subjectParam,
        syllabusContext: syllabusContextParam || null
      }));
    }
  }, [subjectParam, syllabusContextParam]);

  const sendChatMessage = async (overrideText?: string) => {
    const text = overrideText || input.trim();
    if (!text || loadingChat || loadingPlan) return;
    
    setInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoadingChat(true);

    try {
      const res = await post<{
        reply: string;
        extracted: Partial<ExtractedParams>;
        readyToGenerate: boolean;
      }>('/api/plans/onboard-chat', {
        message: text,
        history: messages,
      }, session?.accessToken || undefined);

      if (res && res.reply) {
        setMessages([...newMessages, { role: 'model', content: res.reply }]);
        
        // Merge extracted parameters (preserve parameters if the response returns null)
        setExtracted((prev) => {
          const merged = { ...prev };
          const nextExt = res.extracted;
          
          if (nextExt.subject) merged.subject = nextExt.subject;
          if (nextExt.examDate) merged.examDate = nextExt.examDate;
          if (nextExt.dailyHours) merged.dailyHours = nextExt.dailyHours;
          if (nextExt.goalScore) merged.goalScore = nextExt.goalScore;
          if (nextExt.knowledgeLevel) merged.knowledgeLevel = nextExt.knowledgeLevel;
          if (nextExt.syllabusContext) merged.syllabusContext = nextExt.syllabusContext;
          
          // Validate ready status
          const hasRequired = !!(
            merged.subject &&
            merged.examDate &&
            merged.dailyHours &&
            merged.goalScore &&
            merged.knowledgeLevel
          );
          setReadyToGenerate(hasRequired || res.readyToGenerate);
          
          return merged;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'model', content: "Oops, my brain lagged for a second. Can you say that again?" }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExtracted((prev) => ({
        ...prev,
        syllabusContext: `Uploaded syllabus document: ${file.name}`
      }));
      addToast(`Syllabus "${file.name}" uploaded successfully`, 'success');
      sendChatMessage(`I just uploaded my syllabus file: "${file.name}"`);
    }
  };

  const handleBuildPlan = async () => {
    // Check if we have the bare minimum to build a plan
    if (!extracted.subject) {
      addToast('Please tell Unslump what subject you are studying first!', 'info');
      return;
    }
    
    // Fallbacks if not fully extracted
    const planParams = {
      subject: extracted.subject,
      examDate: extracted.examDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      dailyHours: extracted.dailyHours || 2,
      goalScore: extracted.goalScore || 70,
      knowledgeLevel: extracted.knowledgeLevel || 'BEGINNER',
      syllabusContext: extracted.syllabusContext || '',
      templateId: templateIdParam || undefined,
      classroomId: classroomIdParam || undefined,
    };

    setLoadingPlan(true);
    setMessages((m) => [...m, { role: 'model', content: "Awesome! Let's get this study plan generated. Building it right now, usually takes 10–15 seconds..." }]);

    try {
      const result = await post<{ plan: Plan; summary: string }>('/api/plans/create', planParams, session?.accessToken || undefined);
      
      setPlan(result.plan);
      setPlanSummary(result.summary);
      localStorage.setItem('pendingPlanId', result.plan.id);
      refreshPlans();
      
      setMessages((m) => [...m, { 
        role: 'model', 
        content: `Boom! Your plan is ready. Subject: **${result.plan.subject}**, Duration: **${result.plan.days.length} days**. Here's the plan overview:\n\n${result.summary}` 
      }]);
      addToast('Plan built successfully!', 'success');
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { role: 'model', content: "Ah, something went wrong while building your plan. Let's try again in a bit." }]);
      addToast('Failed to build plan', 'error');
    } finally {
      setLoadingPlan(false);
    }
  };

  // Helper to count resolved parameters
  const parameterCount = [
    extracted.subject,
    extracted.examDate,
    extracted.dailyHours,
    extracted.goalScore,
    extracted.knowledgeLevel
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="glass border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href={fromPlans ? "/plans" : "/"} 
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Exit
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2.5">
              <Image 
                src="/unslump-icon-gradient.svg"
                alt="Unslump Logo"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
              <span className="font-bold gradient-text">Unslump AI</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-medium bg-secondary px-3 py-1 rounded-full">
            {parameterCount}/5 Parameters Extracted
          </span>
        </div>
      </header>

      {/* Split layout */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col md:flex-row gap-6 min-h-0">
        
        {/* Left column: Onboarding Chatbot */}
        <div className="flex-1 flex flex-col card-elevated h-[calc(100vh-140px)] min-h-[450px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex animate-fade-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'model' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 mr-3 mt-1 shadow-sm">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap text-sm leading-relaxed ${
                    m.role === 'model' ? 'bubble-bot' : 'bubble-user'
                  }`}
                  dangerouslySetInnerHTML={{ 
                    __html: m.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              </div>
            ))}

            {(loadingChat || loadingPlan) && (
              <div className="flex items-center gap-3 animate-fade-up">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div className="bubble-bot flex items-center gap-2 px-4 py-3">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Interactive Chat controls */}
          {!plan && (
            <div className="border-t border-border p-4 bg-card/50 rounded-b-2xl">
              <form 
                onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} 
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer, or tell Unslump about your exam..."
                  disabled={loadingChat || loadingPlan}
                  className="flex-1"
                  autoFocus
                  id="onboard-chat-input"
                />
                <Button 
                  type="submit" 
                  disabled={loadingChat || loadingPlan || !input.trim()} 
                  size="icon"
                  id="onboard-chat-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Right column: Parameters Status & Plan Preview */}
        <div className="w-full md:w-80 flex flex-col gap-5 shrink-0">
          
          {/* Live parameters checklist */}
          <Card className="p-5 border border-border bg-card/60 backdrop-blur-md space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Plan Parameters</h3>
            <div className="space-y-3">
              
              {/* Subject */}
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Subject</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {extracted.subject ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground max-w-[100px] truncate">{extracted.subject}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-muted-foreground">Not set</span>
                    </>
                  )}
                </span>
              </div>

              {/* Exam Date */}
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Exam Date</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {extracted.examDate ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground">{extracted.examDate}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-muted-foreground">Not set</span>
                    </>
                  )}
                </span>
              </div>

              {/* Study Hours */}
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Daily Availability</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {extracted.dailyHours ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground">{extracted.dailyHours} hrs/day</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-muted-foreground">Not set</span>
                    </>
                  )}
                </span>
              </div>

              {/* Goal Score */}
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Goal Score</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {extracted.goalScore ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground">{extracted.goalScore}%</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-muted-foreground">Not set</span>
                    </>
                  )}
                </span>
              </div>

              {/* Knowledge Level */}
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Knowledge Level</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {extracted.knowledgeLevel ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground text-right max-w-[100px] truncate">{extracted.knowledgeLevel}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-muted-foreground">Not set</span>
                    </>
                  )}
                </span>
              </div>

              {/* Syllabus Context */}
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Syllabus</span>
                <span className="flex items-center gap-1.5 font-semibold text-right">
                  {extracted.syllabusContext ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground max-w-[100px] truncate">Provided</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Standard</span>
                  )}
                </span>
              </div>
            </div>

            {/* Syllabus Document upload button */}
            {!plan && (
              <div className="pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loadingChat || loadingPlan}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 text-xs h-9"
                  disabled={loadingChat || loadingPlan}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Syllabus PDF
                </Button>
              </div>
            )}

            {/* Glowing build plan trigger */}
            {!plan && (
              <div className="pt-4 space-y-2">
                <Button 
                  onClick={handleBuildPlan}
                  disabled={loadingPlan || !extracted.subject}
                  className={`w-full ${readyToGenerate ? 'border-glow animate-pulse' : ''}`}
                  size="lg"
                  variant={readyToGenerate ? 'default' : 'secondary'}
                >
                  Build Study Plan
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
                
                {!readyToGenerate && extracted.subject && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    You can generate now with default values, or keep chatting to customize them!
                  </p>
                )}
              </div>
            )}
          </Card>
          
          {/* Plan preview container */}
          {plan && (
            <Card className="p-5 border-glow bg-card/60 backdrop-blur-md flex-1 overflow-hidden flex flex-col">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Plan Created
              </h3>
              <div className="space-y-2 overflow-y-auto flex-1 pr-1 text-xs max-h-64">
                {plan.days.slice(0, 5).map((day) => (
                  <div key={day.id} className="py-2 border-b border-border/50">
                    <span className="font-semibold text-primary block mb-0.5">Day {day.dayNumber}</span>
                    <div className="flex flex-wrap gap-1">
                      {day.topics.map((t) => (
                        <span key={t.id} className="bg-secondary rounded px-1.5 py-0.5 font-medium">{t.title}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {plan.days.length > 5 && (
                  <p className="text-[10px] text-muted-foreground text-center pt-1">+ {plan.days.length - 5} more days</p>
                )}
              </div>
              <div className="pt-4 mt-auto border-t border-border">
                {status === 'authenticated' ? (
                  <Link href="/plans">
                    <Button className="w-full" size="sm">
                      View All My Plans
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/signup?planId=${plan.id}`}>
                    <Button className="w-full" size="sm">
                      Save plan — it&apos;s free
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <OnboardContent />
    </Suspense>
  );
}
