'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
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
  RotateCcw,
  ArrowRightLeft,
  GraduationCap
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
          <div className="lg:col-span-7 text-left space-y-6 md:space-y-8 reveal-on-scroll">
            <div className="reveal-on-scroll delay-50 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-1.5 text-xs sm:text-sm text-primary dark:text-primary-foreground/90 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-primary dark:text-accent animate-pulse" />
              <span>Generate your personalized study blueprint instantly</span>
            </div>

            <h1 className="reveal-on-scroll delay-100 fluid-h1 font-extrabold tracking-tight text-foreground">
              Your personalized AI <br />
              <span className="gradient-text">study companion.</span>
            </h1>

            <p className="reveal-on-scroll delay-150 text-base sm:text-lg text-muted-foreground max-w-[65ch] leading-relaxed">
              Stop guessing what to study. Get a custom, day-by-day plan in under 2 minutes. Daily check-ins, automated quizzes, and smart rebalancing keep you on track.
            </p>

            <div className="reveal-on-scroll delay-200 flex flex-col sm:flex-row items-center gap-4 pt-2">
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
          <div className="lg:col-span-5 relative flex justify-center items-center reveal-on-scroll delay-200">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20 reveal-on-scroll delay-300">
          {[
            { value: '2 mins', label: 'Plan generation time', icon: Zap, color: 'text-primary' },
            { value: '94%', label: 'Average score improvement', icon: Star, color: 'text-yellow-500 fill-yellow-500' },
            { value: '18k+', label: 'Active study hours logged', icon: Flame, color: 'text-orange-500 fill-orange-500' },
          ].map(({ value, label, icon: Icon, color }) => (
            <Card key={label} glow={true} className="p-6 border border-border/40 flex items-center gap-4 text-left shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/80 border border-border/20">
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold font-sans">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Interactive Plan & Quiz Playground */}
      <section className="max-w-6xl mx-auto px-4 py-16 relative reveal-on-scroll">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-accent/5 dark:bg-accent/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="text-center mb-12 space-y-3">
          <h2 className="fluid-h2 font-bold tracking-tight text-foreground">
            Experience the <span className="gradient-text">Unslump Interface</span>
          </h2>
          <p className="text-muted-foreground max-w-[65ch] mx-auto text-sm sm:text-base">
            Interact with this live mock simulator to see how Unslump structures your topics, tracks consistency, and tests your memory.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left panel: Daily Blueprint Card */}
          <Card glow={true} className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between rounded-3xl border border-border/40 shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Interactive Preview</span>
                  <h3 className="text-xl font-bold mt-1">Your Biology Revision Plan</h3>
                </div>
                <div className="bg-secondary px-3 py-1 rounded-full text-xs font-medium text-muted-foreground flex items-center gap-1.5 border border-border">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </div>
              </div>

              {/* Day selection tabs with sliding pill */}
              <div className="flex gap-2 mb-6 border-b border-border/50 pb-4 overflow-x-auto relative">
                {[1, 2, 3].map(d => (
                  <button
                    key={d}
                    onClick={() => setActiveDay(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                      activeDay === d 
                        ? 'text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="relative z-10">Day {d}</span>
                    {activeDay === d && (
                      <motion.span
                        layoutId="activeDayTab"
                        className="absolute inset-0 bg-primary rounded-xl shadow-md shadow-primary/20"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Day topics list with layout transitions */}
              <div className="space-y-4 min-h-[160px] overflow-hidden">
                <AnimatePresence mode="popLayout">
                  {mockPlanDays.find(d => d.day === activeDay)?.topics.map((topic, idx) => (
                    <motion.div 
                      key={`${activeDay}-${idx}-${topic.title}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
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
                    </motion.div>
                  ))}
                </AnimatePresence>
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
          <Card glow={true} className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between rounded-3xl border border-border/40 shadow-xl">
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

      {/* Feature Bento Grid */}
      <section className="max-w-6xl mx-auto px-4 py-20 border-t border-border/40" id="features">
        <div className="text-center mb-16 reveal-on-scroll">
          <h2 className="fluid-h2 font-bold tracking-tight mb-4">
            Intelligent tools built to <span className="gradient-text">guarantee consistency</span>
          </h2>
          <p className="text-muted-foreground max-w-[65ch] mx-auto text-sm sm:text-base">
            Every feature is engineered around habit loops, helping you stay consistent, rebalance your time, and study stress-free.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto reveal-on-scroll delay-100">
          
          {/* Card 1: 2-Minute Onboarding (Spans 2 columns) */}
          <Card glow={true} className="md:col-span-2 p-6 sm:p-8 rounded-3xl border border-border/40 flex flex-col justify-between gap-6 hover:scale-[1.01] transition-transform duration-300">
            <div className="flex flex-col gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl">2-Minute Dynamic Onboarding</h3>
              <p className="text-muted-foreground text-sm max-w-[65ch] leading-relaxed">
                Our conversational onboarding gets to know your baseline syllabus, remaining timeline, constraints, and daily hour budgets to generate the most realistic preparation blueprint possible.
              </p>
            </div>
            
            {/* Visual preview of onboarding chat */}
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/20 flex flex-col gap-2.5 max-w-lg shadow-inner">
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">AI</div>
                <div className="bg-background rounded-2xl px-3 py-1.5 text-xs text-foreground shadow-sm">
                  What exam are you studying for, and when is it scheduled?
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-primary text-white rounded-2xl px-3 py-1.5 text-xs shadow-sm">
                  AP Biology exam on July 4th. I want to aim for a 90% score!
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Smart Rebalancing (Spans 1 column) */}
          <Card glow={true} className="md:col-span-1 p-6 sm:p-8 rounded-3xl border border-border/40 flex flex-col justify-between gap-6 hover:scale-[1.01] transition-transform duration-300">
            <div className="flex flex-col gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                <RefreshCw className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-bold text-xl">Smart Rebalancing</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Missed a study block? Don&apos;t panic. Our scheduler automatically distributes missed topics across remaining days without messy spreadsheets.
              </p>
            </div>
            
            {/* Rebalance icon layout */}
            <div className="flex justify-center items-center py-4 bg-secondary/20 rounded-2xl border border-border/10">
              <ArrowRightLeft className="h-10 w-10 text-accent animate-pulse" />
            </div>
          </Card>

          {/* Card 3: Streak & Grace (Spans 1 column) */}
          <Card glow={true} className="md:col-span-1 p-6 sm:p-8 rounded-3xl border border-border/40 flex flex-col justify-between gap-6 hover:scale-[1.01] transition-transform duration-300">
            <div className="flex flex-col gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="font-bold text-xl">Grace Logic</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Habits grow when protected. Log check-ins to build momentum, using built-in grace days to safeguard your active streak during busy weeks.
              </p>
            </div>
            
            {/* Streak graphic */}
            <div className="flex items-center justify-center gap-3 p-3 bg-secondary/30 rounded-2xl border border-border/20">
              <span className="text-xs font-bold text-orange-500 flex items-center gap-1">
                <Flame className="h-4 w-4 fill-orange-500" /> +1 Streak Checked!
              </span>
            </div>
          </Card>

          {/* Card 4: Daily Assessments (Spans 2 columns) */}
          <Card glow={true} className="md:col-span-2 p-6 sm:p-8 rounded-3xl border border-border/40 flex flex-col justify-between gap-6 hover:scale-[1.01] transition-transform duration-300">
            <div className="flex flex-col gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                <GraduationCap className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="font-bold text-xl">Retrieval-Practice Quizzes</h3>
              <p className="text-muted-foreground text-sm max-w-[65ch] leading-relaxed">
                Unlock daily revision assessments once you finish your scheduled topics. Customized quizzes test active recall rather than passive recognition, confirming retention.
              </p>
            </div>

            {/* Smart quiz snippet */}
            <div className="flex flex-wrap gap-2.5 max-w-md">
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">A. Mitochondria ✓ Correct</span>
              <span className="text-[10px] font-semibold bg-secondary/50 text-muted-foreground border border-border/40 px-2.5 py-1 rounded-full">B. Ribosome</span>
              <span className="text-[10px] font-semibold bg-secondary/50 text-muted-foreground border border-border/40 px-2.5 py-1 rounded-full">C. Golgi Body</span>
            </div>
          </Card>

        </div>
      </section>

      {/* Final Call to Action */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center reveal-on-scroll">
        <Card glow={true} className="p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 rounded-[2rem]">
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 dark:bg-primary/20 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="fluid-h2 font-bold tracking-tight mb-4">
            Build your personalized study route <span className="gradient-text">today.</span>
          </h2>
          <p className="text-muted-foreground max-w-[65ch] mx-auto mb-8 text-sm sm:text-base">
            Generate your interactive dashboard, access mock quizzes, and log check-ins instantly. No account registration required to preview.
          </p>
          <Link href="/onboard">
            <Button size="xl" className="rounded-2xl gap-2 shadow-lg shadow-primary/20 font-semibold">
              Build Study Plan
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </Card>
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
