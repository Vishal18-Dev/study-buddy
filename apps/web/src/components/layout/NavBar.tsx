'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  BookOpen,
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Calendar,
  MessageSquare,
  Library,
  BookMarked,
  ChevronDown,
  CheckCircle2,
  PlusCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlan } from '@/components/providers/PlanContext';
import { daysUntil } from '@/lib/utils';

function PlanSwitcher() {
  const { plans, activePlan, loading, switchPlan, createNewPlan } = usePlan();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading) {
    return (
      <div className="mb-5 px-3 py-2 rounded-lg bg-secondary/50 flex items-center gap-2 animate-pulse">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading plans…</span>
      </div>
    );
  }

  if (plans.length === 0) return null;

  const label = activePlan?.subject ?? 'No active plan';
  const days = activePlan ? daysUntil(activePlan.examDate) : null;

  return (
    <div className="relative mb-5" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors group"
        id="plan-switcher-btn"
      >
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold text-foreground truncate">{label}</p>
          {days !== null && (
            <p className="text-[10px] text-muted-foreground">
              {days > 0 ? `${days}d to exam` : 'Exam today!'}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1.5 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {plans.map((plan) => {
              const isActive = plan.status === 'ACTIVE';
              const d = daysUntil(plan.examDate);
              return (
                <button
                  key={plan.id}
                  onClick={async () => {
                    if (!isActive) await switchPlan(plan.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-secondary/60 transition-colors',
                    isActive && 'bg-primary/8'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground truncate">{plan.subject}</p>
                      {isActive && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                      {plan.status === 'PAUSED' && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${plan.coveragePercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {plan.coveragePercent}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {d > 0 ? `${d}d remaining` : d === 0 ? 'Exam today!' : 'Exam passed'}
                    </p>
                  </div>
                  {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => { createNewPlan(); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-secondary/60 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <PlusCircle className="h-3.5 w-3.5 shrink-0" />
              New Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { activePlan } = usePlan();

  if (!session) return null;

  const navItems = [
    { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'      },
    { href: '/plan',         icon: Calendar,        label: 'Study Plan'     },
    { href: '/plans',        icon: BookMarked,      label: 'My Plans'       },
    { href: '/chat',         icon: MessageSquare,   label: 'AI Assistant'   },
    { href: '/knowledge',    icon: Library,         label: 'Knowledge Base' },
    { href: '/progress',     icon: BarChart3,       label: 'Progress'       },
    { href: '/settings',     icon: Settings,        label: 'Settings'       },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden h-14 bg-white dark:bg-card border-b border-border flex items-center justify-between px-5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Image 
            src="/unslump-icon-gradient.svg"
            alt="Unslump Logo"
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
          />
          <span className="font-bold text-foreground animate-slide-in">Unslump</span>
        </div>
        {activePlan && (
          <Link
            href="/plans"
            className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full max-w-[140px] truncate"
          >
            {activePlan.subject}
          </Link>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white dark:bg-card border-r border-border p-5 fixed left-0 top-0 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <Image 
            src="/unslump-icon-gradient.svg"
            alt="Unslump Logo"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
          <div>
            <span className="text-base font-bold text-foreground">Unslump</span>
            <span className="block text-[10px] text-muted-foreground font-medium tracking-wide uppercase">AI</span>
          </div>
        </div>

        {/* Plan Switcher */}
        <PlanSwitcher />

        <nav className="flex-1 flex flex-col gap-0.5">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive(href)
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User / sign-out */}
        <div className="mt-auto pt-4 border-t border-border">
          <div className="mb-2 px-3 py-2 rounded-lg bg-secondary">
            <p className="text-xs font-semibold text-foreground truncate">
              {session.user?.name || 'Student'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {session.user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all duration-150"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card border-t border-border z-40 shadow-[0_-1px_8px_hsl(224_71%_12%/0.06)]">
        <div className="flex items-center justify-around px-1 py-1.5">
          {navItems.slice(0, 5).map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-150 min-w-0',
                isActive(href) ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive(href) && 'stroke-[2.5]')} />
              <span className="truncate max-w-[52px] text-center">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
