'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { 
  ArrowRight, 
  Zap, 
  RefreshCw, 
  Flame, 
  BookOpen, 
  Star, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LandingPage() {
  const [activeDay, setActiveDay] = useState(1);
  const [quizAnswered, setQuizAnswered] = useState<number | null>(null);
  const [streakCount, setStreakCount] = useState(5);
  const [streakChecked, setStreakChecked] = useState(false);

  const mockPlanDays = [
    {
      day: 1,
      topics: [
        { title: 'Introduction to Cell Structure & Organelles', mins: 45, completed: true },
        { title: 'Cell Membrane & Active/Passive Transport', mins: 35, completed: false }
      ]
    },
    {
      day: 2,
      topics: [
        { title: 'Photosynthesis: Light & Dark Reactions', mins: 50, completed: false },
        { title: 'Cellular Respiration & ATP Cycle', mins: 40, completed: false }
      ]
    },
    {
      day: 3,
      topics: [
        { title: 'Mitosis vs Meiosis Cell Division Stages', mins: 45, completed: false },
        { title: 'DNA Replication & Protein Synthesis Concepts', mins: 60, completed: false }
      ]
    }
  ];

  const handleQuizAnswer = (index: number) => {
    if (quizAnswered !== null) return;
    setQuizAnswered(index);
  };

  const handleCheckIn = () => {
    if (streakChecked) return;
    setStreakChecked(true);
    setStreakCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen transition-colors duration-500 relative overflow-hidden bg-background">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 dark:bg-primary/20 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-accent/5 dark:bg-accent/15 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-primary/5 dark:bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Nav */}
      <header className="glass border-b border-border/40 sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image 
              src="/unslump-icon-gradient.svg"
              alt="Unslump Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
            <span className="text-lg font-bold gradient-text">Unslump AI</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex rounded-xl font-medium">Sign in</Button>
            </Link>
            <Link href="/onboard">
              <Button size="sm" className="rounded-xl shadow-md shadow-primary/20 font-semibold">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Content */}
          <div className="lg:col-span-7 text-left space-y-6 md:space-y-8 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-1.5 text-xs sm:text-sm text-primary dark:text-primary-foreground/90 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-primary dark:text-accent animate-pulse" />
              <span>Generate your personalized study blueprint instantly</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold leading-[1.15] tracking-tight">
              Your personalized AI <br />
              <span className="gradient-text">study companion.</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Stop guessing what to study. Get a custom, day-by-day plan in under 2 minutes. Daily check-ins, automated quizzes, and smart rebalancing keep you on track.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <Link href="/onboard" id="cta-start" className="w-full sm:w-auto">
                <Button size="xl" className="w-full sm:w-auto rounded-2xl gap-2 shadow-lg shadow-primary/30 dark:shadow-primary/25 text-base font-semibold">
                  Build My Study Plan
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="xl" className="w-full sm:w-auto rounded-2xl text-base glass border-border hover:bg-secondary/60">
                  Already have a plan? Log in
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Premium Illustration */}
          <div className="lg:col-span-5 relative flex justify-center items-center">
            {/* Glowing backdrop elements */}
            <div className="absolute w-72 h-72 bg-primary/20 dark:bg-primary/30 rounded-full blur-[80px] -z-10 animate-pulse-glow" />
            <div className="absolute w-48 h-48 bg-accent/20 dark:bg-accent/30 rounded-full blur-[60px] -z-10 bottom-0 right-0" />
            
            {/* Frosted Frame */}
            <div className="glass p-3 sm:p-5 rounded-[2.5rem] shadow-2xl relative border border-white/20 dark:border-white/10 hover:scale-[1.02] transition-transform duration-500 ease-out">
              <Image 
                src="/study_hero_companion.svg"
                alt="AI Study Companion"
                width={480}
                height={480}
                className="rounded-3xl object-contain"
                priority
              />
              {/* Floating micro-badges */}
              <div className="absolute -top-4 -left-4 glass py-2 px-3 rounded-2xl border border-white/20 dark:border-white/10 flex items-center gap-2 shadow-lg">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold">AI Powered</span>
              </div>
              <div className="absolute -bottom-4 -right-4 glass py-2 px-3 rounded-2xl border border-white/20 dark:border-white/10 flex items-center gap-2 shadow-lg">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="text-xs font-semibold">94% Score Gain</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20 stagger-children">
          {[
            { value: '2 mins', label: 'Plan generation time', icon: Zap, color: 'text-primary' },
            { value: '94%', label: 'Average score improvement', icon: Star, color: 'text-yellow-500 fill-yellow-500' },
            { value: '18k+', label: 'Active study hours logged', icon: Flame, color: 'text-orange-500 fill-orange-500' },
          ].map(({ value, label, icon: Icon, color }) => (
            <div key={label} className="glass rounded-2xl p-6 border border-border/40 hover:border-primary/30 transition-all duration-300 flex items-center gap-4 text-left shadow-sm hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/80 border border-border/20">
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold font-sans">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Plan & Quiz Playground */}
      <section className="max-w-6xl mx-auto px-4 py-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-accent/5 dark:bg-accent/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Experience the <span className="gradient-text">Unslump Interface</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Interact with this live mock simulator to see how Unslump structures your topics, tracks consistency, and tests your memory.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left panel: Daily Blueprint Card */}
          <Card className="lg:col-span-7 glass border border-border/40 p-6 sm:p-8 flex flex-col justify-between rounded-3xl shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Interactive Preview</span>
                  <h3 className="text-xl font-bold mt-1">Your Biology Revision Plan</h3>
                </div>
                {/* Theme mode preview badge */}
                <div className="bg-secondary px-3 py-1 rounded-full text-xs font-medium text-muted-foreground flex items-center gap-1.5 border border-border">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </div>
              </div>

              {/* Day selection tabs */}
              <div className="flex gap-2 mb-6 border-b border-border/50 pb-4 overflow-x-auto">
                {[1, 2, 3].map(d => (
                  <button
                    key={d}
                    onClick={() => setActiveDay(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      activeDay === d 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    Day {d}
                  </button>
                ))}
              </div>

              {/* Day topics list */}
              <div className="space-y-4">
                {mockPlanDays.find(d => d.day === activeDay)?.topics.map((topic, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex items-start justify-between gap-4 transition-all hover:bg-secondary/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <CheckCircle2 className={`h-5 w-5 ${topic.completed || (activeDay === 1 && idx === 0) ? 'text-primary' : 'text-muted-foreground/40'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm leading-snug">{topic.title}</h4>
                        <span className="text-xs text-muted-foreground mt-1 block">Duration: {topic.mins} minutes</span>
                      </div>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
                      {topic.completed || (activeDay === 1 && idx === 0) ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Check-in & Streak widget with illustration */}
            <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 rounded-2xl overflow-hidden border border-orange-500/20 shadow-md">
                  <Image 
                    src="/study_consistency_flame.svg"
                    alt="Consistency Streak"
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Habit Loop Streak</span>
                  <div className="text-lg font-extrabold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                    <Flame className="h-5 w-5 text-orange-500 animate-streak fill-orange-500" />
                    {streakCount} Days Active
                  </div>
                </div>
              </div>

              <Button
                variant={streakChecked ? "outline" : "default"}
                onClick={handleCheckIn}
                className={`rounded-xl transition-all ${streakChecked ? 'border-primary/30 text-primary bg-primary/5' : 'shadow-md shadow-primary/20'}`}
                disabled={streakChecked}
              >
                {streakChecked ? 'Checked In for Today ✓' : 'Perform Daily Check-in'}
              </Button>
            </div>
          </Card>

          {/* Right panel: Live Quiz Simulator */}
          <Card className="lg:col-span-5 glass border border-border/40 p-6 sm:p-8 flex flex-col justify-between rounded-3xl shadow-xl">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="h-5 w-5 text-accent" />
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI Quiz Simulator</span>
              </div>
              <h3 className="text-lg font-bold mb-4">Day 1 Review: Biology Cell Structures</h3>

              <div className="bg-secondary/40 border border-border/50 rounded-2xl p-4 mb-6">
                <p className="text-sm font-semibold leading-relaxed">
                  Which organelle is responsible for generating chemical energy (ATP) in eukaryotic cells?
                </p>
              </div>

              <div className="space-y-3">
                {[
                  'Ribosome',
                  'Lysosome',
                  'Mitochondria',
                  'Golgi Apparatus'
                ].map((option, idx) => {
                  let btnStyle = 'border-border/60 hover:bg-secondary/60 hover:border-primary/40';
                  if (quizAnswered !== null) {
                    if (idx === 2) {
                      btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                    } else if (quizAnswered === idx) {
                      btnStyle = 'border-destructive bg-destructive/10 text-destructive';
                    } else {
                      btnStyle = 'opacity-55 border-border/40';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuizAnswer(idx)}
                      disabled={quizAnswered !== null}
                      className={`w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${btnStyle}`}
                    >
                      <span>{idx + 1}. {option}</span>
                      {quizAnswered !== null && idx === 2 && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Correct ✓</span>
                      )}
                      {quizAnswered !== null && quizAnswered === idx && idx !== 2 && (
                        <span className="text-xs font-bold text-destructive">Incorrect ✗</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedbacks / explanations */}
              {quizAnswered !== null && (
                <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-fade-up text-xs leading-relaxed">
                  <span className="font-bold text-primary block mb-1">Explanation:</span>
                  The Mitochondria is known as the powerhouse of the cell because it generates adenosine triphosphate (ATP), the primary energy carrier of eukaryotic cells.
                </div>
              )}
            </div>

            {quizAnswered !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuizAnswered(null)}
                className="mt-6 gap-1.5 self-center text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Retry Quiz Question
              </Button>
            )}
          </Card>
        </div>
      </section>

      {/* Feature Walkthrough */}
      <section className="max-w-6xl mx-auto px-4 py-20 border-t border-border/40" id="features">
        <h2 className="text-3xl font-bold text-center tracking-tight mb-12">
          Intelligent tools built to <span className="gradient-text">guarantee consistency</span>
        </h2>

        <div className="grid sm:grid-cols-3 gap-8 stagger-children">
          {[
            {
              icon: Zap,
              title: '2-Minute Consultation',
              description: 'Our conversational AI onboarding maps your baseline knowledge, constraints, and daily hours to formulate the most realistic study timeline.',
              color: 'text-primary',
              bg: 'bg-primary/10',
              border: 'hover:border-primary/40 dark:hover:border-primary/60'
            },
            {
              icon: RefreshCw,
              title: 'Smart Rebalancing',
              description: 'Missed a day? No panic. Our algorithms recalculate your remaining topics across the rest of your timeline automatically. Zero manual edits.',
              color: 'text-accent',
              bg: 'bg-accent/10',
              border: 'hover:border-accent/40 dark:hover:border-accent/60'
            },
            {
              icon: Flame,
              title: 'Streak & Grace Logic',
              description: 'Study habits are built on consistency. Log daily check-ins to build milestones, utilizing automated grace days to protect your streaks.',
              color: 'text-orange-500',
              bg: 'bg-orange-500/10',
              border: 'hover:border-orange-500/40 dark:hover:border-orange-500/60'
            },
          ].map(({ icon: Icon, title, description, color, bg, border }) => (
            <Card key={title} className={`p-6 sm:p-8 rounded-3xl glass border border-border/40 transition-all duration-300 flex flex-col gap-5 group hover:shadow-lg ${border}`}>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${bg}`}>
                <Icon className={`h-6 w-6 ${color} group-hover:scale-110 transition-transform`} />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="glass border-glow rounded-[2rem] p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-white/20 dark:border-white/10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 dark:bg-primary/20 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Build your personalized study route <span className="gradient-text">today.</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8 text-sm sm:text-base">
            Generate your interactive dashboard, access mock quizzes, and log check-ins instantly. No account registration required to preview.
          </p>
          <Link href="/onboard">
            <Button size="xl" className="rounded-2xl gap-2 shadow-lg shadow-primary/20 font-semibold">
              Build Study Plan
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 text-center text-sm text-muted-foreground transition-colors duration-300">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <Image 
            src="/unslump-icon-gradient.svg"
            alt="Unslump Logo"
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
          />
          <span className="font-bold text-foreground">Unslump AI</span>
        </div>
        <p className="max-w-xs mx-auto text-xs text-muted-foreground leading-relaxed">
          Crafted for high-performing students who values consistency over cramming.
        </p>
        <div className="mt-6 text-xs border-t border-border/30 pt-6 max-w-sm mx-auto">
          © {new Date().getFullYear()} Unslump. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
