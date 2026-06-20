'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { get, patch } from '@/lib/fetcher';
import type { PlanSummary } from '@/lib/types';

interface PlanContextValue {
  plans: PlanSummary[];
  activePlan: PlanSummary | null;
  loading: boolean;
  refreshPlans: () => Promise<void>;
  switchPlan: (planId: string) => Promise<void>;
  createNewPlan: () => void;
}

const PlanContext = createContext<PlanContextValue>({
  plans: [],
  activePlan: null,
  loading: true,
  refreshPlans: async () => {},
  switchPlan: async () => {},
  createNewPlan: () => {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPlans = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const result = await get<PlanSummary[]>('/api/plans', session.accessToken);
      setPlans(result);
    } catch {
      // silent — user may not have any plans yet
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'authenticated') {
      refreshPlans();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, refreshPlans]);

  const switchPlan = useCallback(
    async (planId: string) => {
      if (!session?.accessToken) return;
      // Optimistic update
      setPlans((prev) =>
        prev.map((p) => ({
          ...p,
          status: p.id === planId ? 'ACTIVE' : p.status === 'ACTIVE' ? 'PAUSED' : p.status,
        }))
      );
      try {
        await patch(`/api/plans/${planId}/activate`, {}, session.accessToken);
        // Refresh to get server truth
        await refreshPlans();
      } catch {
        // Rollback on failure
        await refreshPlans();
      }
    },
    [session?.accessToken, refreshPlans]
  );

  const createNewPlan = useCallback(() => {
    router.push('/onboard?from=plans');
  }, [router]);

  const activePlan = plans.find((p) => p.status === 'ACTIVE') ?? null;

  return (
    <PlanContext.Provider value={{ plans, activePlan, loading, refreshPlans, switchPlan, createNewPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
