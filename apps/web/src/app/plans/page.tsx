'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PlusCircle, Calendar, Target, Zap, BookMarked,
  Trash2, ArrowRight, CheckCircle2, PauseCircle, Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { usePlan } from '@/components/providers/PlanContext';
import { del } from '@/lib/fetcher';
import { daysUntil, formatDate, cn } from '@/lib/utils';
import type { PlanSummary } from '@/lib/types';

function StatusBadge({ status }: { status: PlanSummary['status'] }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </span>
    );
  }
  if (status === 'PAUSED') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
        <PauseCircle className="h-3 w-3" />
        Paused
      </span>
    );
  }
  if (status === 'COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="h-3 w-3" />
        Complete
      </span>
    );
  }
  return null;
}

function PlanCard({
  plan,
  onActivate,
  onDelete,
  activating,
  deleting,
}: {
  plan: PlanSummary;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  activating: string | null;
  deleting: string | null;
}) {
  const router = useRouter();
  const days = daysUntil(plan.examDate);
  const isActive = plan.status === 'ACTIVE';
  const isPaused = plan.status === 'PAUSED';

  return (
    <Card
      glow={isActive}
      className={cn(
        'p-5 flex flex-col gap-4 border transition-all duration-200',
        isActive
          ? 'border-primary/30 shadow-md shadow-primary/5'
          : 'border-border/40'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-foreground truncate">{plan.subject}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={plan.status} />
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(plan.examDate)}
            </span>
          </div>
        </div>
        {isActive && (
          <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {days > 0 ? days : 0}
          </p>
          <p className="text-[10px] text-muted-foreground">Days left</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{plan.goalScore}%</p>
          <p className="text-[10px] text-muted-foreground">Goal score</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{plan.coveragePercent}%</p>
          <p className="text-[10px] text-muted-foreground">Coverage</p>
        </div>
      </div>

      {/* Coverage bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Progress</span>
          <span>{plan.coveragePercent}% complete</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
            style={{ width: `${plan.coveragePercent}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isActive ? (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => router.push('/plan')}
          >
            View Plan
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onActivate(plan.id)}
            disabled={activating === plan.id}
          >
            {activating === plan.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {activating === plan.id ? 'Activating…' : 'Activate'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2.5"
          onClick={() => onDelete(plan.id)}
          disabled={deleting === plan.id}
          title="Delete plan"
        >
          {deleting === plan.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </Card>
  );
}

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { plans, loading, switchPlan, createNewPlan, refreshPlans } = usePlan();
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const handleActivate = async (planId: string) => {
    setActivating(planId);
    setError('');
    try {
      await switchPlan(planId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to activate plan');
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!session?.accessToken) return;
    if (!confirm('Are you sure you want to delete this plan? All progress will be lost.')) return;
    setDeleting(planId);
    setError('');
    try {
      await del(`/api/plans/${planId}`, session.accessToken);
      await refreshPlans();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete plan');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-40 bg-secondary/40 rounded" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-secondary/20 rounded-2xl border border-border/20" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-7">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookMarked className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">My Plans</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {plans.length > 0
                ? `${plans.length} plan${plans.length > 1 ? 's' : ''} · Switch anytime to focus on a different exam`
                : 'Create your first study plan to get started'}
            </p>
          </div>
          <Button onClick={createNewPlan} className="shrink-0 gap-2">
            <PlusCircle className="h-4 w-4" />
            New Plan
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* Plan grid */}
        {plans.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 reveal-on-scroll">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onActivate={handleActivate}
                onDelete={handleDelete}
                activating={activating}
                deleting={deleting}
              />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <BookMarked className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No plans yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Create your first study plan and let Unslump AI build a personalised day-by-day schedule for your exam.
            </p>
            <Button onClick={createNewPlan} size="lg" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create my first plan
            </Button>
          </div>
        )}

        {/* Tip banner when multiple plans */}
        {plans.length > 1 && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 px-5 py-4 flex items-start gap-3">
            <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Tip: Only one plan is active at a time</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your dashboard, streaks, and daily check-ins always reflect the currently <strong>Active</strong> plan.
                Paused plans keep all their progress safely stored.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
