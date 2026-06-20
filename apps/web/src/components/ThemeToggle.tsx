'use client';

import { useTheme } from '@/components/providers/ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-secondary/40 hover:bg-secondary/80 text-foreground transition-all duration-300 hover:scale-105 active:scale-95 glass relative overflow-hidden"
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {/* Sun Icon */}
        <Sun className={`h-5 w-5 absolute transition-all duration-500 transform ${
          theme === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-amber-500'
        }`} />
        {/* Moon Icon */}
        <Moon className={`h-5 w-5 absolute transition-all duration-500 transform ${
          theme === 'dark' ? 'rotate-0 scale-100 opacity-100 text-indigo-400' : '-rotate-90 scale-0 opacity-0'
        }`} />
      </div>
    </button>
  );
}
