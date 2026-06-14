import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StreakBadge({ count, size = 'md', className }: StreakBadgeProps) {
  const sizeConfig = {
    sm: { icon: 'h-4 w-4', text: 'text-sm', container: 'gap-1 px-2 py-1' },
    md: { icon: 'h-5 w-5', text: 'text-base', container: 'gap-1.5 px-3 py-1.5' },
    lg: { icon: 'h-7 w-7', text: 'text-2xl', container: 'gap-2 px-4 py-2' },
  };

  const { icon, text, container } = sizeConfig[size];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl glass border-glow',
        container,
        className
      )}
    >
      <Flame
        className={cn(icon, 'text-orange-400 animate-streak')}
        fill="currentColor"
      />
      <span className={cn(text, 'font-bold text-orange-300')}>{count}</span>
    </div>
  );
}
