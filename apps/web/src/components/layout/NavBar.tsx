'use client';
import Link from 'next/link';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) return null;

  const navItems = [
    { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'      },
    { href: '/plan',         icon: Calendar,        label: 'Study Plan'     },
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
      <header className="lg:hidden h-14 bg-white border-b border-border flex items-center justify-between px-5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-foreground">StudyBuddy</span>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white border-r border-border p-5 fixed left-0 top-0 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-foreground">StudyBuddy</span>
            <span className="block text-[10px] text-muted-foreground font-medium tracking-wide uppercase">AI</span>
          </div>
        </div>

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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40 shadow-[0_-1px_8px_hsl(224_71%_12%/0.06)]">
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
